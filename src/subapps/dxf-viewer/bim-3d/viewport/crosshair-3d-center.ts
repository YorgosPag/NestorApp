/**
 * crosshair-3d-center — PURE decision for where the 3D crosshair centre sits (ADR-545).
 *
 * Mirrors the 2D parity rule: the crosshair follows the cursor, but «κουμπώνει» (jumps) to the
 * active snap point when one is available. Whether the snap is a *valid, visible* target
 * (on-screen, camera settled, not occluded) is decided ONCE in `projectSnap3DMarker`
 * (`project-snap3d-marker.ts`) — the same SSoT the snap-indicator glyph uses. This module only
 * picks snap-vs-cursor given the already-resolved projected snap point, so it stays pure +
 * trivially testable.
 *
 * @module crosshair-3d-center
 */

import type { Point2D } from '../../rendering/types/Types';

export interface Crosshair3DCenterInput {
  /** Cursor position in canvas-local px (raw mouse), or null when off-canvas/unknown. */
  readonly cursor: Point2D | null;
  /** The visible snap point projected to canvas-local px, or null when there is no valid snap. */
  readonly snapProjected: Point2D | null;
}

export interface Crosshair3DCenter {
  /** The centre position to apply, or null to hide the crosshair. */
  readonly point: Point2D | null;
  /** True when the centre is glued to the snap point (⇒ hide the centre square, ADR-515). */
  readonly snapped: boolean;
}

/**
 * Resolve the crosshair centre: the snap point when one is available (already validated as
 * visible by `projectSnap3DMarker`), else the cursor. `snapped` tells the caller whether to
 * hide the centre square (the snap «κουμπώνει» the centre).
 */
export function resolveCrosshair3DCenter(input: Crosshair3DCenterInput): Crosshair3DCenter {
  if (input.snapProjected) {
    return { point: input.snapProjected, snapped: true };
  }
  return { point: input.cursor, snapped: false };
}
