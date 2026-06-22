// ============================================================
// COMPATIBILITY SHIM (Phase 2 prep)
// The naval/trade/defense engines were written against a standalone
// GameState module. In the React project, the real state lives in
// src/state/ (reducer + context). These engines are NOT wired into the
// React build yet — they are reference implementations for the combat/
// trade phase and will be refactored into pure functions that receive
// state as an argument.
//
// This shim exists ONLY so those files resolve their imports and the
// project stays build-safe. Do not rely on it as live game state.
// ============================================================

export const GameState = {
  resources: {},
  buildings: [],
  ships: [],
  activeRoutes: [],
  captains: [],
  defense: {},
  port: { level: 1 },
  notifications: [],
};

export function addResources() { /* no-op in shim */ }
export function addPortXP()    { /* no-op in shim */ }
export function hasResources() { return false; }
export function spendResources() { return false; }
export function getBuildingsByType() { return []; }
export function hasBuilding() { return false; }
export function getHighestBuildingLevel() { return 0; }

export default GameState;
