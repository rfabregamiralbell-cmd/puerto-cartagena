// ============================================================
// ROUTE RISK ENGINE
// Calculates effective risk for trade routes considering all modifiers.
// ============================================================

import GameState from '../../systems/GameState.js';

const BASE_RISK = { low: 0.08, medium: 0.22, high: 0.45 };

export const RouteRiskEngine = {

  /**
   * Compute effective risk score (0-1) for a route.
   * Considers: base risk, escort ships, port defense, captain, weather.
   */
  getEffectiveRisk(route, assignedShip = null) {
    if (!route) return 1;

    let risk = BASE_RISK[route.riskLevel] || 0.1;

    // Escort reduction
    const escort = this._getEscortReduction(assignedShip);
    risk -= escort;

    // Port defense reduction (up to -0.15)
    const defenseScore = GameState.defense.defenseScore || 0;
    risk -= Math.min(defenseScore / 100 * 0.15, 0.15);

    // Captain trade bonus reduction
    if (assignedShip) {
      const captain = GameState.captains.find(c => c.id === assignedShip.captainId);
      if (captain && captain.tradeBonus) risk -= captain.tradeBonus * 0.01;
    }

    // Fortaleza bonus
    if (GameState.buildings.some(b => b.buildingId === 'fortaleza')) {
      risk -= 0.05;
    }

    return Math.max(0.02, Math.min(risk, 0.95));
  },

  /**
   * Roll to see if a random event triggers on this route.
   * @returns {string|null} eventId or null
   */
  rollForEvent(route, assignedShip = null) {
    const risk = this.getEffectiveRisk(route, assignedShip);
    const roll = Math.random();

    if (roll < risk * 0.4)  return 'pirate_raid';
    if (roll < risk * 0.6)  return 'storm';
    if (roll < risk * 0.65 && route.riskLevel === 'high') return 'enemy_fleet';
    if (roll > 0.88)        return 'merchant_opportunity'; // positive event
    return null;
  },

  /**
   * Get a human-readable risk label and color.
   */
  getRiskDisplay(route, assignedShip = null) {
    const r = this.getEffectiveRisk(route, assignedShip);
    if (r < 0.10) return { label: 'Muy Bajo', color: '#27ae60' };
    if (r < 0.20) return { label: 'Bajo',     color: '#2ecc71' };
    if (r < 0.35) return { label: 'Medio',    color: '#f39c12' };
    if (r < 0.55) return { label: 'Alto',     color: '#e67e22' };
    return           { label: 'Peligroso', color: '#e74c3c' };
  },

  // ── Private ────────────────────────────────────────────────

  _getEscortReduction(ship) {
    if (!ship) return 0;
    const escortTypes = ['warship', 'combat_merchant'];
    if (escortTypes.includes(ship.type)) return 0.08;
    return 0;
  },

  // ── Future hooks ─────────────────────────────────────────

  /** TODO Phase 2: Diplomatic modifiers (treaties, war declarations) */
  applyDiplomaticModifiers(_route, _diplomacyState) {
    console.warn('[RouteRiskEngine] Diplomatic modifiers not implemented in Phase 1.');
  },

  /** TODO Phase 2: Seasonal weather patterns */
  applySeasonalWeather(_route, _season) {
    console.warn('[RouteRiskEngine] Seasonal weather not implemented in Phase 1.');
  },
};
