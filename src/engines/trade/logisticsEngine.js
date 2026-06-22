// ============================================================
// LOGISTICS ENGINE
// Phase A: roads + adjacency.
//  - A producing district must be CONNECTED to the Puerto (directly close,
//    or through a chain of Camino Interior districts) to deliver goods.
//  - Adjacent complementary districts grant light production synergies.
// All distances use district mainBuildingPoint [lat,lng].
// ============================================================

import { distanceM } from '../../utils/geoUtils.js';

// Two districts are "linked" if their main points are within range.
// The Puerto is the logistics hub (quays/access roads reach farther), so any
// link involving a Puerto uses a larger range — this lets a road chain reach
// a port that sits on the water's edge.
const LINK_RANGE_M = 750;
const PORT_LINK_RANGE_M = 1300;
// A producer delivers if it can reach the Puerto within this many hops.
const MAX_HOPS = 8;

function linkRangeFor(a, b) {
  return (a.type === 'puerto' || b.type === 'puerto') ? PORT_LINK_RANGE_M : LINK_RANGE_M;
}

/**
 * Build an adjacency map between districts that are within link range.
 * @returns {Map<id, Set<id>>}
 */
export function buildLinkGraph(districts) {
  const graph = new Map();
  districts.forEach((d) => graph.set(d.id, new Set()));
  for (let i = 0; i < districts.length; i++) {
    for (let j = i + 1; j < districts.length; j++) {
      const a = districts[i], b = districts[j];
      if (!a.mainBuildingPoint || !b.mainBuildingPoint) continue;
      if (distanceM(a.mainBuildingPoint, b.mainBuildingPoint) <= linkRangeFor(a, b)) {
        graph.get(a.id).add(b.id);
        graph.get(b.id).add(a.id);
      }
    }
  }
  return graph;
}

/**
 * Is `district` connected to a Puerto?
 * Direct link to Puerto counts; otherwise the chain must pass through
 * Camino Interior districts (roads carry goods).
 */
export function isConnectedToPort(district, districts) {
  const ports = districts.filter((d) => d.type === 'puerto');
  if (!ports.length) return false;
  if (district.type === 'puerto') return true;

  const graph = buildLinkGraph(districts);
  const byId = new Map(districts.map((d) => [d.id, d]));
  const portIds = new Set(ports.map((p) => p.id));

  // BFS from the district; intermediate nodes must be roads (camino) or the
  // start node itself. Reaching any Puerto = connected.
  const visited = new Set([district.id]);
  let frontier = [{ id: district.id, hops: 0 }];

  while (frontier.length) {
    const next = [];
    for (const { id, hops } of frontier) {
      if (hops > MAX_HOPS) continue;
      for (const neighborId of graph.get(id) || []) {
        if (visited.has(neighborId)) continue;
        if (portIds.has(neighborId)) return true;
        const n = byId.get(neighborId);
        // Goods only travel further THROUGH roads
        if (n && n.type === 'camino') {
          visited.add(neighborId);
          next.push({ id: neighborId, hops: hops + 1 });
        }
      }
    }
    frontier = next;
  }
  return false;
}

// Complementary pairs that reinforce each other when adjacent.
const SYNERGIES = {
  almacen: ['puerto', 'aduana'],
  aduana: ['puerto', 'almacen'],
  hacienda: ['camino', 'almacen'],
  gremio: ['almacen', 'camino'],
  arsenal: ['puerto', 'fortaleza'],
  fortaleza: ['puerto', 'arsenal'],
  puerto: ['almacen', 'aduana'],
};

/**
 * Production multiplier for a district based on adjacent complementary types.
 * Each qualifying neighbor adds +8%, capped at +40%.
 */
export function adjacencySynergy(district, districts) {
  const wants = SYNERGIES[district.type];
  if (!wants || !district.mainBuildingPoint) return 1;

  let bonuses = 0;
  for (const other of districts) {
    if (other.id === district.id || !other.mainBuildingPoint) continue;
    if (!wants.includes(other.type)) continue;
    if (distanceM(district.mainBuildingPoint, other.mainBuildingPoint) <= LINK_RANGE_M) {
      bonuses++;
    }
  }
  return 1 + Math.min(bonuses * 0.08, 0.4);
}

export const LINK_RANGE = LINK_RANGE_M;
