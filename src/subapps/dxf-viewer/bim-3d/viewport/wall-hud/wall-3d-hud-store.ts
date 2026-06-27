'use client';

/**
 * wall-3d-hud-store — ADR-543: non-reactive payload bridge for the 3D wall HUD.
 *
 * The live wall HUD (length / angle / thickness·height) changes on every pointer
 * move — high frequency. Per ADR-040 it must NOT drive React re-renders, so it
 * lives in a plain module singleton (mirror of `grip3DOverlayInteraction`): the
 * `useBim3DWallPlacement` hook WRITES the current HUD meta on each move, and the
 * `WallHudOverlay3D` RAF loop READS it each frame to project + paint. The overlay's
 * RAF on/off is gated separately by the low-frequency FSM phase (`wallPreviewStore`).
 *
 * `meta === null` ⇒ nothing to paint (cursor off the floor / degenerate / not in
 * `awaitingEnd`). `floorElevationMm` is the work-plane datum the cursor was raycast
 * against, so the overlay lifts the HUD points to the same plane as the ghost mesh.
 */

import type { WallHudMeta } from '../../../canvas-v2/preview-canvas/wall-hud-paint';
import type { SceneUnits } from '../../../utils/scene-units';

export interface Wall3DHudData {
  /** Numeric HUD (length/angle/thickness·height) of the live ghost, or null when nothing to show. */
  meta: WallHudMeta | null;
  /** Active floor elevation (mm) — the work-plane datum the HUD points project against. */
  floorElevationMm: number;
  /** Active scene units (the HUD meta points are in scene units, converted to mm for projection). */
  sceneUnits: SceneUnits;
}

/** Module singleton — written by the placement hook, read by the overlay RAF loop. Zero React. */
export const wall3DHudData: Wall3DHudData = {
  meta: null,
  floorElevationMm: 0,
  sceneUnits: 'mm',
};

/** Set the current HUD payload (placement hook, each pointer move while drawing in 3D). */
export function setWall3DHud(meta: WallHudMeta | null, floorElevationMm: number, sceneUnits: SceneUnits): void {
  wall3DHudData.meta = meta;
  wall3DHudData.floorElevationMm = floorElevationMm;
  wall3DHudData.sceneUnits = sceneUnits;
}

/** Clear the HUD (pointer left the canvas / tool torn down). */
export function clearWall3DHud(): void {
  wall3DHudData.meta = null;
}
