/**
 * ADR-535 Φ5 — grip-3d-screen-hit-test: nearest-grip pick in screen space.
 *
 * The grips are a Canvas2D overlay, so picking is screen-space (like the 2D canvas): each
 * grip is projected to canvas-local px and the nearest within the pixel radius wins. These
 * locks pin it: a cursor inside the radius hits the nearest grip, a tie/closer grip wins,
 * and a cursor outside every radius misses (null).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { GripInfo } from '../../../hooks/grip-types';
import { findGripAtScreen, findTwinGripAtScreen } from '../grip-3d-screen-hit-test';

/** Two grips whose plan positions double as their (identity-projected) screen px. */
const GRIPS = [
  { position: { x: 0, y: 0 } },
  { position: { x: 10, y: 0 } },
] as unknown as GripInfo[];

/** Identity projector — plan === canvas px (keeps the test about the distance rule). */
const project = (p: Point2D): Point2D => ({ x: p.x, y: p.y });

describe('findGripAtScreen', () => {
  it('hits the nearest grip inside the radius', () => {
    expect(findGripAtScreen(GRIPS, project, 1, 0, 5)).toBe(0);
    expect(findGripAtScreen(GRIPS, project, 9, 0, 5)).toBe(1);
  });

  it('nearest-wins when both are in range', () => {
    // (4,0): grip0 dist 4, grip1 dist 6 → grip0.
    expect(findGripAtScreen(GRIPS, project, 4, 0, 100)).toBe(0);
    // (6,0): grip0 dist 6, grip1 dist 4 → grip1.
    expect(findGripAtScreen(GRIPS, project, 6, 0, 100)).toBe(1);
  });

  it('misses (null) when the cursor is outside every radius', () => {
    expect(findGripAtScreen(GRIPS, project, 50, 50, 5)).toBeNull();
  });

  it('returns null for an empty grip set', () => {
    expect(findGripAtScreen([], project, 0, 0, 10)).toBeNull();
  });
});

describe('findTwinGripAtScreen (ADR-535 Φ6)', () => {
  // 2 plan grips. Top projector = identity; bottom projector shifts +100px in y (the bottom
  // face renders 100px lower on screen) — so top/bottom of the same vertex are distinguishable.
  const projectTop = (p: Point2D): Point2D => ({ x: p.x, y: p.y });
  const projectBottom = (p: Point2D): Point2D => ({ x: p.x, y: p.y + 100 });

  it('returns a flat index: 0..N-1 = top, N..2N-1 = bottom', () => {
    // Near (0,0) → top face of grip 0 → flat 0.
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 1, 0, 5)).toBe(0);
    // Near (10,0) → top face of grip 1 → flat 1.
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 9, 0, 5)).toBe(1);
    // Near (0,100) → bottom face of grip 0 → flat N+0 = 2.
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 0, 100, 5)).toBe(2);
    // Near (10,100) → bottom face of grip 1 → flat N+1 = 3.
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 10, 100, 5)).toBe(3);
  });

  it('nearest-wins across BOTH surfaces', () => {
    // (0,40): top grip0 dist 40, bottom grip0 dist 60 → top wins (flat 0).
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 0, 40, 200)).toBe(0);
    // (0,60): top grip0 dist 60, bottom grip0 dist 40 → bottom wins (flat 2).
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 0, 60, 200)).toBe(2);
  });

  it('accept(flatIndex) skips occluded squares (e.g. bottom twin from above)', () => {
    // Cull every bottom square (flat >= N) → near the bottom face still falls back to top.
    const acceptTopOnly = (flat: number): boolean => flat < GRIPS.length;
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 0, 100, 5, acceptTopOnly)).toBeNull();
    // The top square is still pickable.
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 0, 0, 5, acceptTopOnly)).toBe(0);
  });

  it('misses (null) outside every radius and on an empty set', () => {
    expect(findTwinGripAtScreen(GRIPS, projectTop, projectBottom, 50, 50, 5)).toBeNull();
    expect(findTwinGripAtScreen([], projectTop, projectBottom, 0, 0, 10)).toBeNull();
  });
});
