// ============================================================
// PORT DEFENSE ENGINE
// Calculates and updates port defense score from all sources.
// ============================================================

import GameState from '../../systems/GameState.js';

export const PortDefenseEngine = {

  /**
   * Recalculate and update GameState.defense from current game state.
   * Call after any building change, ship assignment change, or resource change.
   */
  recalculate() {
    const d = GameState.defense;

    d.artilleryPower    = this._calcArtillery();
    d.garrisonStrength  = this._calcGarrison();
    d.navalPatrolStrength = this._calcNavalPatrol();
    d.coastalCoverage   = this._calcCoastalCoverage();
    d.supplyReadiness   = this._calcSupplyReadiness();
    d.defenseScore      = this._calcTotalDefense(d);
    d.raidRisk          = this._calcRaidRisk(d.defenseScore);
    d.blockadeRisk      = this._calcBlockadeRisk(d.defenseScore);

    return d;
  },

  // ── Component calculators ────────────────────────────────

  _calcArtillery() {
    const canones = GameState.resources.canones.amount;
    const polvora = GameState.resources.polvora.amount;
    const hasArsenal = GameState.buildings.some(b => b.buildingId === 'arsenal');
    const arsenalLevel = this._getBuildingLevel('arsenal');

    let power = Math.floor(canones * 0.5) + Math.floor(polvora * 0.2);
    if (hasArsenal) power += arsenalLevel * 5;
    return Math.min(power, 40);
  },

  _calcGarrison() {
    const tripulacion = GameState.resources.tripulacion.amount;
    // Only shore-based crew counts (ships at port)
    const idleShipCrew = GameState.ships
      .filter(s => s.status === 'idle' || s.status === 'repairing')
      .reduce((sum, s) => sum + (s.stats.crewRequired || 0), 0);
    return Math.min(Math.floor((tripulacion - idleShipCrew) * 0.3), 20);
  },

  _calcNavalPatrol() {
    const patrolShips = GameState.ships.filter(s => s.status === 'idle');
    return Math.min(patrolShips.length * 8, 30);
  },

  _calcCoastalCoverage() {
    const fortalezaLevel = this._getBuildingLevel('fortaleza');
    const radii = [0, 150, 250, 400];
    return radii[Math.min(fortalezaLevel, 3)];
  },

  _calcSupplyReadiness() {
    const polvora  = GameState.resources.polvora.amount;
    const canones  = GameState.resources.canones.amount;
    const hasAlmacen = GameState.buildings.some(b => b.buildingId === 'almacen');
    let score = Math.min(polvora * 0.5 + canones * 1, 20);
    if (hasAlmacen) score *= 1.2;
    return Math.round(Math.min(score, 20));
  },

  _calcTotalDefense(d) {
    const base = 5;
    const fortalezaBonus = this._getBuildingLevel('fortaleza') * 10;
    const total = base
      + fortalezaBonus
      + d.artilleryPower
      + d.garrisonStrength
      + d.navalPatrolStrength
      + d.supplyReadiness;
    return Math.min(Math.round(total), 100);
  },

  _calcRaidRisk(defenseScore) {
    if (defenseScore >= 60) return 'none';
    if (defenseScore >= 35) return 'low';
    if (defenseScore >= 15) return 'medium';
    return 'high';
  },

  _calcBlockadeRisk(defenseScore) {
    if (defenseScore >= 70) return 'none';
    if (defenseScore >= 45) return 'low';
    return 'medium';
  },

  // ── Helpers ───────────────────────────────────────────────

  _getBuildingLevel(buildingId) {
    const buildings = GameState.buildings.filter(b => b.buildingId === buildingId);
    if (!buildings.length) return 0;
    return Math.max(...buildings.map(b => b.level));
  },

  // ── Future hooks ─────────────────────────────────────────

  /** TODO Phase 2: Terrain-based defense modifications */
  applyTerrainModifiers() {
    console.warn('[PortDefenseEngine] Terrain modifiers delegated to terrainDefenseEngine.');
  },

  /** TODO Phase 2: Captain garrison bonuses */
  applyCaptainGarrisonBonus(_captainId) {
    console.warn('[PortDefenseEngine] Captain garrison bonus not implemented in Phase 1.');
  },
};
