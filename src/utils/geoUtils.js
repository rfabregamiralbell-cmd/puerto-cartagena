// ============================================================
// GEO UTILS
// Helpers for GeoJSON polygons, area, distance, point-in-polygon.
// All coords are [lat, lng] for Leaflet unless noted.
// ============================================================

const EARTH_RADIUS_M = 6371000;

/** Haversine distance in meters between two [lat,lng] points. */
export function distanceM([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Generate a roughly-square district polygon centered on a point.
 * @param {[number,number]} center [lat,lng]
 * @param {number} areaM2 desired area
 * @returns {GeoJSON Feature} polygon with [lng,lat] coords (GeoJSON order)
 */
export function generateDistrictPolygon(center, areaM2 = 4000) {
  const [lat, lng] = center;
  const sideM = Math.sqrt(areaM2);
  // meters → degrees (approx at this latitude)
  const dLat = (sideM / 2) / 111320;
  const dLng = (sideM / 2) / (111320 * Math.cos((lat * Math.PI) / 180));

  // GeoJSON uses [lng, lat] and must be closed (first === last)
  const ring = [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  };
}

/** Convert a GeoJSON polygon Feature into Leaflet [lat,lng] positions. */
export function polygonToLatLngs(feature) {
  if (!feature?.geometry?.coordinates?.[0]) return [];
  return feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

/** Approximate polygon area in m² using the shoelace formula on a local projection. */
export function polygonAreaM2(feature) {
  const ring = feature?.geometry?.coordinates?.[0];
  if (!ring || ring.length < 4) return 0;
  const lat0 = ring[0][1];
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    const x1 = lng1 * mPerDegLng, y1 = lat1 * mPerDegLat;
    const x2 = lng2 * mPerDegLng, y2 = lat2 * mPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

/** Centroid of a GeoJSON polygon → [lat,lng] (for the main building marker). */
export function polygonCentroid(feature) {
  const ring = feature?.geometry?.coordinates?.[0];
  if (!ring) return null;
  let lat = 0, lng = 0, n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    lng += ring[i][0];
    lat += ring[i][1];
  }
  return [lat / n, lng / n];
}

/** Point-in-polygon test. point [lat,lng], polygon as array of [lat,lng]. */
export function pointInPolygon([lat, lng], polygonLatLngs) {
  let inside = false;
  for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
    const [yi, xi] = polygonLatLngs[i];
    const [yj, xj] = polygonLatLngs[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Do two GeoJSON polygons overlap? (cheap bbox + vertex test) */
export function polygonsOverlap(featA, featB) {
  const a = polygonToLatLngs(featA);
  const b = polygonToLatLngs(featB);
  if (!a.length || !b.length) return false;
  // If any vertex of A is inside B, or vice versa → overlap
  if (a.some((p) => pointInPolygon(p, b))) return true;
  if (b.some((p) => pointInPolygon(p, a))) return true;
  return false;
}
