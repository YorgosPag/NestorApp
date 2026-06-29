/**
 * sized-render-target.ts — size-managed WebGLRenderTarget SSoT (ADR-516 Phase 2).
 *
 * Centralises the "lazily create, else resize-in-place to (w,h)" idiom that was duplicated across
 * the bim-3d render targets: the selection silhouette mask (`SelectionOutlinePass`), the 3D grip
 * depth probe (`grip-3d-depth-occluder`) and the frozen DXF backdrop (`dxf-backdrop-cache`).
 *
 * `create` builds the target with its OWN options (depthTexture / colorSpace / buffer flags) — only
 * the branch logic is shared. Resize uses `setSize` (NOT dispose+recreate), so the SAME texture
 * object is kept across viewport resizes → a bound `material.map` / `depthTexture` stays valid.
 */

import type * as THREE from 'three';

export function ensureSizedRenderTarget(
  existing: THREE.WebGLRenderTarget | null,
  width: number,
  height: number,
  create: (w: number, h: number) => THREE.WebGLRenderTarget,
): THREE.WebGLRenderTarget {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  if (!existing) return create(w, h);
  if (existing.width !== w || existing.height !== h) existing.setSize(w, h);
  return existing;
}
