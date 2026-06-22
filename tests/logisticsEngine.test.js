import { describe, it, expect } from 'vitest';
import { buildLinkGraph, isConnectedToPort, adjacencySynergy } from '../src/engines/trade/logisticsEngine.js';

const D = (id, type, point) => ({ id, type, mainBuildingPoint: point });

describe('buildLinkGraph', () => {
  it('links districts within range and not those far apart', () => {
    const a = D('a', 'hacienda', [10.4210, -75.5405]);
    const b = D('b', 'puerto',   [10.4213, -75.5405]); // ~33m
    const c = D('c', 'almacen',  [10.5000, -75.5000]); // far
    const g = buildLinkGraph([a, b, c]);
    expect(g.get('a').has('b')).toBe(true);
    expect(g.get('a').has('c')).toBe(false);
  });
});

describe('isConnectedToPort', () => {
  const port = D('pt', 'puerto', [10.4210, -75.5405]);

  it('a puerto is always connected to itself', () => {
    expect(isConnectedToPort(port, [port])).toBe(true);
  });

  it('a producer right next to the port is connected', () => {
    const prod = D('p', 'hacienda', [10.4213, -75.5405]);
    expect(isConnectedToPort(prod, [prod, port])).toBe(true);
  });

  it('a producer too far from the port is NOT connected directly', () => {
    const prod = D('p', 'hacienda', [10.4270, -75.5405]); // ~667m
    expect(isConnectedToPort(prod, [prod, port])).toBe(false);
  });

  it('a producer connects THROUGH a road chain', () => {
    const road = D('r', 'camino', [10.4240, -75.5405]);   // ~334m from each
    const prod = D('p', 'hacienda', [10.4270, -75.5405]);
    expect(isConnectedToPort(prod, [prod, road, port])).toBe(true);
  });

  it('non-road intermediate districts do NOT relay goods', () => {
    // an almacen in the middle is not a road, so it should not relay
    const mid = D('m', 'almacen', [10.4240, -75.5405]);
    const prod = D('p', 'hacienda', [10.4270, -75.5405]);
    expect(isConnectedToPort(prod, [prod, mid, port])).toBe(false);
  });

  it('returns false when there is no port at all', () => {
    const prod = D('p', 'hacienda', [10.4210, -75.5405]);
    expect(isConnectedToPort(prod, [prod])).toBe(false);
  });

  it('a Puerto is a hub: connects producers within the larger port range (~1000m)', () => {
    // ~820m away — beyond the normal 600m link range, within the port hub range
    const prod = D('p', 'almacen', [10.4205, -75.5420]);
    const portHub = D('pt2', 'puerto', [10.4150, -75.5470]);
    expect(isConnectedToPort(prod, [prod, portHub])).toBe(true);
  });

  it('a far isolated producer (>1000m, no roads) does NOT connect', () => {
    const prod = D('p', 'hacienda', [10.4450, -75.5250]);
    const portHub = D('pt2', 'puerto', [10.4150, -75.5470]);
    expect(isConnectedToPort(prod, [prod, portHub])).toBe(false);
  });
});

describe('adjacencySynergy', () => {
  it('is 1 (no bonus) for a lone district', () => {
    const alm = D('a', 'almacen', [10.4210, -75.5405]);
    expect(adjacencySynergy(alm, [alm])).toBe(1);
  });

  it('is >1 when a complementary district is adjacent', () => {
    const alm = D('a', 'almacen', [10.4210, -75.5405]);
    const port = D('p', 'puerto', [10.4213, -75.5405]);
    expect(adjacencySynergy(alm, [alm, port])).toBeGreaterThan(1);
  });

  it('caps the bonus at +40%', () => {
    const alm = D('a', 'almacen', [10.4210, -75.5405]);
    // many adjacent complementary districts
    const neighbors = Array.from({ length: 10 }, (_, i) =>
      D(`n${i}`, 'puerto', [10.4211 + i * 0.0001, -75.5405])
    );
    expect(adjacencySynergy(alm, [alm, ...neighbors])).toBeLessThanOrEqual(1.4);
  });

  it('ignores non-complementary neighbors', () => {
    const hacienda = D('h', 'hacienda', [10.4210, -75.5405]);
    const fort = D('f', 'fortaleza', [10.4213, -75.5405]); // not complementary to hacienda
    expect(adjacencySynergy(hacienda, [hacienda, fort])).toBe(1);
  });
});
