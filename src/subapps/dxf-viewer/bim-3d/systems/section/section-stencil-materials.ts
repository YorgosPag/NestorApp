/**
 * section-stencil-materials — pure factory helpers for {@link SectionStencilRenderer}.
 *
 * Extracted from `section-stencil-renderer.ts` (file-size SSoT N.7.1). These build
 * the stencil/cap THREE materials + warmup scene; none depend on renderer instance
 * state, so they live here as free functions. See ADR-366 §A.3 / ADR-452 for the
 * stencil-parity capping algorithm they support.
 *
 * ADR-621 — the seven public builders are thin wrappers over TWO SSoT constructors:
 *   • {@link createParityStencilMaterial} — the four colour-less parity materials
 *     (they differ ONLY in `side` / `depthTest` / `stencilZPass`).
 *   • {@link createCutCapMaterial} — the NotEqual(0)→Replace cap materials (box cap,
 *     opaque View-Range cap, selection emphasis; also reused by the hatch + colour
 *     cap caches) — they differ in colour/opacity/texture, `depthTest`, polygonOffset.
 */

import * as THREE from 'three';
import { SECTION_CUT_SURFACE } from '../../../config/color-config';

interface ParityStencilOptions {
  readonly side: THREE.Side;
  readonly depthTest: boolean;
  readonly zPass: THREE.StencilOp;
}

/**
 * SSoT for the colour-less stencil-PARITY materials. All four share the same
 * skeleton — colorWrite OFF, depthWrite OFF, `Always`/`Keep`/`Keep` stencil ops —
 * and vary ONLY in `side`, `depthTest`, and the `stencilZPass` (Increment vs
 * Decrement). Callers document the per-material ADR rationale.
 */
function createParityStencilMaterial(opts: ParityStencilOptions): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial();
  mat.side = opts.side;
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = opts.depthTest;
  mat.stencilWrite = true;
  mat.stencilFunc = THREE.AlwaysStencilFunc;
  mat.stencilFail = THREE.KeepStencilOp;
  mat.stencilZFail = THREE.KeepStencilOp;
  mat.stencilZPass = opts.zPass;
  return mat;
}

interface CutCapOptions {
  readonly color?: THREE.ColorRepresentation;
  readonly opacity?: number;
  readonly map?: THREE.Texture;
  readonly depthTest: boolean;
  /** Negative polygon offset (factor = units = value) to win the coplanar rim z-fight. */
  readonly polygonOffset?: number;
}

/**
 * SSoT for the NotEqual(0)→Replace stencil CAP materials. All share the same
 * stencil mask (ref 0, `NotEqual`, `Replace`×3) + DoubleSide / depthWrite-off
 * skeleton, and vary in colour/opacity/texture, `depthTest`, and the optional
 * coplanar `polygonOffset`. Callers document the per-material ADR rationale.
 */
function createCutCapMaterial(opts: CutCapOptions): THREE.MeshBasicMaterial {
  const params: THREE.MeshBasicMaterialParameters = {
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: opts.depthTest,
  };
  if (opts.color !== undefined) params.color = opts.color;
  if (opts.map !== undefined) params.map = opts.map;
  if (opts.opacity !== undefined) {
    params.opacity = opts.opacity;
    params.transparent = opts.opacity < 1;
  }
  if (opts.polygonOffset !== undefined) {
    params.polygonOffset = true;
    params.polygonOffsetFactor = opts.polygonOffset;
    params.polygonOffsetUnits = opts.polygonOffset;
  }
  const mat = new THREE.MeshBasicMaterial(params);
  mat.stencilWrite = true;
  mat.stencilRef = 0;
  mat.stencilFunc = THREE.NotEqualStencilFunc;
  mat.stencilFail = THREE.ReplaceStencilOp;
  mat.stencilZFail = THREE.ReplaceStencilOp;
  mat.stencilZPass = THREE.ReplaceStencilOp;
  return mat;
}

/**
 * 1-pass DoubleSide stencil material (Phase 7.0b). BACK face → IncrementWrap via
 * the material property; FRONT face → DecrementWrap via a per-plane
 * `gl.stencilOpSeparate` override the renderer applies at draw time.
 */
export function createSinglePassMaterial(): THREE.MeshBasicMaterial {
  return createParityStencilMaterial({
    side: THREE.DoubleSide,
    depthTest: true,
    zPass: THREE.IncrementWrapStencilOp,
  });
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
  return createCutCapMaterial({
    color: SECTION_CUT_SURFACE.color,
    opacity: SECTION_CUT_SURFACE.opacity,
    depthTest: false,
  });
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
 *
 * ADR-452 v2.22 — negative `polygonOffset` so the cap quad (coplanar with the cut) always
 * WINS the depth z-fight against the clipped geometry's cut rim. On a heavy / large-extent
 * scene the wider depth range gives coarser precision, so a plain `depthTest:true` cap can
 * lose the tie at the rim and drop out (the «κούφιο λεπτό πανό»); biasing it a hair toward
 * the camera keeps the poché solid without changing which geometry occludes it (units are
 * tiny relative to the walls/columns that must still hide a roof cut from below, v2.19).
 */
export function createOpaqueCutCapMaterial(): THREE.MeshBasicMaterial {
  return createCutCapMaterial({
    color: SECTION_CUT_SURFACE.color,
    opacity: 1,
    depthTest: true,
    polygonOffset: -1,
  });
}

export function createSelectedCapMaterial(): THREE.MeshBasicMaterial {
  return createCutCapMaterial({
    color: SECTION_CUT_SURFACE.selectedCapColor,
    opacity: SECTION_CUT_SURFACE.selectedCapOpacity,
    depthTest: false,
  });
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
  return createParityStencilMaterial({
    side: THREE.DoubleSide,
    depthTest: false,
    zPass: THREE.IncrementWrapStencilOp,
  });
}

/**
 * ADR-452 v2.22 — ROBUST 2-pass parity for the ALWAYS-SOLID grey base cap.
 *
 * The v2.20 single-pass parity ({@link createSinglePassCutParityMaterial}) folds
 * back-increment + front-decrement into ONE DoubleSide render by seeding Three.js'
 * stencil-op cache and then overriding the FRONT face with a raw
 * `gl.stencilOpSeparate` call — relying on Three.js issuing `gl.stencilOp` EXACTLY
 * once and cache-hitting for every subsequent object. On a heavy floor (≈800 meshes)
 * a mid-render program compile / state re-validation can cache-MISS and re-issue
 * `gl.stencilOp`, wiping the FRONT override → the front faces stop decrementing → the
 * cross-section parity is wrong → the cap quad's `NotEqual(0)` mask fills nothing →
 * the cut reads HOLLOW («λεπτά κάθετα κούφια πανό») and never recovers.
 *
 * The grey base is the one ALWAYS-ON, must-never-be-hollow layer, so it uses the
 * proven pre-v2.20 explicit two-pass instead: BACK faces increment (this material),
 * FRONT faces decrement ({@link createFrontParityMaterial}) as TWO plain scene
 * renders — no cache trick, correct for ANY geometry (convex, nested, L-walls), not
 * just a lucky cache state. Cost is +1 full-scene render on the grey layer ONLY; the
 * per-material colour loop (settle-time refine, off the critical path) keeps the
 * cheaper single-pass. `depthTest = false` matches the lone-plane rule (count parity
 * over the whole sliced solid, independent of the already-clipped depth buffer).
 */
export function createBackParityMaterial(): THREE.MeshBasicMaterial {
  return createParityStencilMaterial({
    side: THREE.BackSide,
    depthTest: false,
    zPass: THREE.IncrementWrapStencilOp,
  });
}

/** ADR-452 v2.22 — FRONT-face decrement pass of the robust 2-pass grey-base parity. */
export function createFrontParityMaterial(): THREE.MeshBasicMaterial {
  return createParityStencilMaterial({
    side: THREE.FrontSide,
    depthTest: false,
    zPass: THREE.DecrementWrapStencilOp,
  });
}

export { createCutCapMaterial };
