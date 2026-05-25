/**
 * ADR-366 Phase 9 / C.1.a — WaypointPathBuilder tests.
 */

import { buildWaypointPath } from '../../animation/core/WaypointPathBuilder';
import type { Waypoint } from '../../animation/animation-types';

const WP_A: Waypoint = {
  position: { x: 0, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  easingToNext: 'linear',
};

const WP_B: Waypoint = {
  position: { x: 10, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  easingToNext: 'linear',
};

const WP_C: Waypoint = {
  position: { x: 10, y: 10, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  easingToNext: 'linear',
};

describe('buildWaypointPath edge cases', () => {
  it('returns empty array για 0 waypoints', () => {
    const path = buildWaypointPath([], { durationSec: 5, fps: 30, splitTracks: false });
    expect(path).toEqual([]);
  });

  it('returns single static frame για 1 waypoint', () => {
    const path = buildWaypointPath([WP_A], { durationSec: 5, fps: 30, splitTracks: false });
    expect(path.length).toBe(1);
    expect(path[0]!.position).toEqual(WP_A.position);
    expect(path[0]!.timeSec).toBe(0);
  });
});

describe('buildWaypointPath — 2 waypoints linear', () => {
  it('produces durationSec * fps frames', () => {
    const path = buildWaypointPath([WP_A, WP_B], { durationSec: 4, fps: 30, splitTracks: false });
    expect(path.length).toBe(120);
  });

  it('first frame matches first waypoint position', () => {
    const path = buildWaypointPath([WP_A, WP_B], { durationSec: 4, fps: 30, splitTracks: false });
    expect(path[0]!.position.x).toBeCloseTo(WP_A.position.x, 4);
  });

  it('last frame matches last waypoint position', () => {
    const path = buildWaypointPath([WP_A, WP_B], { durationSec: 4, fps: 30, splitTracks: false });
    expect(path[path.length - 1]!.position.x).toBeCloseTo(WP_B.position.x, 4);
  });

  it('middle frame interpolates linearly between A and B (easing=linear)', () => {
    const path = buildWaypointPath([WP_A, WP_B], { durationSec: 4, fps: 30, splitTracks: false });
    const mid = path[Math.floor(path.length / 2)]!;
    expect(mid.position.x).toBeCloseTo(5, 1);
  });

  it('timeSec ranges from 0 to durationSec', () => {
    const path = buildWaypointPath([WP_A, WP_B], { durationSec: 4, fps: 30, splitTracks: false });
    expect(path[0]!.timeSec).toBeCloseTo(0, 4);
    expect(path[path.length - 1]!.timeSec).toBeCloseTo(4, 4);
  });
});

describe('buildWaypointPath — 3 waypoints (multi-segment)', () => {
  it('produces durationSec * fps frames total', () => {
    const path = buildWaypointPath([WP_A, WP_B, WP_C], {
      durationSec: 6,
      fps: 30,
      splitTracks: false,
    });
    expect(path.length).toBe(180);
  });

  it('passes through waypoint B near halfway', () => {
    const path = buildWaypointPath([WP_A, WP_B, WP_C], {
      durationSec: 6,
      fps: 60,
      splitTracks: false,
    });
    // Halfway around index N/2 should match WP_B (linear easing, uniform segments)
    const midIdx = Math.floor(path.length / 2);
    const midFrame = path[midIdx]!;
    expect(midFrame.position.x).toBeCloseTo(WP_B.position.x, 0);
    expect(midFrame.position.y).toBeCloseTo(WP_B.position.y, 0);
  });

  it('produces monotonically increasing timeSec', () => {
    const path = buildWaypointPath([WP_A, WP_B, WP_C], {
      durationSec: 6,
      fps: 30,
      splitTracks: false,
    });
    for (let i = 1; i < path.length; i++) {
      expect(path[i]!.timeSec).toBeGreaterThanOrEqual(path[i - 1]!.timeSec);
    }
  });
});
