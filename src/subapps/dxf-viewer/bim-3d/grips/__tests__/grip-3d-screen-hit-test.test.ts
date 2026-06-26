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
import { findGripAtScreen } from '../grip-3d-screen-hit-test';

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
