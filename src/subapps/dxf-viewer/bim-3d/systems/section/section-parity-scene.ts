/**
 * section-parity-scene — shared scene-masking + renderer-state helpers for the
 * section stencil cap passes (ADR-366 §A.3 / ADR-452).
 *
 * ADR-621 — SSoT for two patterns the cap passes repeated across
 * `section-stencil-renderer` and `section-stencil-secondary-passes`:
 *   • {@link hideNonParityMeshes} / {@link restoreHidden} — hide the objects that
 *     must NOT contribute to a stencil-parity pass (always the always-on-top
 *     overlays; optionally every BIM mesh outside an isolate/selection set), then
 *     restore them. The four parity passes shared this traverse-and-hide loop.
 *   • {@link withSectionCapRenderState} — the RAII guard that puts the renderer into
 *     the cap-pass state (autoClear* off, background nulled) and restores it after,
 *     which `renderAxisCutCap` and the box `render()` loop both save/restore inline.
 */

import * as THREE from 'three';
import { isSectionParityOverlay } from './section-parity-overlay';

/**
 * Predicate deciding whether a cut BIM mesh stays VISIBLE for the parity pass.
 * Called ONLY for meshes carrying a `bimId` — overlays are always hidden, and
 * meshes without a `bimId` are always kept. Return `false` to hide the mesh.
 */
export type KeepParityMesh = (mesh: THREE.Mesh, bimId: unknown) => boolean;

/**
 * Hide the objects that would corrupt a stencil-parity pass, returning the list to
 * restore afterwards (via {@link restoreHidden}). Two rules:
 *  • Always hide always-on-top overlays (edge fat-lines `LineSegments2` extend
 *    THREE.Mesh; M/V/N diagrams/labels are depthTest-off) — the SSoT predicate
 *    `isSectionParityOverlay` — since the parity Mesh material writes their stray
 *    stencil → a phantom sliver / recolour at the cut.
 *  • When `keepMesh` is given, additionally hide every `bimId` mesh it rejects, so a
 *    per-material / selection cap stencils only its own solids. Omit it to hide
 *    overlays only (the shared box/plane parity pass masks nothing else).
 */
export function hideNonParityMeshes(
  mainScene: THREE.Scene,
  keepMesh?: KeepParityMesh,
): THREE.Object3D[] {
  const hidden: THREE.Object3D[] = [];
  mainScene.traverse((obj) => {
    // Only hide currently-visible objects — restore re-shows everything collected,
    // so pushing an already-hidden object would wrongly reveal it as a phantom.
    if (!obj.visible) return;
    if (isSectionParityOverlay(obj)) {
      hidden.push(obj);
      obj.visible = false;
      return;
    }
    if (!keepMesh || !(obj instanceof THREE.Mesh)) return;
    const bimId = (obj.userData as Record<string, unknown>)['bimId'];
    if (bimId === undefined) return;
    if (!keepMesh(obj, bimId)) {
      hidden.push(obj);
      obj.visible = false;
    }
  });
  return hidden;
}

/** Re-show every object hidden by {@link hideNonParityMeshes}. */
export function restoreHidden(hidden: readonly THREE.Object3D[]): void {
  for (const obj of hidden) obj.visible = true;
}

/**
 * Run `body` with the renderer configured for the cut cap passes, restoring the
 * prior state afterwards (even if `body` throws). The cap passes composite ON TOP
 * of the already-rendered clipped scene, so they must NOT clear any buffer:
 * `autoClear*` all off. The scene background is nulled because — with autoClear off
 * — three.js' `WebGLBackground` still forces a `gl.clear(0)` for a Color/Texture
 * background → a zero-bitmask "no buffers in bitmask" warning every parity pass
 * (console flood + RAF jank). ADR-452.
 */
export function withSectionCapRenderState(
  renderer: THREE.WebGLRenderer,
  mainScene: THREE.Scene,
  body: () => void,
): void {
  const savedAutoClear = renderer.autoClear;
  const savedAutoClearColor = renderer.autoClearColor;
  const savedAutoClearDepth = renderer.autoClearDepth;
  const savedAutoClearStencil = renderer.autoClearStencil;
  const savedBackground = mainScene.background;
  renderer.autoClear = false;
  renderer.autoClearColor = false;
  renderer.autoClearDepth = false;
  renderer.autoClearStencil = false;
  mainScene.background = null;
  try {
    body();
  } finally {
    mainScene.background = savedBackground;
    renderer.autoClear = savedAutoClear;
    renderer.autoClearColor = savedAutoClearColor;
    renderer.autoClearDepth = savedAutoClearDepth;
    renderer.autoClearStencil = savedAutoClearStencil;
  }
}
