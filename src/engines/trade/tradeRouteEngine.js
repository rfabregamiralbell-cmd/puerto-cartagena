// ============================================================
// TRADE ROUTE ENGINE
// Manages route lifecycle: assign, start, tick progress, complete.
// ============================================================

import GameState, { addResources, addPortXP } from '../../systems/GameState.js';
import { ProfitEngine } from './profitEngine.js';
import { RouteRiskEngine } from '../naval/routeRiskEngine.js';
import { NavalCombatEngine } from '../naval/navalCombatEngine.js';

export const TradeRouteEngine = {

  /**
   * Assign a ship to a route and start it.
   * @param {string} routeId
   * @param {string} shipId
   * @returns {{ ok: boolean, message: string }}
   */
  startRoute(routeId, shipId) {
    const route = this._getRouteConfig(routeId);
    const ship  = GameState.ships.find(s => s.id === shipId);

    if (!route) return { ok: false, message: 'Ruta no encontrada.' };
    if (!ship)  return { ok: false, message: 'Barco no encontrado.' };
    if (ship.status !== 'idle') return { ok: false, message: `${ship.name} no está disponible.` };
    if (route.status === 'locked') return { ok: false, message: 'Ruta bloqueada.' };

    // Check port level requirement
    if (GameState.port.level < route.requiredPortLevel) {
      return { ok: false, message: `Requiere Puerto nivel ${route.requiredPortLevel}.` };
    }

    // Check ship type compatibility
    if (!route.requiredShipTypes.includes(ship.type)) {
      return { ok: false, message: `${ship.name} no es compatible con esta ruta.` };
    }

    // Consume crew
    if (GameState.resources.tripulacion.amount < ship.stats.crewRequired) {
      return { ok: false, message: 'Tripulación insuficiente.' };
    }
    GameState.resources.tripulacion.amount -= ship.stats.crewRequired;

    // Mark ship
    ship.status = 'assignedToRoute';
    ship.currentRouteId = routeId;

    // Create active route entry
    const entry = {
      id: `ar_${Date.now()}`,
      routeId,
      shipId,
      startTime: Date.now(),
      durationMs: route.durationMs,
      progress: 0,
      returning: false,
      status: 'active',
    };
    GameState.activeRoutes.push(entry);

    return { ok: true, message: `${ship.name} ha zarpado hacia ${route.destinationPort}.` };
  },

  /**
   * Tick all active routes. Call from game loop.
   */
  tickRoutes(now) {
    GameState.activeRoutes.forEach(entry => {
      if (entry.status !== 'active') return;

      const elapsed = now - entry.startTime;
      entry.progress = Math.min(elapsed / entry.durationMs, 1);

      if (entry.progress >= 1) {
        if (!entry.returning) {
          this._onRouteArrival(entry);
        } else {
          this._onRouteReturn(entry);
        }
      }
    });

    // Clean up completed routes
    GameState.activeRoutes = GameState.activeRoutes.filter(e => e.status !== 'completed');
  },

  // ── Private ────────────────────────────────────────────────

  _onRouteArrival(entry) {
    const route = this._getRouteConfig(entry.routeId);
    const ship  = GameState.ships.find(s => s.id === entry.shipId);
    if (!route || !ship) return;

    // Roll for event
    const eventId = RouteRiskEngine.rollForEvent(route, ship);
    if (eventId && eventId !== 'merchant_opportunity') {
      const enemyFleet = { stats: { attack: 15, defense: 8, hull: 40 }, threat: 20 };
      const combatResult = NavalCombatEngine.resolveCombat(ship, enemyFleet, {
        riskLevel: route.riskLevel,
        portDefenseScore: GameState.defense.defenseScore,
      });

      if (combatResult.result === 'shipLost') {
        this._loseShip(ship, entry);
        GameState.notifications.push({
          id: Date.now(), type: 'danger',
          message: combatResult.message, duration: 5000,
        });
        return;
      }

      // Apply damage
      ship.stats.hull = Math.max(1, ship.stats.hull - combatResult.hullDamage);
      entry.eventPenalty = combatResult.goldMod;

      GameState.notifications.push({
        id: Date.now(), type: 'warning',
        message: combatResult.message, duration: 4000,
      });
    }

    // Return trip
    entry.returning = true;
    entry.startTime = Date.now();
    entry.progress = 0;

    // Positive event bonus stored for return
    if (eventId === 'merchant_opportunity') {
      entry.eventBonus = 0.5;
    }
  },

  _onRouteReturn(entry) {
    const route = this._getRouteConfig(entry.routeId);
    const ship  = GameState.ships.find(s => s.id === entry.shipId);
    if (!route || !ship) return;

    // Calculate profit
    const profit = ProfitEngine.calculateProfit(route, ship, {
      penalty: entry.eventPenalty || 0,
      bonus: entry.eventBonus || 0,
    });

    addResources({ oro: profit.gold });
    addPortXP(Math.floor(profit.gold * 0.1));

    // Return crew
    GameState.resources.tripulacion.amount = Math.min(
      GameState.resources.tripulacion.amount + ship.stats.crewRequired,
      GameState.resources.tripulacion.max
    );

    // Reset ship
    ship.status = ship.stats.hull < ship.stats.maxHull * 0.3 ? 'damaged' : 'idle';
    ship.currentRouteId = null;

    entry.status = 'completed';

    GameState.notifications.push({
      id: Date.now(), type: 'success',
      message: `${ship.name} regresó de ${route.destinationPort}. +${profit.gold} oro.`,
      duration: 4000,
    });
  },

  _loseShip(ship, entry) {
    ship.status = 'sunk';
    ship.currentRouteId = null;
    entry.status = 'completed';
    // Return partial crew
    GameState.resources.tripulacion.amount = Math.min(
      GameState.resources.tripulacion.amount + Math.floor(ship.stats.crewRequired * 0.3),
      GameState.resources.tripulacion.max
    );
  },

  _getRouteConfig(routeId) {
    // Loaded at runtime from trade_routes_config.json via GameContext
    return window.__routeConfigs?.find(r => r.id === routeId) || null;
  },

  // ── Future hooks ─────────────────────────────────────────

  /** TODO Phase 2: Convoy system (multiple ships same route) */
  startConvoy(_routeId, _shipIds, _escortIds) {
    console.warn('[TradeRouteEngine] Convoy system not implemented in Phase 1.');
  },

  /** TODO Phase 2: Blockade detection and rerouting */
  checkBlockade(_routeId) {
    console.warn('[TradeRouteEngine] Blockade check not implemented in Phase 1.');
  },
};
