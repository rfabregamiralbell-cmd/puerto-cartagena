// ============================================================
// SHIP STATS ENGINE
// Computes effective ship stats factoring upgrades, damage, captain bonuses.
// ============================================================

import GameState from '../../systems/GameState.js';

export const ShipStatsEngine = {

  /**
   * Get effective stats for a ship instance, applying:
   * - base stats from config
   * - upgrade bonuses
   * - hull damage penalty
   * - captain bonuses
   */
  getEffectiveStats(ship) {
    if (!ship || !ship.stats) return {};

    const base = { ...ship.stats };
    const upgrades = ship.upgrades || [];
    const captain = GameState.captains.find(c => c.id === ship.captainId);

    // Apply upgrades
    upgrades.forEach(upgrade => {
      Object.entries(upgrade.effect || {}).forEach(([stat, val]) => {
        if (base[stat] !== undefined) base[stat] += val;
      });
    });

    // Hull damage penalty: below 50% hull → speed and attack reduced
    const hullPercent = base.hull / base.maxHull;
    if (hullPercent < 0.5) {
      base.speed = parseFloat((base.speed * 0.7).toFixed(2));
      base.attack = Math.floor(base.attack * 0.8);
    }
    if (hullPercent < 0.25) {
      base.speed = parseFloat((base.speed * 0.5).toFixed(2));
    }

    // Captain bonuses
    if (captain) {
      base.attack  += captain.combatBonus  || 0;
      base.speed   += captain.speedBonus   || 0;
      base.defense += captain.defenseBonus || 0;
    }

    // Cannon effectiveness: can't use more cannons than ship has
    base.cannons = Math.min(
      GameState.resources.canones.amount,
      base.cannonsRequired
    );

    return base;
  },

  /**
   * Apply hull damage to a ship instance.
   * @returns {string} 'alive' | 'damaged' | 'sunk'
   */
  applyHullDamage(ship, damage) {
    ship.stats.hull = Math.max(0, ship.stats.hull - damage);
    if (ship.stats.hull <= 0) {
      ship.status = 'sunk';
      return 'sunk';
    } else if (ship.stats.hull < ship.stats.maxHull * 0.3) {
      ship.status = 'damaged';
      return 'damaged';
    }
    return 'alive';
  },

  /**
   * Calculate repair cost for a ship.
   */
  getRepairCost(ship) {
    const missingHull = ship.stats.maxHull - ship.stats.hull;
    const ratio = missingHull / ship.stats.maxHull;
    return {
      oro:    Math.ceil(ratio * 50),
      madera: Math.ceil(ratio * 20),
    };
  },

  /**
   * Repair a ship (costs resources, restores hull).
   */
  repairShip(ship) {
    ship.stats.hull = ship.stats.maxHull;
    ship.status = 'idle';
    return ship;
  },

  /**
   * Get speed in pixels/ms for map animation.
   * Base: 0.04 px/ms per speed unit.
   */
  getPixelSpeed(ship, canvasWidth) {
    const stats = this.getEffectiveStats(ship);
    return (stats.speed || 1.0) * 0.04 * (canvasWidth / 800);
  },

  // ── Future hooks ─────────────────────────────────────────

  /** TODO Phase 2: Formation bonuses for fleet groups */
  getFormationBonus(_ships) {
    console.warn('[ShipStatsEngine] Formation bonuses not implemented in Phase 1.');
    return 0;
  },
};
