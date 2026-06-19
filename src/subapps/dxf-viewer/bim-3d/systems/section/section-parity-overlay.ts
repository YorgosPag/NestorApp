/**
 * Section cut-parity overlay predicate (ADR-452/483).
 *
 * Extracted from section-stencil-renderer.ts (N.7.1 file-size split) — a pure
 * standalone predicate shared by the stencil parity passes (`capCutSection` +
 * `hideEdgeOverlaysForParity`).
 */
import * as THREE from 'three';

/**
 * ADR-452/483 — true if `obj` is an always-on-top OVERLAY mesh that must NOT take part
 * in the stencil cut-parity passes. Two kinds:
 *  • fat-line edge overlays (`bimEdgeOverlay`) — handled historically (phantom sliver);
 *  • analysis M/V/N diagram fills (`MeshBasicMaterial`, `depthTest:false`) — these are
 *    thin, non-solid, always-on-top ribbons. Rendered through the back-incr/front-decr
 *    parity material they write STRAY stencil (no closed volume), so the cap quad then
 *    fills that region in the cap colour ON TOP of the diagram → «τα διαγράμματα M/V/N
 *    αλλάζουν χρώμα όταν η τομή είναι ενεργή» (Giorgio 2026-06-19). A real solid always
 *    keeps `depthTest:true`, so the depthTest flag cleanly separates overlays from cut
 *    geometry. Excluding them from the parity removes the phantom recolour.
 */
export function isSectionParityOverlay(obj: THREE.Object3D): boolean {
  // Billboard value labels (M/V/N) are THREE.Sprite — always an overlay.
  if ((obj as THREE.Sprite).isSprite) return true;
  if (!(obj instanceof THREE.Mesh)) return false;
  if ((obj.userData as Record<string, unknown>)['bimEdgeOverlay'] === true) return true;
  const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  return (mat as THREE.Material | undefined)?.depthTest === false;
}
