/**
 * ADR-366 Phase 9 / C.1.a — keyframe-interpolator tests.
 */

import { interpolateFrame } from '../../animation/core/keyframe-interpolator';
import type { Waypoint } from '../../animation/animation-types';

const A: Waypoint = {
  position: { x: 0, y: 0, z: 0 },
  target: { x: 10, y: 0, z: 0 },
  fov: 40,
  easingToNext: 'linear',
};

const B: Waypoint = {
  position: { x: 10, y: 5, z: -5 },
  target: { x: 0, y: 5, z: 0 },
  fov: 60,
  easingToNext: 'linear',
};

describe('interpolateFrame — linked mode (default)', () => {
  it('returns from at t=0', () => {
    const f = interpolateFrame({ from: A, to: B, t: 0, timeSec: 0, splitTracks: false });
    expect(f.position).toEqual(A.position);
    expect(f.target).toEqual(A.target);
    expect(f.fov).toBe(A.fov);
    expect(f.timeSec).toBe(0);
  });

  it('returns to at t=1', () => {
    const f = interpolateFrame({ from: A, to: B, t: 1, timeSec: 5, splitTracks: false });
    expect(f.position).toEqual(B.position);
    expect(f.target).toEqual(B.target);
    expect(f.fov).toBe(B.fov);
    expect(f.timeSec).toBe(5);
  });

  it('linear lerp at t=0.5 with easingToNext=linear', () => {
    const f = interpolateFrame({ from: A, to: B, t: 0.5, timeSec: 2.5, splitTracks: false });
    expect(f.position.x).toBeCloseTo(5, 6);
    expect(f.position.y).toBeCloseTo(2.5, 6);
    expect(f.position.z).toBeCloseTo(-2.5, 6);
    expect(f.target.x).toBeCloseTo(5, 6);
    expect(f.target.y).toBeCloseTo(2.5, 6);
    expect(f.target.z).toBeCloseTo(0, 6);
    expect(f.fov).toBeCloseTo(50, 6);
  });

  it('respects easeInCubic curve from waypoint A.easingToNext', () => {
    const slowFrom: Waypoint = { ...A, easingToNext: 'ease-in' };
    const f = interpolateFrame({
      from: slowFrom,
      to: B,
      t: 0.5,
      timeSec: 0,
      splitTracks: false,
    });
    // cubic ease-in at t=0.5 → 0.125; position.x = 0 + 10 * 0.125 = 1.25
    expect(f.position.x).toBeCloseTo(1.25, 4);
  });

  it('clamps out-of-range t (negative → 0, >1 → 1)', () => {
    const fLow = interpolateFrame({ from: A, to: B, t: -0.5, timeSec: 0, splitTracks: false });
    expect(fLow.position).toEqual(A.position);
    const fHigh = interpolateFrame({ from: A, to: B, t: 1.5, timeSec: 0, splitTracks: false });
    expect(fHigh.position).toEqual(B.position);
  });
});

describe('interpolateFrame — split-tracks mode (C.1.a placeholder)', () => {
  it('linked vs split produce same result για identical easing across channels', () => {
    const linked = interpolateFrame({ from: A, to: B, t: 0.5, timeSec: 1, splitTracks: false });
    const split = interpolateFrame({ from: A, to: B, t: 0.5, timeSec: 1, splitTracks: true });
    expect(split.position).toEqual(linked.position);
    expect(split.target).toEqual(linked.target);
    expect(split.fov).toBe(linked.fov);
  });
});
