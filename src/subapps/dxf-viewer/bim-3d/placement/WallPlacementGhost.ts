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
 * on every click), mirror of the 2D rubber-band gate.
 *
 * @see ./MepSegmentPlacementGhost.ts — linear 2-click ghost template
 * @see ../../hooks/drawing/wall-preview-helpers.ts — generateWallPreview (2D SSoT)
 * @see ../converters/BimToThreeConverter.ts — wallToMesh (committed-wall converter)
 * @see docs/centralized-systems/reference/adrs/ADR-543-wall-drawing-ssot-2d-3d.md
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { SceneUnits } from '../../utils/scene-units';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { generateWallPreview } from '../../hooks/drawing/wall-preview-helpers';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { wallToMesh } from '../converters/BimToThreeConverter';
// ADR-537 — Revit/Maxon-grade: the translucent ghost is a post-FX UI overlay, NOT shaded
// geometry. Drawn in the dedicated forward pass AFTER SSAO so the warm sun/ground lighting +
// AO multiply never tint it "mustard" at idle (same SSoT the underlay + edit gizmo use).
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';

/** mm → Three.js world metres (shared constant, same as all converters). */
const MM_TO_M = 0.001;

/** Translucent tint for the wall-drawing ghost (neutral, distinct from committed walls). */
const WALL_GHOST_HEX = 0x2f6fed;

export class WallPlacementGhost {
  private readonly scene: THREE.Scene;
  /**
   * UNLIT translucent ghost material. The post-FX overlay pass renders each root standalone
   * (`renderer.render(root, camera)`) with no lights in the subtree, so a lit `MeshStandardMaterial`
   * would render black — a flat `MeshBasicMaterial` is the correct CAD-preview look AND the reason
   * the mustard root cause is gone (no PBR lighting to blend through the SSAO composite). depthTest
   * stays on so the ghost is occluded by closer geometry; depthWrite off so it never pollutes depth.
   */
  private readonly material: THREE.MeshBasicMaterial;
  private mesh: THREE.Object3D | null = null;
  /** Flag-based visibility (ADR-537 overlay mechanism): the mesh root stays `visible=false` so the
   *  MAIN render skips it; the post-FX pass flips it on transiently. Show/hide toggles this flag. */
  private shown = false;
  private disposed = false;
  private readonly unregisterOverlay: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshBasicMaterial({
      color: WALL_GHOST_HEX,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    // Register as a post-FX overlay: return the live mesh only while shown (root kept visible=false).
    this.unregisterOverlay = registerPostFxOverlay(scene, () => (this.shown && this.mesh ? [this.mesh] : []));
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
    if (this.disposed) return null;
    const startPoint = wallPreviewStore.get().startPoint;
    // ONE SSoT preview path with the 2D canvas: [] = smart ghost-before-click,
    // [start] = rubber-band; same builder as commit either way.
    const tempPoints = startPoint === null ? [] : [startPoint];
    const preview = generateWallPreview(tempPoints, { x: cursorScenePoint.x, y: cursorScenePoint.y }, sceneUnits);
    if (!preview || preview.type !== 'wall') {
      this.setVisible(false);
      return null;
    }
    // ADR-543 — the SAME `wallHud` meta the 2D canvas attaches (length/angle/thickness·height),
    // surfaced so the 3D HUD overlay paints it with the shared `paintWallHudCore`. Only present
    // in awaitingEnd (wantHud), so the before-click ghost returns null (no HUD), mirror of 2D.
    const hudMeta = (preview as { wallHud?: WallHudMeta }).wallHud ?? null;
    this.removeMesh();
    // Same converter as every committed wall; building datum in metres so the ghost
    // lands on the same work-plane the cursor was raycast against.
    const mesh = wallToMesh(
      preview as unknown as WallEntity,
      [],
      floorElevationMm,
      levelId,
      floorElevationMm * MM_TO_M,
    );
    if (!mesh) return hudMeta; // degenerate axis (start ≈ cursor) → no mesh, HUD self-clamps
    this.applyGhostMaterial(mesh);
    mesh.traverse((obj) => {
      obj.userData = {};
      obj.raycast = () => {};
    });
    // Root kept invisible to the MAIN render (ADR-537): the post-FX pass flips it on for its own draw.
    mesh.visible = false;
    this.mesh = mesh;
    this.scene.add(mesh);
    return hudMeta;
  }

  /** Show/hide via the overlay flag — the mesh root stays `visible=false`; the post-FX pass draws it. */
  setVisible(visible: boolean): void {
    this.shown = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unregisterOverlay();
    this.removeMesh();
    this.material.dispose();
  }

  /** Recolour every mesh in the converter output to the shared translucent ghost material. */
  private applyGhostMaterial(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).material = this.material;
    });
  }

  private removeMesh(): void {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    // Dispose every geometry in the subtree. Materials are shared singletons from the
    // converter (or the ghost's own material) — never disposed here.
    this.mesh.traverse((obj) => {
      const g = (obj as THREE.Mesh | THREE.LineSegments).geometry;
      if (g) g.dispose();
    });
    this.mesh = null;
  }
}
