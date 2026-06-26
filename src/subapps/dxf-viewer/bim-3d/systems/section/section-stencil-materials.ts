/**
 * section-stencil-materials — pure factory helpers for {@link SectionStencilRenderer}.
 *
 * Extracted from `section-stencil-renderer.ts` (file-size SSoT N.7.1). These build
 * the stencil/cap THREE materials + warmup scene; none depend on renderer instance
 * state, so they live here as free functions. See ADR-366 §A.3 / ADR-452 for the
 * stencil-parity capping algorithm they support.
 */

import * as THREE from 'three';
import { SECTION_CUT_SURFACE } from '../../../config/color-config';

/**
 * 1-pass DoubleSide stencil material (Phase 7.0b). BACK face → IncrementWrap via
 * the material property; FRONT face → DecrementWrap via a per-plane
 * `gl.stencilOpSeparate` override the renderer applies at draw time.
 */
export function createSinglePassMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial();
  mat.side = THREE.DoubleSide;
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = true;
  mat.stencilWrite = true;
  mat.stencilFunc = THREE.AlwaysStencilFunc;
  mat.stencilFail = THREE.KeepStencilOp;
  mat.stencilZFail = THREE.KeepStencilOp;
  mat.stencilZPass = THREE.IncrementWrapStencilOp;
  return mat;
}

/**
 * Zero-area plane (scale=0): zero fragments rendered → zero stencil writes.
 * Sole purpose: trigger Three.js's `updateCommonMaterial(singlePassMat)` so the
 * stencil state cache is seeded with IncrementWrap before the real scene pass.
 */
export function createWarmupScene(singlePassMat: THREE.MeshBasicMaterial): THREE.Scene {
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), singlePassMat);
  mesh.scale.set(0, 0, 1);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return scene;
}

export function createCapMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: SECTION_CUT_SURFACE.color,
    opacity: SECTION_CUT_SURFACE.opacity,
    transparent: SECTION_CUT_SURFACE.opacity < 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  mat.stencilWrite = true;
  mat.stencilRef = 0;
  mat.stencilFunc = THREE.NotEqualStencilFunc;
  mat.stencilFail = THREE.ReplaceStencilOp;
  mat.stencilZFail = THREE.ReplaceStencilOp;
  mat.stencilZPass = THREE.ReplaceStencilOp;
  return mat;
}

/**
 * ADR-452 — OPAQUE grey base cap for the horizontal Revit View-Range cut.
 *
 * Unlike the section-box {@link createCapMaterial} (semi-transparent so you can
 * see into the box), the View-Range cut wants a CRISP, fully opaque poché — the
 * geometry below must NOT bleed through (that "muddy" look). Per-material hatch
 * overlays (RC dots, steel, masonry…) are drawn on top of this base, mirroring
 * the box's `section-hatch-cap` poché (SSoT).
 *
 * ADR-452 v2.18 — `depthTest: true` (the VISIBLE cap quad must respect depth, unlike
 * the parity passes). With it `false` the cap drew on top of EVERYTHING regardless of
 * the camera, so a cut through the roof slab kept the whole roof poché in the
 * foreground — from below it covered the walls/columns/beams that should occlude it
 * (Giorgio 2026-06-13). The caller keeps the main-scene depth buffer (cap passes set
 * `autoClearDepth = false`), so depth-testing the cap against the clipped scene makes
 * nearer geometry hide it correctly (standard three.js `webgl_clipping_stencil` cap).
 * `depthWrite` stays false — the cap is a decorative final fill, it must not pollute Z.
 */
export function createOpaqueCutCapMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: SECTION_CUT_SURFACE.color,
    opacity: 1,
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });
  mat.stencilWrite = true;
  mat.stencilRef = 0;
  mat.stencilFunc = THREE.NotEqualStencilFunc;
  mat.stencilFail = THREE.ReplaceStencilOp;
  mat.stencilZFail = THREE.ReplaceStencilOp;
  mat.stencilZPass = THREE.ReplaceStencilOp;
  return mat;
}

export function createSelectedCapMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: SECTION_CUT_SURFACE.selectedCapColor,
    opacity: SECTION_CUT_SURFACE.selectedCapOpacity,
    transparent: SECTION_CUT_SURFACE.selectedCapOpacity < 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  mat.stencilWrite = true;
  mat.stencilRef = 0;
  mat.stencilFunc = THREE.NotEqualStencilFunc;
  mat.stencilFail = THREE.ReplaceStencilOp;
  mat.stencilZFail = THREE.ReplaceStencilOp;
  mat.stencilZPass = THREE.ReplaceStencilOp;
  return mat;
}

/**
 * ADR-452 v2.20 — SINGLE-PASS parity material for a lone axis-aligned cut plane.
 *
 * Consolidates the old two-pass capping (a BackSide `IncrementWrap` material +
 * a FrontSide `DecrementWrap` material, rendered as TWO full-scene passes) into
 * ONE DoubleSide scene render, reusing the box path's proven Phase-7.0b trick:
 * a zero-area warmup seeds Three.js' stencil-op cache with `IncrementWrap`, then
 * a per-pass raw `gl.stencilOpSeparate(FRONT → DecrementWrap)` overrides only the
 * front face. BACK faces increment, FRONT faces decrement → the SAME non-zero
 * stencil parity at the cross-section opening, at HALF the full-scene renders.
 * The parity (Σ back-INCR − Σ front-DECR per pixel) is order-independent with
 * depth-testing off, so a single pass is bit-for-bit equivalent to the two.
 *
 * Unlike the box {@link createSinglePassMaterial} this keeps `depthTest = false`:
 * a lone cut plane must count parity over the WHOLE sliced solid, independent of
 * the already-clipped depth buffer (a depth-tested parity polluted ABOVE the cut —
 * the lone-plane bug the original two-pass material was written to fix). The
 * stencil-op cache trick is independent of depth state, so the warmup (which uses
 * the `depthTest:true` `singlePassStencilMat`) still seeds the right op here.
 */
export function createSinglePassCutParityMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial();
  mat.side = THREE.DoubleSide;
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = false;
  mat.stencilWrite = true;
  mat.stencilFunc = THREE.AlwaysStencilFunc;
  mat.stencilFail = THREE.KeepStencilOp;
  mat.stencilZFail = THREE.KeepStencilOp;
  mat.stencilZPass = THREE.IncrementWrapStencilOp;
  return mat;
}
