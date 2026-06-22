import { describe, it, expect } from 'vitest';
import {
  distanceM,
  generateDistrictPolygon,
  polygonToLatLngs,
  polygonAreaM2,
  polygonCentroid,
  pointInPolygon,
  polygonsOverlap,
} from '../src/utils/geoUtils.js';

const CARTAGENA = [10.4236, -75.5378];

describe('distanceM', () => {
  it('returns 0 for the same point', () => {
    expect(distanceM(CARTAGENA, CARTAGENA)).toBe(0);
  });

  it('is symmetric', () => {
    const a = [10.42, -75.54];
    const b = [10.40, -75.55];
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 5);
  });

  it('approximates a known short distance (~1.1km per 0.01° lat)', () => {
    const d = distanceM([10.40, -75.50], [10.41, -75.50]);
    // 0.01 degrees latitude ≈ 1113 m
    expect(d).toBeGreaterThan(1050);
    expect(d).toBeLessThan(1180);
  });
});

describe('generateDistrictPolygon', () => {
  it('produces a closed GeoJSON polygon (first === last vertex)', () => {
    const poly = generateDistrictPolygon(CARTAGENA, 4000);
    const ring = poly.geometry.coordinates[0];
    expect(poly.type).toBe('Feature');
    expect(poly.geometry.type).toBe('Polygon');
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).toHaveLength(5);
  });

  it('uses GeoJSON [lng, lat] ordering', () => {
    const poly = generateDistrictPolygon(CARTAGENA, 4000);
    const [lng, lat] = poly.geometry.coordinates[0][0];
    expect(lng).toBeLessThan(0);   // Cartagena longitude is negative
    expect(lat).toBeGreaterThan(0); // latitude is positive
  });

  it('generates an area close to the requested size', () => {
    const target = 4000;
    const poly = generateDistrictPolygon(CARTAGENA, target);
    const area = polygonAreaM2(poly);
    // allow generous tolerance for the flat-earth approximation
    expect(area).toBeGreaterThan(target * 0.7);
    expect(area).toBeLessThan(target * 1.4);
  });

  it('bigger requested area yields bigger polygon', () => {
    const small = polygonAreaM2(generateDistrictPolygon(CARTAGENA, 2000));
    const big = polygonAreaM2(generateDistrictPolygon(CARTAGENA, 20000));
    expect(big).toBeGreaterThan(small);
  });
});

describe('polygonToLatLngs', () => {
  it('swaps [lng,lat] back to [lat,lng] for Leaflet', () => {
    const poly = generateDistrictPolygon(CARTAGENA, 4000);
    const latlngs = polygonToLatLngs(poly);
    expect(latlngs[0][0]).toBeGreaterThan(0);  // lat
    expect(latlngs[0][1]).toBeLessThan(0);     // lng
  });

  it('returns [] for a malformed feature', () => {
    expect(polygonToLatLngs({})).toEqual([]);
    expect(polygonToLatLngs(null)).toEqual([]);
  });
});

describe('polygonCentroid', () => {
  it('returns the center for a symmetric polygon', () => {
    const poly = generateDistrictPolygon(CARTAGENA, 4000);
    const [lat, lng] = polygonCentroid(poly);
    expect(lat).toBeCloseTo(CARTAGENA[0], 3);
    expect(lng).toBeCloseTo(CARTAGENA[1], 3);
  });
});

describe('pointInPolygon', () => {
  // a simple square around Cartagena, as [lat,lng]
  const square = [
    [10.40, -75.55],
    [10.40, -75.52],
    [10.44, -75.52],
    [10.44, -75.55],
  ];

  it('detects a point inside', () => {
    expect(pointInPolygon([10.42, -75.535], square)).toBe(true);
  });

  it('detects a point outside', () => {
    expect(pointInPolygon([10.50, -75.535], square)).toBe(false);
    expect(pointInPolygon([10.42, -75.60], square)).toBe(false);
  });
});

describe('polygonsOverlap', () => {
  it('detects overlapping polygons', () => {
    const a = generateDistrictPolygon([10.420, -75.540], 4000);
    const b = generateDistrictPolygon([10.4205, -75.5405], 4000); // very close
    expect(polygonsOverlap(a, b)).toBe(true);
  });

  it('returns false for far-apart polygons', () => {
    const a = generateDistrictPolygon([10.420, -75.540], 4000);
    const b = generateDistrictPolygon([10.460, -75.500], 4000); // far away
    expect(polygonsOverlap(a, b)).toBe(false);
  });
});
