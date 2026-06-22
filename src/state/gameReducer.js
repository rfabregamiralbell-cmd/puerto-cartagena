// ============================================================
// GAME REDUCER
// Pure-ish state transitions. Engines compute, reducer applies.
// ============================================================

import districtsConfig from '../config/districts_config.json';
import shipsConfig from '../config/ships_config.json';
import {
  generateDistrictPolygon, polygonAreaM2, polygonCentroid, polygonsOverlap,
} from '../utils/geoUtils.js';
import { validateTerrainForType } from '../utils/visualWaterValidator.js';
import { TerrainDefenseEngine } from '../engines/defense/terrainDefenseEngine.js';

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

function recalcDefense(state) {
  // Inline defense recompute. (The standalone PortDefenseEngine will be
  // refactored to a pure function and wired in during the combat phase.)
  const fort = state.districts.filter((d) => d.type === 'fortaleza');
  const arsenal = state.districts.filter((d) => d.type === 'arsenal');
  const cannons = state.resources.cañones.amount;
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
      const polygon = generateDistrictPolygon(point, type.minAreaM2 * 1.5);
      const area = polygonAreaM2(polygon);

      // Validation chain
      const terrainCheck = validateTerrainForType(point, type.terrain);
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

      const district = {
        id: `d_${++s.districtCounter}`,
        type: type.id,
        name: type.name,
        polygon: preview.polygon,
        mainBuildingPoint: polygonCentroid(preview.polygon),
        areaM2: Math.round(preview.area),
        assignedWorkers: 0,
        workersRequired: type.workersRequired,
        level: 1,
        status: 'active',
        createdAt: Date.now(),
        constructionStartedAt: Date.now(),
        constructionEndsAt: Date.now(),
        lastProductionAt: Date.now(),
        cost: type.cost,
      };

      if (type.id === 'fortaleza' && preview.defenseEval) {
        district.defensiveValue = preview.defenseEval.defensiveValue;
        district.coverageRadiusM = TerrainDefenseEngine.coverageRadiusM(preview.point, 1);
      }

      s.districts = [...s.districts, district];
      s.ui = { ...s.ui, placementMode: null, placementPreview: null };
      addXP(s, 10);
      recalcDefense(s);
      notify(s, 'success', `${type.emoji} ${type.name} construido.`);
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

    // ── Economy tick ────────────────────────────────────────
    case 'TICK': {
      const now = action.now;
      s.tick = s.tick + 1;
      const resources = { ...s.resources };
      let produced = false;
      s.districts.forEach((d) => {
        const type = getType(d.type);
        if (!type?.production || !type.productionInterval) return;
        if (now - (d.lastProductionAt || 0) >= type.productionInterval) {
          Object.entries(type.production).forEach(([r, v]) => {
            if (resources[r]) {
              resources[r] = { ...resources[r], amount: Math.min(resources[r].amount + v * d.level, resources[r].max) };
            }
          });
          d.lastProductionAt = now;
          produced = true;
        }
      });
      if (produced) { s.resources = resources; addXP(s, 1); }
      // expire notifications
      s.notifications = s.notifications.filter((n) => {
        if (!n._shownAt) n._shownAt = now;
        return now - n._shownAt < (n.duration || 3500);
      });
      return s;
    }

    case 'DISMISS_NOTIFICATION': {
      s.notifications = s.notifications.filter((n) => n.id !== action.id);
      return s;
    }

    case 'LOAD_STATE': {
      return { ...action.state };
    }

    default:
      return state;
  }
}
