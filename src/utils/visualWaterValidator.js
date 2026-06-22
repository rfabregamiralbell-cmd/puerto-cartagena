// ============================================================
// VISUAL WATER VALIDATOR
// Phase 1: simplified water/coast detection using predefined zones
// from map_config. Later replaceable by real GIS / tile sampling.
// ============================================================

import mapConfig from '../config/map_config.json';
import { distanceM, pointInPolygon } from './geoUtils.js';

const COAST_THRESHOLD_M = 350; // within this distance of water = "coast"

/**
 * Classify a [lat,lng] point as 'water' | 'coast' | 'land'.
 */
export function classifyTerrain([lat, lng]) {
  const inWater = mapConfig.waterZones.some((zone) =>
    pointInPolygon([lat, lng], zone.polygon)
  );
  if (inWater) return 'water';

  // Distance to nearest water edge (approx via zone vertices)
  let minDist = Infinity;
  mapConfig.waterZones.forEach((zone) => {
    zone.polygon.forEach((pt) => {
      const d = distanceM([lat, lng], pt);
      if (d < minDist) minDist = d;
    });
  });

  return minDist <= COAST_THRESHOLD_M ? 'coast' : 'land';
}

/**
 * Validate whether a district type can be built at a point based on terrain.
 * @returns {{ ok: boolean, terrain: string, reason?: string }}
 */
export function validateTerrainForType(point, terrainRequirement) {
  const terrain = classifyTerrain(point);

  switch (terrainRequirement) {
    case 'water':
      return terrain === 'water'
        ? { ok: true, terrain }
        : { ok: false, terrain, reason: 'Debe construirse sobre el agua.' };

    case 'coast':
      if (terrain === 'water') return { ok: false, terrain, reason: 'El Puerto no puede estar dentro del agua, debe tocar la costa.' };
      return terrain === 'coast'
        ? { ok: true, terrain }
        : { ok: false, terrain, reason: 'El Puerto debe estar junto a la costa.' };

    case 'coast_near':
      if (terrain === 'water') return { ok: false, terrain, reason: 'No se puede construir sobre el agua.' };
      return { ok: true, terrain }; // prefers coast but allows land

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
      return { ok: true, terrain }; // defensive value scored separately

    default:
      return terrain === 'water'
        ? { ok: false, terrain, reason: 'No se puede construir sobre el agua.' }
        : { ok: true, terrain };
  }
}
