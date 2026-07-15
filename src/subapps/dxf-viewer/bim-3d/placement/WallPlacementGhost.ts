'use client';

/**
 * WallPlacementGhost — translucent 3D preview of the wall about to be drawn.
 * ADR-543, mirror of `MepSegmentPlacementGhost` (2-click LINEAR element): after
 * the first click the ghost draws the rubber-band wall (start → cursor).
 *
 * Scene-side leaf object: pure Three.js, no React, no high-frequency store
 * subscription. It builds the preview entity via the SAME SSoT the 2D canvas uses
 * (`generateWallPreview` → `buildWallEntity` — exactly what the second click
 * commits) and renders it with the SAME `wallToMesh` converter that builds every
 * committed wall. So the 3D ghost IS the 2D ghost, only painted to WebGL instead
 * of Canvas2D — one source of truth (preview ≡ commit, WYSIWYG).
 *
 * The ghost is visible ONLY while the wall FSM is in `awaitingEnd` — surfaced by
 * `wallPreviewStore.startPoint !== null` (the SSoT preview store the tool writes
 * on every click), mirror of the 2D rubber-band gate. The translucent material +
 * post-FX overlay registration (mustard fix, ADR-537) + non-pickable + disposal
 * live in the shared `PlacementGhostOverlay` SSoT.
 *
 * @see ./placement-ghost-overlay.ts — translucent post-FX ghost SSoT (all ghosts)
 * @see ../../hooks/drawing/wall-preview-helpers.ts — generateWallPreview (2D SSoT)
 * @see ../converters/BimToThreeConverter.ts — wallToMesh (committed-wall converter)
 * @see docs/centralized-systems/reference/adrs/ADR-543-wall-drawing-ssot-2d-3d.md
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { SceneUnits } from '../../utils/scene-units';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import type { PlacementOverlayFields } from '../../bim/placement/placement-overlay-fields';
import { generateWallPreview } from '../../hooks/drawing/wall-preview-helpers';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { wallToMesh } from '../converters/BimToThreeConverter';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** mm → Three.js world metres (shared constant, same as all converters). */
const MM_TO_M = 0.001;

/** Translucent tint for the wall-drawing ghost (neutral, distinct from committed walls). */
const WALL_GHOST_HEX = 0x2f6fed;

export class WallPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, WALL_GHOST_HEX, 0.4);
  }

  /**
   * Rebuild the wall ghost for the live cursor (active scene units). Reads the FSM
   * phase from the SSoT `wallPreviewStore`: before the first click (`startPoint ===
   * null`) it shows the «smart ghost» that snaps to nearby members; in `awaitingEnd`
   * (`startPoint` set) it shows the rubber-band wall start → cursor. Both via the SAME
   * `generateWallPreview` the 2D canvas uses, so the ghost is byte-for-byte what the
   * next click commits (preview ≡ commit, WYSIWYG).
   *
   * @param floorElevationMm Active floor elevation (mm); the building datum so the
   *                         ghost world Y matches the work-plane the cursor was
   *                         raycast against (WYSIWYG, same as column/segment ghosts).
   */
  update(
    cursorScenePoint: Readonly<Point2D>,
    floorElevationMm: number,
    levelId: string | undefined,
    sceneUnits: SceneUnits,
  ): WallHudMeta | null {
    if (this.overlay.isDisposed) return null;
    const startPoint = wallPreviewStore.get().startPoint;
    // ONE SSoT preview path with the 2D canvas: [] = smart ghost-before-click,
    // [start] = rubber-band; same builder as commit either way.
    const tempPoints = startPoint === null ? [] : [startPoint];
    const preview = generateWallPreview(tempPoints, { x: cursorScenePoint.x, y: cursorScenePoint.y }, sceneUnits);
    if (!preview || preview.type !== 'wall') {
      this.overlay.setVisible(false);
      return null;
    }
    // ADR-543 — the SAME `wallHud` meta the 2D canvas attaches (length/angle/thickness·height),
    // surfaced so the 3D HUD overlay paints it with the shared `paintWallHudCore`. Only present
    // in awaitingEnd (wantHud), so the before-click ghost returns null (no HUD), mirror of 2D.
    // ADR-663 §4 part 4 — ΕΝΑ structural read μέσω του canonical τύπου (ADR-544 ολοκληρωμένο):
    // το `wallHud` δηλώνεται στο `PlacementOverlayFields`, όχι inline εδώ.
    const hudMeta = (preview as PlacementOverlayFields).wallHud ?? null;
    // Same converter as every committed wall; building datum in metres so the ghost
    // lands on the same work-plane the cursor was raycast against.
    const mesh = wallToMesh(
      preview as unknown as WallEntity,
      [],
      floorElevationMm,
      levelId,
      floorElevationMm * MM_TO_M,
    );
    // null = degenerate axis (start ≈ cursor) → clear the ghost; the HUD self-clamps.
    this.overlay.setObject(mesh ?? null);
    return hudMeta;
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
  }
}
