import { describe, it, expect } from 'vitest';
import { generateDistrictShape, distanceM } from '../src/utils/geoUtils.js';
import districtsConfig from '../src/config/districts_config.json';

const CART = [10.4236, -75.5378];

// Rotation-invariant elongation: max vertex-pair distance / shortest edge.
function elongation(feature) {
  const ll = feature.geometry.coordinates[0].map(([x, y]) => [y, x]);
  let maxD = 0;
  for (let i = 0; i < ll.length; i++)
    for (let j = i + 1; j < ll.length; j++)
      maxD = Math.max(maxD, distanceM(ll[i], ll[j]));
  let minE = Infinity;
  for (let i = 0; i < ll.length - 1; i++)
    minE = Math.min(minE, distanceM(ll[i], ll[i + 1]));
  return maxD / minE;
}

describe('generateDistrictShape', () => {
  it('every district type declares a shape', () => {
    expect(districtsConfig.districtTypes.every((t) => t.shape)).toBe(true);
  });

  it('organic shape has many vertices (blob)', () => {
    const f = generateDistrictShape(CART, 'organic', 6000);
    expect(f.geometry.coordinates[0].length).toBeGreaterThanOrEqual(9);
  });

  it('corridor is long and thin (high elongation)', () => {
    const f = generateDistrictShape(CART, 'corridor', 2000, { orientTo: [10.43, -75.53] });
    expect(elongation(f)).toBeGreaterThan(5);
  });

  it('elongated (port) is stretched along its axis', () => {
    const f = generateDistrictShape(CART, 'elongated', 5000, { orientTo: [10.40, -75.55] });
    expect(elongation(f)).toBeGreaterThan(2);
  });

  it('defensive shape is a pentagon (5 vertices + close)', () => {
    const f = generateDistrictShape(CART, 'defensive', 5000);
    expect(f.geometry.coordinates[0].length).toBe(6);
  });

  it('compact shape is roughly square (low elongation)', () => {
    const f = generateDistrictShape(CART, 'compact', 4000);
    expect(elongation(f)).toBeLessThan(2);
  });

  it('all shapes produce closed rings', () => {
    for (const shape of ['organic', 'corridor', 'elongated', 'defensive', 'compact']) {
      const ring = generateDistrictShape(CART, shape, 4000, { orientTo: [10.43, -75.53] }).geometry.coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });
});
