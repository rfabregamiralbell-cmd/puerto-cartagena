// ============================================================
// PROFIT ENGINE
// Calculates trade route profits with all modifiers.
// ============================================================

import GameState from '../../systems/GameState.js';

export const ProfitEngine = {

  /**
   * Calculate final gold profit for a completed route.
   * Modifiers: cargo capacity, captain trade bonus, port level,
   *            aduana presence, event penalty/bonus.
   */
  calculateProfit(route, ship, modifiers = {}) {
    let base = route.profitBase;

    // Cargo capacity ratio (larger ship = more goods moved)
    const cargoRatio = Math.min(ship.stats.cargoCapacity / 100, 1.5);
    base *= cargoRatio;

    // Port level bonus (+10% per level above requirement)
    const portBonus = 1 + (GameState.port.level - route.requiredPortLevel) * 0.1;
    base *= Math.max(portBonus, 1);

    // Aduana bonus (+25% if built)
    const hasAduana = GameState.buildings.some(b => b.buildingId === 'aduana');
    if (hasAduana) base *= 1.25;

    // Captain trade bonus
    const captain = GameState.captains.find(c => c.id === ship.captainId);
    if (captain && captain.tradeBonus) base *= 1 + captain.tradeBonus * 0.01;

    // Event modifiers
    if (modifiers.penalty) base *= (1 + modifiers.penalty); // penalty is negative
    if (modifiers.bonus)   base *= (1 + modifiers.bonus);

    // Route distance scaling (longer = more base profit already in config)
    // Additional bonus for very long routes (Sevilla, Cádiz)
    if (route.distance > 5000) base *= 1.2;

    const finalGold = Math.max(0, Math.round(base));

    return {
      gold: finalGold,
      breakdown: {
        base: route.profitBase,
        afterCargo: Math.round(route.profitBase * cargoRatio),
        afterPort: Math.round(route.profitBase * cargoRatio * portBonus),
        afterAduana: hasAduana ? Math.round(route.profitBase * cargoRatio * portBonus * 1.25) : null,
        final: finalGold,
      },
    };
  },

  /**
   * Estimate profit for UI display (before route completion).
   */
  estimateProfit(route, ship) {
    if (!ship) return { gold: route?.profitBase || 0, breakdown: null };
    return this.calculateProfit(route, ship, {});
  },

  // ── Future hooks ─────────────────────────────────────────

  /** TODO Phase 2: Luxury goods price fluctuation */
  applyMarketPrices(_route, _marketState) {
    console.warn('[ProfitEngine] Market price system not implemented in Phase 1.');
  },

  /** TODO Phase 2: Cargo manifest (specific goods per route) */
  resolveCargoManifest(_route, _ship) {
    console.warn('[ProfitEngine] Cargo manifest not implemented in Phase 1.');
  },
};
