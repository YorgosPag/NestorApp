/**
 * ADR-563 (Auto-Dimension) — shared test mocks.
 *
 * Minimal BIM entity stubs carrying only what the auto-dimension engine reads:
 * `id`, `type`, and `geometry.bbox` (the fields `calculateBimEntity2DBounds` +
 * the type guards touch). A single controlled `as unknown as Entity` cast keeps
 * the suites free of `any`.
 */

import type { Entity } from '../../../../types/entities';

type BimMockType = 'wall' | 'column' | 'foundation' | 'beam' | 'opening';

/** Build a BIM entity stub with an axis-aligned bbox (mm world coords). */
export function makeBimMock(
  type: BimMockType,
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Entity {
  return {
    id,
    type,
    geometry: {
      bbox: {
        min: { x: minX, y: minY, z: 0 },
        max: { x: maxX, y: maxY, z: 0 },
      },
    },
  } as unknown as Entity;
}
