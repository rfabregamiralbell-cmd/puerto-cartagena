// ============================================================
// NAVAL COMBAT ENGINE
// Phase 1: Data model + resolution formula. No real-time battle yet.
// Future: tactical grid combat, boarding, fleet formations.
// ============================================================

import { GameState, addResources } from '../../systems/GameState.js';
import { ShipStatsEngine } from './shipStatsEngine.js';

/**
 * Abstract combat resolution.
 * combatPower = ship.attack + cannons + captainBonus + escortBonus
 * defensePower = hull + defense + crewReadiness + captainBonus
 * risk = routeRisk - escortProtection - portDefenseInfluence
 *
 * Results: victory | minorDamage | majorDamage | cargoLost | shipLost | routeBlocked
 */
export const NavalCombatEngine = {

  /**
   * Resolve a combat encounter between a player ship and an enemy fleet.
   * @param {Object} playerShip - ship instance from GameState.ships
   * @param {Object} enemyFleet - fleet definition from enemy_fleets_config
   * @param {Object} routeContext - { riskLevel, escortShips[], portDefenseScore }
   * @returns {Object} { result, goldMod, hullDamage, message }
   */
  resolveCombat(playerShip, enemyFleet, routeContext = {}) {
    const shipStats = ShipStatsEngine.getEffectiveStats(playerShip);
    const captain = GameState.captains.find(c => c.id === playerShip.captainId);

    const captainBonus = captain ? captain.combatBonus || 0 : 0;
    const escortBonus = this._calcEscortBonus(routeContext.escortShips || []);
    const portInfluence = (routeContext.portDefenseScore || 0) * 0.1;

    const combatPower = shipStats.attack + shipStats.cannons + captainBonus + escortBonus;
    const defensePower = shipStats.hull + shipStats.defense + captainBonus;
    const risk = this._riskValue(routeContext.riskLevel) - escortBonus - portInfluence;

    const roll = Math.random() * 100;
    const advantage = combatPower - enemyFleet.stats.attack + defensePower - enemyFleet.stats.defense - risk;

    return this._determineOutcome(roll, advantage, playerShip);
  },

  /**
   * Resolve a port raid (enemy attacks the city directly).
   * @param {Object} enemyFleet
   * @param {number} portDefenseScore
   * @returns {Object} { result, goldLost, resourceDamage, message }
   */
  resolvePortRaid(enemyFleet, portDefenseScore) {
    const defense = portDefenseScore + (GameState.defense.artilleryPower || 0);
    const attackPower = enemyFleet.threat;

    if (defense >= attackPower * 1.5) {
      return { result: 'repelled', goldLost: 0, resourceDamage: {}, message: '¡Ataque repelido! Las defensas del puerto aguantaron.' };
    } else if (defense >= attackPower) {
      const goldLost = Math.floor(GameState.resources.oro.amount * 0.1);
      return { result: 'minorDamage', goldLost, resourceDamage: {}, message: `Ataque parcialmente repelido. Perdiste ${goldLost} oro.` };
    } else {
      const goldLost = Math.floor(GameState.resources.oro.amount * 0.25);
      const maderaLost = Math.floor(GameState.resources.madera.amount * 0.2);
      return { result: 'majorDamage', goldLost, resourceDamage: { madera: maderaLost }, message: `¡Puerto saqueado! Perdiste ${goldLost} oro y recursos.` };
    }
  },

  // ── Private helpers ────────────────────────────────────────

  _calcEscortBonus(escortShips) {
    return escortShips.reduce((sum, ship) => {
      const stats = ShipStatsEngine.getEffectiveStats(ship);
      return sum + Math.floor(stats.attack * 0.5);
    }, 0);
  },

  _riskValue(riskLevel) {
    const map = { low: 10, medium: 30, high: 60 };
    return map[riskLevel] || 10;
  },

  _determineOutcome(roll, advantage, ship) {
    // advantage > 0 favors player, < 0 favors enemy
    const threshold = 50 + Math.min(Math.max(advantage, -40), 40);

    if (roll > threshold + 20) {
      return { result: 'victory', goldMod: 0, hullDamage: 5, message: '¡Victoria naval! El enemigo huye.' };
    } else if (roll > threshold) {
      return { result: 'minorDamage', goldMod: -0.1, hullDamage: 15, message: 'Combate exitoso con daños menores.' };
    } else if (roll > threshold - 20) {
      return { result: 'majorDamage', goldMod: -0.3, hullDamage: 35, message: 'Daños severos en el casco. Reparaciones necesarias.' };
    } else if (roll > threshold - 35) {
      return { result: 'cargoLost', goldMod: -0.5, hullDamage: 20, message: 'El enemigo saqueó parte de la carga.' };
    } else {
      return { result: 'shipLost', goldMod: -1.0, hullDamage: ship.stats.maxHull, message: `¡${ship.name} hundido! Tripulación perdida.` };
    }
  },

  // ── Future hooks (Phase 2+) ────────────────────────────────

  /** TODO Phase 2: Real-time tactical grid combat */
  initTacticalBattle(_playerFleet, _enemyFleet) {
    console.warn('[NavalCombatEngine] Tactical battle not implemented in Phase 1.');
  },

  /** TODO Phase 2: Blockade resolution system */
  resolveBlockade(_routeId, _blockadeFleet) {
    console.warn('[NavalCombatEngine] Blockade system not implemented in Phase 1.');
  },

  /** TODO Phase 3: Boarding actions */
  resolveBoarding(_attackerShip, _defenderShip) {
    console.warn('[NavalCombatEngine] Boarding not implemented in Phase 1.');
  },
};
