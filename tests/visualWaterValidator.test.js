import { describe, it, expect } from 'vitest';
import { classifyTerrain, validateTerrainForType, distanceToWaterM } from '../src/utils/visualWaterValidator.js';
import { createInitialState } from '../src/state/initialState.js';
import routes from '../src/config/trade_routes_config.json';
import mapConfig from '../src/config/map_config.json';

const IN_WATER = [10.42, -75.585];
const INLAND   = [10.4236, -75.5378];
const PORT     = mapConfig.portStart;

describe('classifyTerrain (edge-distance)', () => {
  it('classifies a point inside a water zone as water', () => {
    expect(classifyTerrain(IN_WATER)).toBe('water');
  });
  it('classifies the city center as land', () => {
    expect(classifyTerrain(INLAND)).toBe('land');
  });
  it('distanceToWaterM is 0 inside water and positive on land', () => {
    expect(distanceToWaterM(IN_WATER)).toBe(0);
    expect(distanceToWaterM(INLAND)).toBeGreaterThan(0);
  });
});

describe('validateTerrainForType - land rules', () => {
  it('rejects land buildings on water', () => {
    expect(validateTerrainForType(IN_WATER, 'land').ok).toBe(false);
  });
  it('allows land buildings on land', () => {
    expect(validateTerrainForType(INLAND, 'land').ok).toBe(true);
  });
  it('rejects Hacienda (land_open) on water', () => {
    expect(validateTerrainForType(IN_WATER, 'land_open').ok).toBe(false);
  });
});

describe('validateTerrainForType - permissive Puerto (coast)', () => {
  it('accepts a Puerto at the predefined port start', () => {
    expect(validateTerrainForType(PORT, 'coast').ok).toBe(true);
  });
  it('accepts a Puerto inside the port area even if slightly inland', () => {
    const nearArea = [PORT[0] + 0.003, PORT[1] + 0.003];
    expect(validateTerrainForType(nearArea, 'coast').ok).toBe(true);
  });
  it('rejects a Puerto deep inland far from water and port', () => {
    expect(validateTerrainForType([10.4236, -75.5200], 'coast').ok).toBe(false);
  });
});

describe('resource key normalization', () => {
  it('uses ASCII canones (no ñ) and has no accented keys', () => {
    const keys = Object.keys(createInitialState().resources);
    expect(keys).toContain('canones');
    expect(keys.some((k) => /[ñáéíóú]/.test(k))).toBe(false);
  });
  it('every trade cargo type maps to a real resource key', () => {
    const keys = new Set(Object.keys(createInitialState().resources));
    const cargo = new Set();
    routes.routes.forEach((r) => r.cargoTypes.forEach((c) => cargo.add(c)));
    const missing = [...cargo].filter((c) => !keys.has(c));
    expect(missing).toEqual([]);
  });
});
