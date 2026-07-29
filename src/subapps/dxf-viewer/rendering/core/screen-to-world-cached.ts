/**
 * Screen (client) point → WORLD, using the cached rect + the LIVE event-time transform
 * (`getImmediateTransform`, ADR-040 Phase XXII.B). Shared by native-pointer-event
 * listeners that need one-off coordinate conversion outside the ghost-preview draw-frame
 * flow (CHECK 3.28 de-dup — extracted from Extend/Trim drag-capture, ADR-583).
 *
 * ⚠️ CLIENT-ONLY MODULE — do NOT merge back into `CoordinateTransforms` (ADR-726 Φ5
 * build fix, 2026-07-30). `ImmediateTransformStore` imports `useSyncExternalStore`, and
 * `CoordinateTransforms` is transitively imported by SERVER API routes
 * (`app/api/floorplans/process/route.ts` → `dxf-scene-builder` → `types/entities` →
 * `entity-bounds-ssot` → `bounds-operations` → `CoordinateTransforms`). A React-hook
 * import anywhere in that graph makes `next build` fail with «useSyncExternalStore only
 * works in a Client Component» — the dev server (Turbopack, on-demand) never surfaces it.
 * Pure math stays in `CoordinateTransforms`; live-store reads live here, one level up,
 * where only client-side pointer hooks import them.
 */

import type { Point2D } from '../types/Types';
import { CoordinateTransforms } from './CoordinateTransforms';
import { getCachedClientRect } from './pointer-rect-cache';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

export function screenToWorldCached(element: HTMLElement, screenX: number, screenY: number): Point2D {
  const rect = getCachedClientRect(element);
  const viewport = { width: rect.width, height: rect.height };
  return CoordinateTransforms.screenToWorld(
    { x: screenX - rect.left, y: screenY - rect.top },
    getImmediateTransform(),
    viewport,
  );
}
