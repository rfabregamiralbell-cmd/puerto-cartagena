// ============================================================
// VISUAL WATER VALIDATOR
// Phase A+: water/coast detection using point-to-EDGE distance against
// predefined water zones (more accurate than vertex distance), plus a
// permissive Puerto rule (near water, polygon touches water, near
// portStart, or inside the predefined port area).
// Later replaceable by real GIS / tile sampling.
// ============================================================

import mapConfig from '../config/map_config.json';
import { distanceM, pointInPolygon, polygonToLatLngs } from './geoUtils.js';

const COAST_THRESHOLD_M = 500; // within this distance of water = "coast"

// Distance (m) from a point to a segment a-b, all [lat,lng].
function pointToSegmentM(p, a, b) {
  // Work in a local meter plane around p
  const lat0 = p[0];
  const mLat = 111320, mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const P = [0, 0];
  const A = [(a[1] - p[1]) * mLng, (a[0] - p[0]) * mLat];
  const B = [(b[1] - p[1]) * mLng, (b[0] - p[0]) * mLat];
  const ABx = B[0] - A[0], ABy = B[1] - A[1];
  const APx = P[0] - A[0], APy = P[1] - A[1];
  const ab2 = ABx * ABx + ABy * ABy;
  let t = ab2 ? (APx * ABx + APy * ABy) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = A[0] + t * ABx, cy = A[1] + t * ABy;
  return Math.hypot(P[0] - cx, P[1] - cy);
}

/** Shortest distance (m) from a point to any water-zone edge. 0 if inside. */
export function distanceToWaterM([lat, lng]) {
  if (mapConfig.waterZones.some((z) => pointInPolygon([lat, lng], z.polygon))) return 0;
  let min = Infinity;
  mapConfig.waterZones.forEach((z) => {
    const ring = z.polygon;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const d = pointToSegmentM([lat, lng], a, b);
      if (d < min) min = d;
    }
  });
  return min;
}

/** Classify a [lat,lng] point as 'water' | 'coast' | 'land'. */
export function classifyTerrain([lat, lng]) {
  const d = distanceToWaterM([lat, lng]);
  if (d === 0) return 'water';
  return d <= COAST_THRESHOLD_M ? 'coast' : 'land';
}

/** Is the point inside the predefined valid port area? */
function inPortArea([lat, lng]) {
  const pa = mapConfig.portArea;
  if (!pa) return false;
  return distanceM([lat, lng], pa.center) <= pa.radiusM;
}

/** Is the point near portStart? */
function nearPortStart([lat, lng], thresholdM = 600) {
  return mapConfig.portStart && distanceM([lat, lng], mapConfig.portStart) <= thresholdM;
}

/** Does a GeoJSON polygon touch a water zone (any vertex inside water)? */
function polygonTouchesWater(polygon) {
  if (!polygon) return false;
  const latlngs = polygonToLatLngs(polygon);
  return latlngs.some((pt) => mapConfig.waterZones.some((z) => pointInPolygon(pt, z.polygon)))
      || latlngs.some((pt) => distanceToWaterM(pt) <= 150);
}

/**
 * Validate whether a district type can be built at a point.
 * @param {[number,number]} point [lat,lng]
 * @param {string} terrainRequirement
 * @param {object} ctx  optional { polygon } for proximity tests
 * @returns {{ ok:boolean, terrain:string, reason?:string }}
 */
export function validateTerrainForType(point, terrainRequirement, ctx = {}) {
  const terrain = classifyTerrain(point);

  switch (terrainRequirement) {
    case 'water':
      return terrain === 'water'
        ? { ok: true, terrain }
        : { ok: false, terrain, reason: 'Debe construirse sobre el agua.' };

    case 'coast': {
      // PUERTO — permissive: accept if any of these hold.
      const touchesWater = polygonTouchesWater(ctx.polygon);
      const ok =
        terrain === 'coast' ||
        touchesWater ||
        nearPortStart(point) ||
        inPortArea(point);
      // Still reject if fully landlocked AND deep inland
      if (terrain === 'water' && !touchesWater) {
        return { ok: false, terrain, reason: 'El Puerto debe tocar la costa, no estar mar adentro.' };
      }
      return ok
        ? { ok: true, terrain }
        : { ok: false, terrain, reason: 'El Puerto debe estar junto a la costa o en la zona portuaria.' };
    }

    case 'coast_near':
      if (terrain === 'water') return { ok: false, terrain, reason: 'No se puede construir sobre el agua.' };
      return { ok: true, terrain }; // prefers coast, allows land

    case 'land':
      return terrain === 'water'
        ? { ok: false, terrain, reason: 'No se puede construir sobre el agua.' }
        : { ok: true, terrain };

    case 'land_open':
      if (terrain === 'water') return { ok: false, terrain, reason: 'La Hacienda no puede ir sobre el agua.' };
      if (terrain === 'coast') return { ok: false, terrain, reason: 'La Hacienda necesita tierra abierta, no costa.' };
      return { ok: true, terrain };

    case 'defensive':
      if (terrain === 'water') return { ok: false, terrain, reason: 'La Fortaleza no puede ir sobre el agua.' };
      return { ok: true, terrain };

    default:
      return terrain === 'water'
        ? { ok: false, terrain, reason: 'No se puede construir sobre el agua.' }
        : { ok: true, terrain };
  }
}
