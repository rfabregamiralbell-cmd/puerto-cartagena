import { describe, it, expect } from 'vitest';
import { classifyTerrain, validateTerrainForType } from '../src/utils/visualWaterValidator.js';

// Coordinates chosen relative to map_config waterZones:
//   Mar Caribe (oeste): around [10.46..10.36, -75.55..-75.60]
//   Bahía de Cartagena (sur): around [10.40..10.34, -75.51..-75.55]
const IN_WATER = [10.42, -75.585];   // inside the Caribbean west polygon
const INLAND   = [10.4236, -75.5378]; // city center, away from water edges

describe('classifyTerrain', () => {
  it('classifies a point inside a water zone as water', () => {
    expect(classifyTerrain(IN_WATER)).toBe('water');
  });

  it('classifies an inland point as land', () => {
    expect(classifyTerrain(INLAND)).toBe('land');
  });

  it('returns one of the three known categories', () => {
    const r = classifyTerrain(INLAND);
    expect(['water', 'coast', 'land']).toContain(r);
  });
});

describe('validateTerrainForType', () => {
  it('rejects land buildings on water', () => {
    const res = validateTerrainForType(IN_WATER, 'land');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/agua/i);
  });

  it('allows land buildings on land', () => {
    const res = validateTerrainForType(INLAND, 'land');
    expect(res.ok).toBe(true);
  });

  it('rejects a Puerto (coast) placed in open water', () => {
    const res = validateTerrainForType(IN_WATER, 'coast');
    expect(res.ok).toBe(false);
  });

  it('rejects a Hacienda (land_open) on water', () => {
    const res = validateTerrainForType(IN_WATER, 'land_open');
    expect(res.ok).toBe(false);
  });

  it('rejects a Fortaleza (defensive) on water but allows it on land', () => {
    expect(validateTerrainForType(IN_WATER, 'defensive').ok).toBe(false);
    expect(validateTerrainForType(INLAND, 'defensive').ok).toBe(true);
  });

  it('always reports the detected terrain', () => {
    const res = validateTerrainForType(INLAND, 'land');
    expect(['water', 'coast', 'land']).toContain(res.terrain);
  });
});
