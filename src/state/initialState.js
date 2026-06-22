// ============================================================
// INITIAL STATE
// Factory for a fresh game state. Districts replace "buildings".
// ============================================================

import mapConfig from '../config/map_config.json';

export function createInitialState() {
  return {
    version: '0.2.0',
    tick: 0,

    port: {
      name: 'Cartagena de Indias',
      // "port" progression is now driven by Cabildo level
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
    },

    // Canonical resource keys are ASCII (no accents) so they match trade
    // cargo keys exactly. Labels keep Spanish accents for display.
    resources: {
      // Core / construction
      oro:        { amount: 200, max: 999, baseMax: 999, icon: '🪙', label: 'Oro' },
      madera:     { amount: 80,  max: 200, baseMax: 200, icon: '🪵', label: 'Madera' },
      piedra:     { amount: 60,  max: 200, baseMax: 200, icon: '🪨', label: 'Piedra' },
      // Naval
      velas:      { amount: 15,  max: 50,  baseMax: 50,  icon: '⛵', label: 'Velas' },
      canones:    { amount: 4,   max: 20,  baseMax: 20,  icon: '💣', label: 'Cañones' },
      polvora:    { amount: 10,  max: 60,  baseMax: 60,  icon: '💥', label: 'Pólvora' },
      tripulacion:{ amount: 20,  max: 100, baseMax: 100, icon: '👨‍✈️', label: 'Tripulación' },
      // Tradeable goods (produced/exported; start at 0). Keys match trade cargo.
      cacao:      { amount: 0,   max: 100, baseMax: 100, icon: '🍫', label: 'Cacao',  good: true },
      tabaco:     { amount: 0,   max: 100, baseMax: 100, icon: '🍂', label: 'Tabaco', good: true },
      azucar:     { amount: 0,   max: 100, baseMax: 100, icon: '🍯', label: 'Azúcar', good: true },
      cuero:      { amount: 0,   max: 100, baseMax: 100, icon: '🟫', label: 'Cuero',  good: true },
      anil:       { amount: 0,   max: 100, baseMax: 100, icon: '🔷', label: 'Añil',   good: true },
      plata:      { amount: 0,   max: 100, baseMax: 100, icon: '⚪', label: 'Plata',  good: true },
      esmeraldas: { amount: 0,   max: 50,  baseMax: 50,  icon: '💚', label: 'Esmeraldas', good: true },
      perlas:     { amount: 0,   max: 50,  baseMax: 50,  icon: '🦪', label: 'Perlas', good: true },
      tejidos:    { amount: 0,   max: 100, baseMax: 100, icon: '🧵', label: 'Tejidos', good: true },
    },

    // Districts: GeoJSON-backed entities placed on the real map
    districts: [],
    districtCounter: 0,

    ships: [],
    shipCounter: 0,
    activeRoutes: [],
    captains: [],

    defense: {
      defenseScore: 5,
      coastalCoverage: 0,
      artilleryPower: 0,
      garrisonStrength: 0,
      navalPatrolStrength: 0,
      supplyReadiness: 0,
      raidRisk: 'low',
      blockadeRisk: 'none',
    },

    // Map UI state
    map: {
      center: mapConfig.center,
      zoom: mapConfig.defaultZoom,
      layers: {
        districts: true,
        buildings: true,
        influence: false,
        logistics: false,
        terrainDefense: false,
        tradeRoutes: false,
        combat: false,
      },
    },

    ui: {
      placementMode: null,   // { typeId } when placing a district
      placementPreview: null, // { polygon, point, validation }
      selectedDistrictId: null,
      selectedShipId: null,
      openSheet: null,       // 'build' | 'district' | 'shipyard' | 'defense' | 'economy' | 'port' | 'layers'
    },

    notifications: [],
  };
}
