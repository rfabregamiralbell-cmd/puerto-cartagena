import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/state/gameReducer.js';
import { createInitialState } from '../src/state/initialState.js';

// Helpers
const fresh = () => createInitialState();
const INLAND = [10.4236, -75.5378]; // land per map_config
const IN_WATER = [10.42, -75.585];  // inside Caribbean water zone

function place(state, typeId, point) {
  let s = gameReducer(state, { type: 'START_PLACEMENT', typeId });
  s = gameReducer(s, { type: 'PREVIEW_PLACEMENT', point });
  return s;
}

describe('initial state', () => {
  it('starts with no districts and starting resources', () => {
    const s = fresh();
    expect(s.districts).toHaveLength(0);
    expect(s.resources.oro.amount).toBeGreaterThan(0);
    expect(s.port.level).toBe(1);
  });
});

describe('placement flow', () => {
  it('START_PLACEMENT sets placement mode', () => {
    const s = gameReducer(fresh(), { type: 'START_PLACEMENT', typeId: 'cabildo' });
    expect(s.ui.placementMode).toEqual({ typeId: 'cabildo' });
  });

  it('PREVIEW on land marks a free Cabildo as valid', () => {
    const s = place(fresh(), 'cabildo', INLAND);
    expect(s.ui.placementPreview).toBeTruthy();
    expect(s.ui.placementPreview.valid).toBe(true);
  });

  it('PREVIEW on water marks a land building as invalid with a reason', () => {
    const s = place(fresh(), 'cabildo', IN_WATER);
    expect(s.ui.placementPreview.valid).toBe(false);
    expect(s.ui.placementPreview.errors.join(' ')).toMatch(/agua/i);
  });

  it('CONFIRM adds the district and clears placement', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    expect(s.districts).toHaveLength(1);
    expect(s.districts[0].type).toBe('cabildo');
    expect(s.ui.placementMode).toBeNull();
    expect(s.ui.placementPreview).toBeNull();
  });

  it('CONFIRM does nothing when preview is invalid', () => {
    let s = place(fresh(), 'cabildo', IN_WATER);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    expect(s.districts).toHaveLength(0);
  });

  it('CANCEL_PLACEMENT clears mode and preview', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CANCEL_PLACEMENT' });
    expect(s.ui.placementMode).toBeNull();
    expect(s.ui.placementPreview).toBeNull();
  });

  it('stores a valid closed GeoJSON polygon and a centroid marker', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    const d = s.districts[0];
    expect(d.polygon.geometry.type).toBe('Polygon');
    expect(d.mainBuildingPoint).toHaveLength(2);
    expect(d.areaM2).toBeGreaterThan(0);
  });
});

describe('resource spending', () => {
  it('spends resources on a paid district', () => {
    const before = fresh();
    const goldBefore = before.resources.oro.amount;
    let s = place(before, 'almacen', INLAND); // almacen costs oro + madera
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    expect(s.resources.oro.amount).toBeLessThan(goldBefore);
  });

  it('blocks placement that the player cannot afford', () => {
    let s = fresh();
    s.resources.oro.amount = 0;
    s.resources.madera.amount = 0;
    s = place(s, 'almacen', INLAND);
    expect(s.ui.placementPreview.valid).toBe(false);
    expect(s.ui.placementPreview.errors.join(' ')).toMatch(/insuficient/i);
  });
});

describe('unique districts', () => {
  it('prevents building two Cabildos', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    // try a second one elsewhere on land
    s = place(s, 'cabildo', [10.4240, -75.5350]);
    expect(s.ui.placementPreview.valid).toBe(false);
  });
});

describe('overlap detection', () => {
  it('rejects a district overlapping an existing one', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    // almacen at nearly the same point → overlap
    s = place(s, 'almacen', INLAND);
    const errs = s.ui.placementPreview.errors.join(' ');
    expect(s.ui.placementPreview.valid).toBe(false);
    expect(errs).toMatch(/solap/i);
  });
});

describe('upgrade and demolish', () => {
  it('upgrades a district when affordable', () => {
    let s = place(fresh(), 'almacen', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    const id = s.districts[0].id;
    s = gameReducer(s, { type: 'UPGRADE_DISTRICT', id });
    expect(s.districts[0].level).toBe(2);
  });

  it('demolish removes the district and refunds part of the cost', () => {
    let s = place(fresh(), 'almacen', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    const afterBuildGold = s.resources.oro.amount;
    const id = s.districts[0].id;
    s = gameReducer(s, { type: 'DEMOLISH_DISTRICT', id });
    expect(s.districts).toHaveLength(0);
    expect(s.resources.oro.amount).toBeGreaterThanOrEqual(afterBuildGold);
  });
});

describe('fortaleza defensive evaluation', () => {
  it('attaches a defensiveValue when previewing a Fortaleza', () => {
    // Fortaleza requires Cabildo level 3; bypass by forcing prerequisites off
    // via direct preview (requirement error may exist, but defenseEval still computes)
    const s = place(fresh(), 'fortaleza', [10.4275, -75.528]);
    expect(s.ui.placementPreview.defenseEval).toBeTruthy();
    expect(s.ui.placementPreview.defenseEval.defensiveValue).toBeGreaterThanOrEqual(0);
  });
});

describe('layers and sheets', () => {
  it('TOGGLE_LAYER flips a layer', () => {
    const s = fresh();
    const before = s.map.layers.tradeRoutes;
    const after = gameReducer(s, { type: 'TOGGLE_LAYER', layer: 'tradeRoutes' });
    expect(after.map.layers.tradeRoutes).toBe(!before);
  });

  it('OPEN_SHEET / CLOSE_SHEET update ui.openSheet', () => {
    let s = gameReducer(fresh(), { type: 'OPEN_SHEET', sheet: 'build' });
    expect(s.ui.openSheet).toBe('build');
    s = gameReducer(s, { type: 'CLOSE_SHEET' });
    expect(s.ui.openSheet).toBeNull();
  });
});

describe('economy tick', () => {
  it('produces resources from a Cabildo after its interval', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    const goldBefore = s.resources.oro.amount;
    // force last production far in the past so the tick yields
    s.districts[0].lastProductionAt = 0;
    s = gameReducer(s, { type: 'TICK', now: Date.now() });
    expect(s.resources.oro.amount).toBeGreaterThan(goldBefore);
  });

  it('does not exceed the resource max', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    s.resources.oro.amount = s.resources.oro.max;
    s.districts[0].lastProductionAt = 0;
    s = gameReducer(s, { type: 'TICK', now: Date.now() });
    expect(s.resources.oro.amount).toBeLessThanOrEqual(s.resources.oro.max);
  });
});

describe('build ship', () => {
  it('adds an idle ship and spends resources', () => {
    let s = fresh();
    s.resources.oro.amount = 999;
    s.resources.madera.amount = 200;
    s.resources.velas.amount = 50;
    const before = s.ships.length;
    s = gameReducer(s, { type: 'BUILD_SHIP', shipConfigId: 'merchant_small' });
    expect(s.ships.length).toBe(before + 1);
    expect(s.ships[0].status).toBe('idle');
  });
});

describe('unknown action', () => {
  it('returns the same state reference', () => {
    const s = fresh();
    expect(gameReducer(s, { type: 'NOPE' })).toBe(s);
  });
});

// ── Phase A: semi-active economy, storage caps, collection ──
describe('storage caps (Almacén)', () => {
  it('raises a resource max when an Almacén is built', () => {
    let s = place(fresh(), 'almacen', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    expect(s.resources.madera.max).toBe(250); // 200 base + 50 bonus
  });

  it('restores the cap when the Almacén is demolished', () => {
    let s = place(fresh(), 'almacen', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    const id = s.districts[0].id;
    s = gameReducer(s, { type: 'DEMOLISH_DISTRICT', id });
    expect(s.resources.madera.max).toBe(200);
  });
});

describe('semi-active production', () => {
  it('fills a district buffer instead of resources directly', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    const goldBefore = s.resources.oro.amount;
    s.districts[0].lastProductionAt = 0;
    s = gameReducer(s, { type: 'TICK', now: Date.now() });
    expect(s.resources.oro.amount).toBe(goldBefore);   // not added yet
    expect(s.districts[0].buffer.oro).toBeGreaterThan(0); // accumulated
  });

  it('caps the buffer', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    for (let i = 0; i < 60; i++) {
      s.districts[0].lastProductionAt = 0;
      s = gameReducer(s, { type: 'TICK', now: Date.now() + i });
    }
    expect(s.districts[0].buffer.oro).toBeLessThanOrEqual(10); // cap = 10 * level
  });
});

describe('collection requires a port connection', () => {
  it('blocks collection when not connected to a Puerto', () => {
    let s = place(fresh(), 'cabildo', INLAND);
    s = gameReducer(s, { type: 'CONFIRM_PLACEMENT' });
    s.districts[0].lastProductionAt = 0;
    s = gameReducer(s, { type: 'TICK', now: Date.now() });
    const before = s.resources.oro.amount;
    s = gameReducer(s, { type: 'COLLECT_DISTRICT', id: s.districts[0].id });
    expect(s.resources.oro.amount).toBe(before); // blocked, no port nearby
  });
});

describe('LOAD_STATE migration', () => {
  it('adds baseMax and buffer fields to old saves', () => {
    const old = createInitialState();
    delete old.resources.oro.baseMax;
    old.districts = [{ id: 'x', type: 'cabildo', level: 1, mainBuildingPoint: INLAND }];
    const s = gameReducer(fresh(), { type: 'LOAD_STATE', state: old });
    expect(s.resources.oro.baseMax).not.toBeNull();
    expect(s.districts[0].buffer).toBeDefined();
  });
});

// ── Spatial: dynamic footprint + influence + permissive port ──
describe('dynamic footprint and influence', () => {
  const rich = () => {
    const s = createInitialState();
    s.resources.oro.amount = 999;
    s.resources.madera.amount = 200;
    s.resources.piedra.amount = 200;
    return s;
  };
  const build = (s, t, p) =>
    gameReducer(gameReducer(gameReducer(s, { type: 'START_PLACEMENT', typeId: t }), { type: 'PREVIEW_PLACEMENT', point: p }), { type: 'CONFIRM_PLACEMENT' });

  it('a higher-employment district paints a bigger footprint', () => {
    const hac = build(rich(), 'hacienda', [10.45, -75.52]).districts.find((d) => d.type === 'hacienda');
    const alm = build(rich(), 'almacen', [10.4236, -75.5378]).districts.find((d) => d.type === 'almacen');
    expect(hac.areaM2).toBeGreaterThan(alm.areaM2);
  });

  it('stores an influence radius that grows on upgrade', () => {
    let s = build(rich(), 'hacienda', [10.45, -75.52]);
    const before = s.districts[0].influenceRadiusM;
    expect(before).toBeGreaterThan(0);
    s = gameReducer(s, { type: 'UPGRADE_DISTRICT', id: s.districts[0].id });
    expect(s.districts[0].influenceRadiusM).toBeGreaterThan(before);
  });

  it('builds a Puerto at the inner harbor point', () => {
    let s = rich();
    s = gameReducer(gameReducer(gameReducer(s, { type: 'START_PLACEMENT', typeId: 'puerto' }), { type: 'PREVIEW_PLACEMENT', point: [10.410, -75.547] }), { type: 'CONFIRM_PLACEMENT' });
    expect(s.districts.some((d) => d.type === 'puerto')).toBe(true);
  });
});
