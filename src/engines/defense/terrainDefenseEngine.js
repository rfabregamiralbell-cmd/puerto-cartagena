// ============================================================
// TERRAIN DEFENSE ENGINE (LiDAR-style, simplified)
// Evaluates a [lat,lng] position for defensive value using
// simulated elevation / line-of-sight / coastal / chokepoint scores.
// ============================================================

import mapConfig from '../../config/map_config.json';
import { distanceM } from '../../utils/geoUtils.js';
import { classifyTerrain } from '../../utils/visualWaterValidator.js';

// Helper: influence falls off with distance within a radius (in degrees-ish).
function proximityScore(point, features, key) {
  let best = 0;
  features.forEach((f) => {
    const d = distanceM(point, f.coord);
    const radiusM = (f.radius || 0.01) * 111320; // deg→m approx
    if (d < radiusM) {
      const falloff = 1 - d / radiusM;
      best = Math.max(best, (f[key] ?? 1) * falloff);
    }
  });
  return Math.min(best, 1);
}

export const TerrainDefenseEngine = {

  /**
   * Evaluate a position. Returns LiDAR-style scores + final defensiveValue.
   * @param {[number,number]} point [lat,lng]
   */
  evaluate(point) {
    const terrain = classifyTerrain(point);

    // Elevation / line of sight from simulated high ground
    const elevationScore = proximityScore(point, mapConfig.highGround, 'elevation');
    const lineOfSight = Math.min(elevationScore * 1.1, 1);

    // Coastal coverage: relevant near coast/water
    let coastalCoverage = 0;
    if (terrain === 'coast') coastalCoverage = 0.8;
    else if (terrain === 'water') coastalCoverage = 1.0;
    else coastalCoverage = 0.2;

    // Chokepoint value from strategic naval approaches
    const chokepointValue = proximityScore(point, mapConfig.chokepoints, 'value');

    // Slope: approximated inverse of elevation extremes (flat exposed = low)
    const slopeScore = elevationScore > 0.5 ? 0.6 : 0.3;

    // Final formula from the design doc
    const defensiveValue = Math.round(
      elevationScore * 30 +
      lineOfSight * 30 +
      coastalCoverage * 25 +
      chokepointValue * 15
    );

    const warnings = [];
    if (terrain === 'water') warnings.push('Posición sobre el agua: no edificable.');
    if (elevationScore < 0.2 && coastalCoverage < 0.3) warnings.push('Terreno llano y expuesto.');

    return {
      terrain,
      elevationScore: +elevationScore.toFixed(2),
      slopeScore: +slopeScore.toFixed(2),
      lineOfSight: +lineOfSight.toFixed(2),
      coastalCoverage: +coastalCoverage.toFixed(2),
      chokepointValue: +chokepointValue.toFixed(2),
      defensiveValue,
      warnings,
    };
  },

  /**
   * Human-readable verdict for Fortaleza placement.
   */
  verdict(defensiveValue) {
    if (defensiveValue >= 65) return { label: 'Posición defensiva excelente', tier: 'excellent', color: '#27ae60' };
    if (defensiveValue >= 40) return { label: 'Posición defensiva aceptable', tier: 'acceptable', color: '#f39c12' };
    return { label: 'Posición defensiva débil', tier: 'weak', color: '#e74c3c' };
  },

  /**
   * Coverage radius (meters) a Fortaleza provides based on its terrain.
   */
  coverageRadiusM(point, level = 1) {
    const evalRes = this.evaluate(point);
    const base = 200 + level * 150;
    return Math.round(base * (1 + evalRes.lineOfSight));
  },
};
