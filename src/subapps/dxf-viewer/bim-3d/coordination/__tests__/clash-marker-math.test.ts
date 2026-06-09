/**
 * ADR-435 Slice 1b — clash-marker-math (pure plan-metres → Three.js world).
 */

import { clashPointToWorld } from '../clash-marker-math';

describe('clashPointToWorld', () => {
  it('maps planX→x, elevation(z)→y, planY→−z (matches segmentAxisEndpointsWorld)', () => {
    expect(clashPointToWorld({ x: 2, y: 5, z: 3 })).toEqual({ x: 2, y: 3, z: -5 });
  });

  it('keeps the origin at the origin', () => {
    expect(clashPointToWorld({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('flips the sign of plan-north (y) onto world −Z', () => {
    expect(clashPointToWorld({ x: 0, y: 7, z: 0 }).z).toBe(-7);
  });

  it('lifts elevation (z) onto world up (y)', () => {
    expect(clashPointToWorld({ x: 0, y: 0, z: 2.8 }).y).toBe(2.8);
  });

  it('handles negative plan + elevation values', () => {
    expect(clashPointToWorld({ x: -1.5, y: -4, z: -0.5 })).toEqual({ x: -1.5, y: -0.5, z: 4 });
  });
});
