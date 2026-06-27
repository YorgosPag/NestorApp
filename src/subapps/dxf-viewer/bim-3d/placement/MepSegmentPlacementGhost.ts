'use client';

/**
 * MepSegmentPlacementGhost — translucent 3D preview of the duct/pipe segment
 * about to be placed. ADR-403 / ADR-408 Φ8, mirror of
 * `MepManifoldPlacementGhost` but for a 2-click LINEAR element: after the first
 * click the ghost draws the rubber-band axis (start → cursor).
 *
 * Scene-side leaf object: pure Three.js, no React, no high-frequency store
 * subscription. It reads the segment FSM state (phase + startPoint + domain +
 * overrides) from the SAME `mepSegmentToolBridgeStore` the tool publishes, and
 * builds the mesh via the SAME SSoT path the commit uses
 * (`completeMepSegmentFromTwoClicks` → `mepSegmentToMesh`) — so the preview is
 * exactly what the second click creates (WYSIWYG).
 *
 * The ghost is visible ONLY in the `awaitingEnd` phase. Translucent material +
 * post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537).
 *
 * @see ../converters/mep-segment-to-mesh.ts — swept profile converter
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { completeMepSegmentFromTwoClicks } from '../../hooks/drawing/mep-segment-completion';
import { mepSegmentToMesh } from '../converters/mep-segment-to-mesh';
import { resolveSegmentClassificationColor } from '../../bim/mep-systems/mep-system-color';
import { mepSegmentToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** mm → Three.js world metres (shared constant, same as all converters). */
const MM_TO_M = 0.001;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-segment__';

/** Fallback translucent tint when the run carries no classification colour. */
const DEFAULT_PIPE_GHOST_HEX = '#2f6fed';
const DEFAULT_DUCT_GHOST_HEX = '#9ca3af';

export class MepSegmentPlacementGhost {
  private readonly overlay: PlacementGhostOverlay;
  private entity: MepSegmentEntity | null = null;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0x2f6fed, 0.45);
  }

  /**
   * Rebuild the rubber-band ghost from the FSM start anchor to `cursorScenePoint`
   * (active scene units). Hidden unless the tool is in `awaitingEnd`.
   *
   * @param floorElevationMm Active floor elevation (mm); used as the building
   *                         datum so the ghost world Y matches the work-plane the
   *                         cursor was raycast against (WYSIWYG).
   * @param endElevationMm   Cursor-end elevation (mm, floor-relative): a snapped
   *                         connector's z (Φ-B1) or the current centreline offset
   *                         (Revit per-click elevation). `null`/omitted ⇒ the
   *                         completion defaults the end to the centreline (flat).
   */
  update(
    cursorScenePoint: Readonly<Point2D>,
    floorElevationMm: number,
    levelId: string | undefined,
    endElevationMm: number | null = null,
  ): void {
    if (this.overlay.isDisposed) return;
    const handle = mepSegmentToolBridgeStore.get();
    if (!handle || handle.phase !== 'awaitingEnd' || handle.startPoint === null) {
      this.overlay.setVisible(false);
      return;
    }
    const result = completeMepSegmentFromTwoClicks(
      handle.startPoint,
      cursorScenePoint,
      GHOST_LAYER_ID,
      handle.domain,
      handle.overrides,
      handle.getSceneUnits(),
      // Per-endpoint elevation (Φ-A): start from the FSM (connector z or null), end
      // from the live cursor resolution (connector z or centreline offset). A
      // different start/end ⇒ the rubber-band previews the real slope/riser.
      handle.startElevationMm,
      endElevationMm,
    );
    if (!result.ok) {
      this.overlay.setVisible(false);
      return;
    }
    this.entity = result.entity;
    // ADR-408 Φ14 — recolour to the committed run: classification (drainage =
    // brown) wins via the shared SSoT, else the per-domain default tint.
    const classHex = resolveSegmentClassificationColor(result.entity.params.classification);
    this.overlay.setColor(
      classHex ?? (result.entity.params.domain === 'pipe' ? DEFAULT_PIPE_GHOST_HEX : DEFAULT_DUCT_GHOST_HEX),
    );
    // Pass the floor elevation as the building datum (metres) so the ghost lands
    // on the same work-plane the cursor was raycast against.
    this.overlay.setObject(mepSegmentToMesh(result.entity, floorElevationMm, levelId, floorElevationMm * MM_TO_M));
  }

  setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  dispose(): void {
    this.overlay.dispose();
  }
}
