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
 */
export function createOpaqueCutCapMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: SECTION_CUT_SURFACE.color,
    opacity: 1,
    transparent: false,
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
 * ADR-452 — parity material for the single horizontal cut-plane cap.
 *
 * Classic two-pass stencil capping (the algorithm Revit / the three.js
 * `webgl_clipping_stencil` example use): with the cut plane ACTIVE in clipping
 * the solid is sliced open at the plane; rendering BACK faces (`IncrementWrap`)
 * and FRONT faces (`DecrementWrap`) leaves a non-zero stencil parity exactly at
 * the cross-section opening. `depthTest = false` so the parity is counted over
 * the whole sliced solid (independent of the already-clipped depth buffer) —
 * this is the fix for the lone-plane case the box renderer's depth-based
 * single-pass trick could not handle (it polluted above the cut).
 */
export function createCutParityMaterial(side: THREE.Side, zPassOp: THREE.StencilOp): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial();
  mat.side = side;
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = false;
  mat.stencilWrite = true;
  mat.stencilFunc = THREE.AlwaysStencilFunc;
  mat.stencilFail = THREE.KeepStencilOp;
  mat.stencilZFail = THREE.KeepStencilOp;
  mat.stencilZPass = zPassOp;
  return mat;
}
