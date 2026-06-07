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
 * The ghost is visible ONLY in the `awaitingEnd` phase (mirror of the 2D
 * `useMepSegmentTool.getGhostSegment`, which returns null until awaitingEnd).
 *
 * @see ./MepManifoldPlacementGhost.ts — point-based ghost template
 * @see ../converters/mep-segment-to-mesh.ts — swept profile converter
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { completeMepSegmentFromTwoClicks } from '../../hooks/drawing/mep-segment-completion';
import { mepSegmentToMesh } from '../converters/mep-segment-to-mesh';
import { resolveSegmentClassificationColor } from '../../bim/mep-systems/mep-system-color';
import { mepSegmentToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store';

/** mm → Three.js world metres (shared constant, same as all converters). */
const MM_TO_M = 0.001;

/** Layer id stamped on the throwaway ghost entity (never persisted). */
const GHOST_LAYER_ID = '__ghost-mep-segment__';

/** Fallback translucent tint when the run carries no classification colour. */
const DEFAULT_PIPE_GHOST_HEX = '#2f6fed';
const DEFAULT_DUCT_GHOST_HEX = '#9ca3af';

export class MepSegmentPlacementGhost {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh | null = null;
  private entity: MepSegmentEntity | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x2f6fed,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 0.6,
      metalness: 0.0,
    });
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
    if (this.disposed) return;
    const handle = mepSegmentToolBridgeStore.get();
    if (!handle || handle.phase !== 'awaitingEnd' || handle.startPoint === null) {
      this.setVisible(false);
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
      this.setVisible(false);
      return;
    }
    this.entity = result.entity;
    // ADR-408 Φ14 — recolour to the committed run: classification (drainage =
    // brown) wins via the shared SSoT, else the per-domain default tint.
    const classHex = resolveSegmentClassificationColor(result.entity.params.classification);
    this.material.color.set(
      classHex ?? (result.entity.params.domain === 'pipe' ? DEFAULT_PIPE_GHOST_HEX : DEFAULT_DUCT_GHOST_HEX),
    );
    this.removeMesh();
    // Pass the floor elevation as the building datum (metres) so the ghost lands
    // on the same work-plane the cursor was raycast against.
    const mesh = mepSegmentToMesh(result.entity, floorElevationMm, levelId, floorElevationMm * MM_TO_M);
    if (!mesh) return; // degenerate axis (start ≈ cursor) → nothing to show
    mesh.material = this.material;
    mesh.userData = {};
    mesh.raycast = () => {};
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  setVisible(visible: boolean): void {
    if (this.mesh) this.mesh.visible = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeMesh();
    this.material.dispose();
  }

  private removeMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    // Dispose every geometry in the subtree. Materials are shared singletons from
    // the converter (or the ghost's own material) — never disposed here.
    this.mesh.traverse((obj) => {
      const g = (obj as THREE.Mesh | THREE.LineSegments).geometry;
      if (g) g.dispose();
    });
    this.mesh = null;
  }
}
