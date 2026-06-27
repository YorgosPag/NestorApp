'use client';

/**
 * tracking-3d-store — ADR-543 (COL traces 3D): non-reactive payload bridge for the
 * 3D Object-Snap-Tracking overlay (Revit-style ambient alignment lines).
 *
 * The active alignment paths / intersections / snapped distance change on every
 * pointer move — high frequency. Per ADR-040 this must NOT drive React re-renders,
 * so it lives in a plain module singleton (mirror of `wall3DHudData`): the
 * `useBim3DWallPlacement` hook WRITES the current tracking result on each move, and
 * the `Tracking3DOverlay` RAF loop READS it each frame to project + paint with the
 * SAME `tracking-paint` painters the 2D `PreviewRenderer` uses (one tracking visual,
 * two canvases). The overlay's RAF on/off is gated separately by the low-frequency
 * active-tool + 3D-view flags.
 *
 * `data === null` ⇒ nothing to paint (cursor off the floor / no alignment within
 * tolerance). `floorElevationMm` is the work-plane datum the cursor was raycast
 * against, so the overlay lifts the alignment geometry to the same plane as the ghost.
 *
 * All points are in SCENE units (exactly as the 2D resolver produces in DXF world);
 * the 3D projector converts scene → plan-mm → px.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SceneUnits } from '../../../utils/scene-units';
import type { AcquiredTrackingPoint } from '../../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../../systems/tracking/tracking-resolver';

export interface Tracking3DPayload {
  /** The 1–2 cursor-aligned paths to draw (projection = 1, intersection = 2). */
  readonly paths: readonly TrackingAlignmentPath[];
  /** Path intersection points (halo). */
  readonly intersections: readonly Point2D[];
  /** Acquired-point `+` glyphs (empty for pure-ambient 3D; kept for parity). */
  readonly markers: readonly AcquiredTrackingPoint[];
  /** Snapped cursor point — anchor for the distance tooltip + occlusion cull. */
  readonly snappedPoint: Point2D;
  /** Pre-formatted distance/angle label (i18n + display units), or null. */
  readonly label: string | null;
}

export interface Tracking3DData {
  /** The active tracking visuals, or null when nothing to show. */
  payload: Tracking3DPayload | null;
  /** Active floor elevation (mm) — the work-plane datum the points project against. */
  floorElevationMm: number;
  /** Active scene units (points are in scene units, converted to mm for projection). */
  sceneUnits: SceneUnits;
}

/** Module singleton — written by the placement hook, read by the overlay RAF loop. Zero React. */
export const tracking3DData: Tracking3DData = {
  payload: null,
  floorElevationMm: 0,
  sceneUnits: 'mm',
};

/** Set the current tracking payload (placement hook, each move while drawing in 3D). */
export function setTracking3D(
  payload: Tracking3DPayload | null,
  floorElevationMm: number,
  sceneUnits: SceneUnits,
): void {
  tracking3DData.payload = payload;
  tracking3DData.floorElevationMm = floorElevationMm;
  tracking3DData.sceneUnits = sceneUnits;
}

/** Clear the tracking overlay (cursor left the canvas / tool torn down). */
export function clearTracking3D(): void {
  tracking3DData.payload = null;
}
