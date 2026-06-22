import { describe, it, expect } from 'vitest';
import { TerrainDefenseEngine } from '../src/engines/defense/terrainDefenseEngine.js';

// From map_config: high ground near Cerro de la Popa [10.4275, -75.528]
const ON_HIGH_GROUND = [10.4275, -75.528];
// A flat inland spot away from high ground, coast and chokepoints
const FLAT_EXPOSED = [10.44, -75.52];

describe('TerrainDefenseEngine.evaluate', () => {
  it('returns all expected score fields', () => {
    const r = TerrainDefenseEngine.evaluate(ON_HIGH_GROUND);
    expect(r).toHaveProperty('elevationScore');
    expect(r).toHaveProperty('lineOfSight');
    expect(r).toHaveProperty('coastalCoverage');
    expect(r).toHaveProperty('chokepointValue');
    expect(r).toHaveProperty('defensiveValue');
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('keeps every 0-1 score within bounds', () => {
    const r = TerrainDefenseEngine.evaluate(ON_HIGH_GROUND);
    for (const k of ['elevationScore', 'slopeScore', 'lineOfSight', 'coastalCoverage', 'chokepointValue']) {
      expect(r[k]).toBeGreaterThanOrEqual(0);
      expect(r[k]).toBeLessThanOrEqual(1);
    }
  });

  it('defensiveValue stays within 0-100', () => {
    const r = TerrainDefenseEngine.evaluate(ON_HIGH_GROUND);
    expect(r.defensiveValue).toBeGreaterThanOrEqual(0);
    expect(r.defensiveValue).toBeLessThanOrEqual(100);
  });

  it('rewards high ground over flat exposed terrain', () => {
    const high = TerrainDefenseEngine.evaluate(ON_HIGH_GROUND);
    const flat = TerrainDefenseEngine.evaluate(FLAT_EXPOSED);
    expect(high.elevationScore).toBeGreaterThan(flat.elevationScore);
    expect(high.defensiveValue).toBeGreaterThan(flat.defensiveValue);
  });

  it('matches the documented defensiveValue formula', () => {
    const r = TerrainDefenseEngine.evaluate(ON_HIGH_GROUND);
    const expected = Math.round(
      r.elevationScore * 30 +
      r.lineOfSight * 30 +
      r.coastalCoverage * 25 +
      r.chokepointValue * 15
    );
    // scores are rounded to 2 decimals in output, allow ±1 from rounding
    expect(Math.abs(r.defensiveValue - expected)).toBeLessThanOrEqual(2);
  });
});

describe('TerrainDefenseEngine.verdict', () => {
  it('labels excellent / acceptable / weak by threshold', () => {
    expect(TerrainDefenseEngine.verdict(80).tier).toBe('excellent');
    expect(TerrainDefenseEngine.verdict(50).tier).toBe('acceptable');
    expect(TerrainDefenseEngine.verdict(10).tier).toBe('weak');
  });

  it('always returns a label and color', () => {
    const v = TerrainDefenseEngine.verdict(42);
    expect(typeof v.label).toBe('string');
    expect(v.color).toMatch(/^#/);
  });
});

describe('TerrainDefenseEngine.coverageRadiusM', () => {
  it('grows with level', () => {
    const l1 = TerrainDefenseEngine.coverageRadiusM(ON_HIGH_GROUND, 1);
    const l3 = TerrainDefenseEngine.coverageRadiusM(ON_HIGH_GROUND, 3);
    expect(l3).toBeGreaterThan(l1);
  });

  it('returns a positive radius', () => {
    expect(TerrainDefenseEngine.coverageRadiusM(FLAT_EXPOSED, 1)).toBeGreaterThan(0);
  });
});
