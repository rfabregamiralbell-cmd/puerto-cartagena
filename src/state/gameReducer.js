// ============================================================
// GAME REDUCER
// Pure-ish state transitions. Engines compute, reducer applies.
// ============================================================

import districtsConfig from '../config/districts_config.json';
import shipsConfig from '../config/ships_config.json';
import mapConfig from '../config/map_config.json';
import {
  generateDistrictShape, polygonAreaM2, polygonCentroid, polygonsOverlap, distanceM,
} from '../utils/geoUtils.js';
import { validateTerrainForType } from '../utils/visualWaterValidator.js';
import { TerrainDefenseEngine } from '../engines/defense/terrainDefenseEngine.js';
import { isConnectedToPort, adjacencySynergy } from '../engines/trade/logisticsEngine.js';

const getType = (id) => districtsConfig.districtTypes.find((t) => t.id === id);
const getShipConfig = (id) => shipsConfig.ships.find((s) => s.id === id);

function notify(state, type, message, duration = 3500) {
  state.notifications = [
    ...state.notifications,
    { id: Date.now() + Math.random(), type, message, duration },
  ];
}

function hasResources(resources, cost) {
  return Object.entries(cost || {}).every(([r, v]) => (resources[r]?.amount ?? 0) >= v);
}

function cabildoLevel(state) {
  const cab = state.districts.filter((d) => d.type === 'cabildo');
  return cab.length ? Math.max(...cab.map((d) => d.level)) : 0;
}

// ── Workers (point 4) ──────────────────────────────────────
// Labour pool grows with the city (Cabildo level). Districts draw from it.
function totalWorkers(state) {
  return 10 + cabildoLevel(state) * 8;
}
function assignedWorkersTotal(state) {
  return state.districts.reduce((sum, d) => sum + (d.assignedWorkers || 0), 0);
}
function freeWorkers(state) {
  return Math.max(0, totalWorkers(state) - assignedWorkersTotal(state));
}
// Staffing ratio drives production speed: fully staffed = 1, half = 0.5.
function staffingRatio(d) {
  if (!d.workersRequired) return 1;
  return Math.min((d.assignedWorkers || 0) / d.workersRequired, 1);
}

// ── Orientation helpers for shape autofill ─────────────────
function nearestWaterPoint(point) {
  // Aim toward the closest water-zone vertex (cheap, good enough for orienting)
  let best = null, min = Infinity;
  (mapConfig.waterZones || []).forEach((z) => {
    z.polygon.forEach((pt) => {
      const dd = distanceM(point, pt);
      if (dd < min) { min = dd; best = pt; }
    });
  });
  return best || mapConfig.portStart;
}
function nearestDistrictPoint(state, point) {
  let best = null, min = Infinity;
  state.districts.forEach((d) => {
    if (!d.mainBuildingPoint) return;
    const dd = distanceM(point, d.mainBuildingPoint);
    if (dd < min) { min = dd; best = d.mainBuildingPoint; }
  });
  return best;
}

function recalcDefense(state) {
  // Inline defense recompute. (The standalone PortDefenseEngine will be
  // refactored to a pure function and wired in during the combat phase.)
  const fort = state.districts.filter((d) => d.type === 'fortaleza');
  const arsenal = state.districts.filter((d) => d.type === 'arsenal');
  const cannons = state.resources.canones.amount;
  const powder = state.resources.polvora.amount;
  const idleShips = state.ships.filter((s) => s.status === 'idle');

  const artillery = Math.min(Math.floor(cannons * 0.5 + powder * 0.2) + arsenal.length * 5, 40);
  const patrol = Math.min(idleShips.length * 8, 30);
  const fortBonus = fort.reduce((sum, f) => sum + f.level * 10 + (f.defensiveValue || 0) * 0.2, 0);
  const supply = Math.round(Math.min(powder * 0.5 + cannons, 20));

  const score = Math.min(Math.round(5 + fortBonus + artillery + patrol + supply), 100);
  state.defense = {
    ...state.defense,
    artilleryPower: artillery,
    navalPatrolStrength: patrol,
    supplyReadiness: supply,
    coastalCoverage: fort.reduce((m, f) => Math.max(m, f.coverageRadiusM || 0), 0),
    defenseScore: score,
    raidRisk: score >= 60 ? 'none' : score >= 35 ? 'low' : score >= 15 ? 'medium' : 'high',
    blockadeRisk: score >= 70 ? 'none' : score >= 45 ? 'low' : 'medium',
  };
}

function addXP(state, amount) {
  state.port.xp += amount;
  while (state.port.xp >= state.port.xpToNextLevel && state.port.level < 5) {
    state.port.xp -= state.port.xpToNextLevel;
    state.port.level++;
    state.port.xpToNextLevel = Math.floor(state.port.xpToNextLevel * 1.6);
    notify(state, 'levelup', `¡Ciudad ascendida a Nivel ${state.port.level}!`, 4000);
  }
}

// Recompute resource maximums: baseMax + sum of Almacén storageBonus * level.
function recalcStorage(state) {
  const bonus = {};
  state.districts.forEach((d) => {
    const type = getType(d.type);
    if (!type?.storageBonus) return;
    Object.entries(type.storageBonus).forEach(([r, v]) => {
      bonus[r] = (bonus[r] || 0) + v * d.level;
    });
  });
  const resources = { ...state.resources };
  Object.keys(resources).forEach((r) => {
    const base = resources[r].baseMax ?? resources[r].max;
    const newMax = base + (bonus[r] || 0);
    resources[r] = {
      ...resources[r],
      max: newMax,
      amount: Math.min(resources[r].amount, newMax),
    };
  });
  state.resources = resources;
}

// Per-district production buffer cap (semi-active economy).
const BUFFER_CAP_PER_LEVEL = 10;

export function gameReducer(state, action) {
  // Work on a shallow clone; nested arrays reassigned where mutated
  const s = { ...state };

  switch (action.type) {

    // ── Placement flow ──────────────────────────────────────
    case 'START_PLACEMENT': {
      s.ui = { ...s.ui, placementMode: { typeId: action.typeId }, placementPreview: null, openSheet: null };
      return s;
    }

    case 'CANCEL_PLACEMENT': {
      s.ui = { ...s.ui, placementMode: null, placementPreview: null };
      return s;
    }

    case 'PREVIEW_PLACEMENT': {
      if (!s.ui.placementMode) return s;
      const type = getType(s.ui.placementMode.typeId);
      if (!type) return s;
      const point = action.point; // [lat,lng]

      // Orientation target: Puerto/Camino point toward the nearest relevant thing.
      let orientTo = null;
      if (type.shape === 'elongated') {
        orientTo = nearestWaterPoint(point); // port stretches toward water
      } else if (type.shape === 'corridor') {
        orientTo = nearestDistrictPoint(s, point) || nearestWaterPoint(point);
      }

      const polygon = generateDistrictShape(point, type.shape || 'compact', type.minAreaM2 * 1.5, { orientTo });
      const area = polygonAreaM2(polygon);

      // Validation chain (pass polygon so Puerto can check it touches water)
      const terrainCheck = validateTerrainForType(point, type.terrain, { polygon });
      const overlap = s.districts.some((d) => polygonsOverlap(polygon, d.polygon));
      const affordable = hasResources(s.resources, type.cost);
      const cabReq = type.requiredCabildoLevel ? cabildoLevel(s) >= type.requiredCabildoLevel : true;

      let defenseEval = null;
      if (type.id === 'fortaleza') defenseEval = TerrainDefenseEngine.evaluate(point);

      const errors = [];
      if (!terrainCheck.ok) errors.push(terrainCheck.reason);
      if (overlap) errors.push('El distrito se solapa con otro existente.');
      if (!affordable) errors.push('Recursos insuficientes.');
      if (!cabReq) errors.push(`Requiere Cabildo nivel ${type.requiredCabildoLevel}.`);
      if (type.unique && s.districts.some((d) => d.type === type.id)) errors.push(`Ya tienes un ${type.name}.`);

      s.ui = {
        ...s.ui,
        placementPreview: {
          point, polygon, area,
          terrain: terrainCheck.terrain,
          valid: errors.length === 0,
          errors,
          defenseEval,
        },
      };
      return s;
    }

    case 'CONFIRM_PLACEMENT': {
      const preview = s.ui.placementPreview;
      const mode = s.ui.placementMode;
      if (!preview || !mode || !preview.valid) return s;
      const type = getType(mode.typeId);

      // Spend resources
      const resources = { ...s.resources };
      Object.entries(type.cost || {}).forEach(([r, v]) => {
        resources[r] = { ...resources[r], amount: resources[r].amount - v };
      });
      s.resources = resources;

      const free = freeWorkers(s);
      const assigned = Math.min(type.workersRequired || 0, free);

      const district = {
        id: `d_${++s.districtCounter}`,
        type: type.id,
        name: type.name,
        polygon: preview.polygon,
        mainBuildingPoint: polygonCentroid(preview.polygon),
        areaM2: Math.round(preview.area),
        assignedWorkers: assigned,
        workersRequired: type.workersRequired,
        level: 1,
        status: 'active',
        createdAt: Date.now(),
        constructionStartedAt: Date.now(),
        constructionEndsAt: Date.now(),
        lastProductionAt: Date.now(),
        buffer: {},        // accumulated, uncollected production (semi-active)
        connected: false,  // recomputed on tick: reaches a Puerto via roads
        cost: type.cost,
      };

      if (type.id === 'fortaleza' && preview.defenseEval) {
        district.defensiveValue = preview.defenseEval.defensiveValue;
        district.coverageRadiusM = TerrainDefenseEngine.coverageRadiusM(preview.point, 1);
      }

      s.districts = [...s.districts, district];
      s.ui = { ...s.ui, placementMode: null, placementPreview: null };
      addXP(s, 10);
      recalcStorage(s);
      recalcDefense(s);
      if (type.workersRequired && assigned < type.workersRequired) {
        notify(s, 'warning', `${type.name} construido pero con falta de trabajadores (${assigned}/${type.workersRequired}). Producción reducida.`);
      } else {
        notify(s, 'success', `${type.emoji} ${type.name} construido.`);
      }
      return s;
    }

    // ── District actions ────────────────────────────────────
    case 'SELECT_DISTRICT': {
      s.ui = { ...s.ui, selectedDistrictId: action.id, selectedShipId: null, openSheet: action.id ? 'district' : null };
      return s;
    }

    case 'UPGRADE_DISTRICT': {
      const d = s.districts.find((x) => x.id === action.id);
      if (!d) return s;
      const type = getType(d.type);
      if (d.level >= type.maxLevel) { notify(s, 'warning', 'Nivel máximo.'); return s; }
      const cost = Object.fromEntries(Object.entries(type.cost || {}).map(([k, v]) => [k, Math.floor(v * 1.5 * d.level)]));
      if (!hasResources(s.resources, cost)) { notify(s, 'warning', 'Recursos insuficientes.'); return s; }
      const resources = { ...s.resources };
      Object.entries(cost).forEach(([r, v]) => { resources[r] = { ...resources[r], amount: resources[r].amount - v }; });
      s.resources = resources;
      s.districts = s.districts.map((x) => x.id === d.id ? { ...x, level: x.level + 1 } : x);
      addXP(s, 15);
      recalcStorage(s);
      recalcDefense(s);
      notify(s, 'success', `${type.name} mejorado a nivel ${d.level + 1}.`);
      return s;
    }

    case 'DEMOLISH_DISTRICT': {
      const d = s.districts.find((x) => x.id === action.id);
      if (!d) return s;
      const type = getType(d.type);
      const resources = { ...s.resources };
      Object.entries(type.cost || {}).forEach(([r, v]) => {
        if (resources[r]) resources[r] = { ...resources[r], amount: Math.min(resources[r].amount + Math.floor(v * 0.5), resources[r].max) };
      });
      s.resources = resources;
      s.districts = s.districts.filter((x) => x.id !== d.id);
      s.ui = { ...s.ui, selectedDistrictId: null, openSheet: null };
      recalcStorage(s);
      recalcDefense(s);
      notify(s, 'info', 'Distrito demolido.');
      return s;
    }

    // ── Ships ───────────────────────────────────────────────
    case 'BUILD_SHIP': {
      const cfg = getShipConfig(action.shipConfigId);
      if (!cfg) return s;
      const astillero = 0; // shipyard tie-in (Puerto level proxy for now)
      if (!hasResources(s.resources, cfg.cost)) { notify(s, 'warning', 'Recursos insuficientes.'); return s; }
      const resources = { ...s.resources };
      Object.entries(cfg.cost).forEach(([r, v]) => { resources[r] = { ...resources[r], amount: resources[r].amount - v }; });
      s.resources = resources;
      const ship = {
        id: `ship_${++s.shipCounter}`,
        type: cfg.type,
        name: `${cfg.name} ${s.shipCounter}`,
        shipConfigId: cfg.id,
        emoji: cfg.emoji,
        status: 'idle',
        captainId: null,
        currentRouteId: null,
        stats: { ...cfg.stats },
        upgrades: [],
        createdAt: Date.now(),
      };
      s.ships = [...s.ships, ship];
      recalcDefense(s);
      notify(s, 'success', `${cfg.name} construido y listo.`);
      return s;
    }

    case 'SELECT_SHIP': {
      s.ui = { ...s.ui, selectedShipId: action.id, selectedDistrictId: null };
      return s;
    }

    // ── Map / layers / sheets ───────────────────────────────
    case 'TOGGLE_LAYER': {
      s.map = { ...s.map, layers: { ...s.map.layers, [action.layer]: !s.map.layers[action.layer] } };
      return s;
    }

    case 'OPEN_SHEET': {
      s.ui = { ...s.ui, openSheet: action.sheet };
      return s;
    }

    case 'CLOSE_SHEET': {
      s.ui = { ...s.ui, openSheet: null, selectedDistrictId: null };
      return s;
    }

    case 'SET_MAP_VIEW': {
      s.map = { ...s.map, center: action.center, zoom: action.zoom };
      return s;
    }

    // ── Economy tick (semi-active) ──────────────────────────
    case 'TICK': {
      const now = action.now;
      s.tick = s.tick + 1;
      let changed = false;

      const districts = s.districts.map((d) => {
        const type = getType(d.type);
        if (!type?.production || !type.productionInterval) return d;
        if (now - (d.lastProductionAt || 0) < type.productionInterval) return d;

        // Connectivity: producers must reach a Puerto via roads to deliver.
        const connected = isConnectedToPort(d, s.districts);
        const synergy = adjacencySynergy(d, s.districts);
        const staffing = staffingRatio(d);
        const cap = BUFFER_CAP_PER_LEVEL * d.level;

        const buffer = { ...(d.buffer || {}) };
        Object.entries(type.production).forEach(([r, v]) => {
          const amount = Math.round(v * d.level * synergy * staffing);
          if (amount > 0) buffer[r] = Math.min((buffer[r] || 0) + amount, cap);
        });
        changed = true;
        return { ...d, buffer, connected, lastProductionAt: now };
      });

      if (changed) { s.districts = districts; addXP(s, 1); }

      // expire notifications
      s.notifications = s.notifications.filter((n) => {
        if (!n._shownAt) n._shownAt = now;
        return now - n._shownAt < (n.duration || 3500);
      });
      return s;
    }

    // ── Collect a district's accumulated buffer into global storage ──
    case 'COLLECT_DISTRICT': {
      const d = s.districts.find((x) => x.id === action.id);
      if (!d || !d.buffer || !Object.keys(d.buffer).length) return s;

      if (!isConnectedToPort(d, s.districts)) {
        notify(s, 'warning', `${d.name} no está conectado al Puerto por un Camino. Las mercancías no pueden salir.`);
        return s;
      }

      const resources = { ...s.resources };
      let collectedAny = false;
      Object.entries(d.buffer).forEach(([r, v]) => {
        if (resources[r]) {
          const room = resources[r].max - resources[r].amount;
          const moved = Math.min(v, room);
          if (moved > 0) {
            resources[r] = { ...resources[r], amount: resources[r].amount + moved };
            collectedAny = true;
          }
        }
      });
      s.resources = resources;
      s.districts = s.districts.map((x) => x.id === d.id ? { ...x, buffer: {} } : x);
      if (collectedAny) notify(s, 'success', `Mercancías recogidas de ${d.name}.`);
      else notify(s, 'warning', 'Almacenes llenos. Amplía un Almacén.');
      return s;
    }

    case 'DISMISS_NOTIFICATION': {
      s.notifications = s.notifications.filter((n) => n.id !== action.id);
      return s;
    }

    case 'LOAD_STATE': {
      const loaded = { ...action.state };
      // Migrate older saves: ensure baseMax + district buffer exist.
      if (loaded.resources) {
        Object.keys(loaded.resources).forEach((r) => {
          if (loaded.resources[r].baseMax == null) {
            loaded.resources[r] = { ...loaded.resources[r], baseMax: loaded.resources[r].max };
          }
        });
      }
      if (Array.isArray(loaded.districts)) {
        loaded.districts = loaded.districts.map((d) => ({ buffer: {}, connected: false, ...d }));
      }
      return loaded;
    }

    default:
      return state;
  }
}
