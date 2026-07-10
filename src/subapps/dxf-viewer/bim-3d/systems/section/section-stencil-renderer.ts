/**
 * SectionStencilRenderer — True stencil cap pattern για ADR-366 §A.3.
 *
 * Phase 7.0a (2-pass): per active plane = clearStencil + BackSide scene pass
 *   (IncrementWrap) + FrontSide scene pass (DecrementWrap) + cap quad.
 *   Box mode worst case: 12 full BIM scene renders + 6 cap quads.
 *
 * Phase 7.0b (1-pass): per active plane = clearStencil + zero-area warmup
 *   (cache seed) + single DoubleSide scene pass + cap quad.
 *   Box mode worst case: 6 full BIM scene renders + 6 cap quads.
 *   Reduction: ~50% fewer large scene renders.
 *
 * Phase 7.0C (selection emphasis): after normal cap, if selectedBimId set →
 *   2nd stencil pass με visibility mask (selected entity only) → emphasis
 *   cap (SECTION_CUT_SURFACE.selectedCapColor) rendered on top.
 *   Cost: +1 BIM render + traverse when entity selected (0 cost when idle).
 *
 * 1-pass mechanism (gl.stencilOpSeparate cache trick):
 *   1. Warmup: render zero-area mesh with singlePassMat (stencilZPass=IncrementWrap).
 *      Three.js caches stencil state as IncrementWrap. Zero fragments = no stencil writes.
 *   2. gl.stencilOpSeparate(FRONT, KEEP, KEEP, DECR_WRAP) — overrides WebGL FRONT face only.
 *      Three.js JS cache still shows IncrementWrap (unaware of raw GL call).
 *   3. mainScene render with overrideMaterial=singlePassMat — for every object, Three.js
 *      compares material.stencilZPass (IncrementWrap) vs cached (IncrementWrap) → CACHE HIT
 *      → skips gl.stencilOp → our FRONT override persists throughout.
 *      Result: back-facing fragments → IncrementWrap (entering solid),
 *              front-facing fragments → DecrementWrap (exiting solid). Stencil parity correct.
 *   4. Cap quad: stencilFunc=NotEqual(0) → solid fill where geometry was cut.
 *
 * @see ADR-366 §A.3.Q4 — Cut surface visual decision
 * @see ADR-366 Phase 7.0b implementation note
 */

import * as THREE from 'three';
import { useSelection3DStore } from '../../stores/Selection3DStore';
import {
  type SectionHatchKey,
  disposeHatchCap,
} from './section-hatch-cap';
import {
  createSinglePassMaterial,
  createWarmupScene,
  createCapMaterial,
  createSelectedCapMaterial,
  createSinglePassCutParityMaterial,
  createBackParityMaterial,
  createFrontParityMaterial,
  createOpaqueCutCapMaterial,
} from './section-stencil-materials';
import {
  collectColorGroups,
  collectHatchGroups,
  getColorCapMaterial,
} from './section-cut-cap-groups';
import {
  type SecondaryCapContext,
  type PlaneCapPass,
  renderEmphasisCapForPlane,
  renderHatchOverlaysForPlane,
} from './section-stencil-secondary-passes';
import {
  hideNonParityMeshes,
  restoreHidden,
  withSectionCapRenderState,
} from './section-parity-scene';
import { SECTION_CUT_SURFACE } from '../../../config/color-config';
import {
  resolveEffectiveBounds,
  computeCapSize,
  computeCapCenter,
  positionCapMesh,
} from './section-cap-geometry';
import {
  type ParityMode,
  applyCapDebugState,
  runCutParityPass,
} from './section-cut-parity';

export interface StencilRendererDeps {
  /** BIM group reference για bounding sphere calc (cap quad size). */
  readonly getBimGroup: () => THREE.Object3D;
  /** DXF overlay bounds for combined scene extent. */
  readonly getDxfBounds: () => THREE.Box3 | null;
}

/**
 * ADR-452 v2.9 — cap render-quality ladder (each tier adds cost on top of the prior):
 *  • 'fast'   — opaque grey base poché only (cheapest). Used while the CUT SLIDER drags,
 *               where the sliced geometry changes every frame (the heaviest parity case).
 *  • 'colors' — grey base + per-material-colour cut faces, but NO hatch/emphasis. Used
 *               during CAMERA motion (orbit / pan / wheel-zoom): keeps the Revit-grade
 *               coloured section visible while navigating (Giorgio: «κράτα τα χρώματα
 *               στην κίνηση») without paying for the hatch/emphasis passes.
 *  • 'full'   — everything (+ hatch overlays + selection emphasis). Once motion settles.
 *
 * Costs: the per-colour cut loop adds 2×N full-scene parity renders (N = distinct
 * material colours). 'colors' pays it during camera nav (Giorgio's explicit ask);
 * 'fast' skips it on slider drag where it would compound the per-frame geometry change.
 */
export type SectionCapQuality = 'fast' | 'colors' | 'full';

export class SectionStencilRenderer {
  private readonly deps: StencilRendererDeps;
  /**
   * ADR-452 v2.20 — lone axis-cut parity in ONE DoubleSide scene render (BACK→INCR via
   * the material, FRONT→DECR via a raw `gl.stencilOpSeparate` override + warmup seed),
   * replacing the old two-pass back/front materials. `depthTest` off (lone-plane rule).
   */
  private readonly cutParitySinglePassMat: THREE.MeshBasicMaterial;
  /**
   * ADR-452 v2.22 — ROBUST explicit 2-pass parity (BACK increment + FRONT decrement) for the
   * ALWAYS-SOLID grey base cap. Replaces the fragile v2.20 cache-desync single-pass on the one
   * layer that must never read hollow. Colours/hatch keep the cheaper single-pass (refine path).
   */
  private readonly backParityMat: THREE.MeshBasicMaterial;
  private readonly frontParityMat: THREE.MeshBasicMaterial;
  /** ADR-452 — OPAQUE grey base cap for the horizontal cut (crisp poché, no bleed-through). */
  private readonly cutCapMat: THREE.MeshBasicMaterial;
  private readonly cutCapMesh: THREE.Mesh;
  private readonly cutCapScene: THREE.Scene;
  private readonly singlePassStencilMat: THREE.MeshBasicMaterial;
  private readonly warmupScene: THREE.Scene;
  private readonly capMat: THREE.MeshBasicMaterial;
  private readonly capMesh: THREE.Mesh;
  private readonly capScene: THREE.Scene;
  private readonly selectedCapMat: THREE.MeshBasicMaterial;
  private readonly selectedCapMesh: THREE.Mesh;
  private readonly selectedCapScene: THREE.Scene;
  private readonly hatchCapMesh: THREE.Mesh;
  private readonly hatchCapScene: THREE.Scene;
  /** ADR-452 v2.4 — lazily-built opaque cap materials keyed by material colour hex. */
  private readonly colorCapCache = new Map<number, THREE.MeshBasicMaterial>();
  /** Shared state για τα secondary cap passes (emphasis + hatch overlays). */
  private readonly secondaryCtx: SecondaryCapContext;
  private disposed = false;

  constructor(deps: StencilRendererDeps) {
    this.deps = deps;
    this.cutParitySinglePassMat = createSinglePassCutParityMaterial();
    this.backParityMat = createBackParityMaterial();
    this.frontParityMat = createFrontParityMaterial();
    this.cutCapMat = createOpaqueCutCapMaterial();
    this.cutCapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.cutCapMat);
    this.cutCapMesh.frustumCulled = false;
    this.cutCapScene = new THREE.Scene();
    this.cutCapScene.add(this.cutCapMesh);
    this.singlePassStencilMat = createSinglePassMaterial();
    this.warmupScene = createWarmupScene(this.singlePassStencilMat);
    this.capMat = createCapMaterial();
    const geom = new THREE.PlaneGeometry(1, 1);
    this.capMesh = new THREE.Mesh(geom, this.capMat);
    this.capMesh.frustumCulled = false;
    this.capScene = new THREE.Scene();
    this.capScene.add(this.capMesh);
    this.selectedCapMat = createSelectedCapMaterial();
    const selectedGeom = new THREE.PlaneGeometry(1, 1);
    this.selectedCapMesh = new THREE.Mesh(selectedGeom, this.selectedCapMat);
    this.selectedCapMesh.frustumCulled = false;
    this.selectedCapScene = new THREE.Scene();
    this.selectedCapScene.add(this.selectedCapMesh);
    this.hatchCapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    this.hatchCapMesh.frustumCulled = false;
    this.hatchCapScene = new THREE.Scene();
    this.hatchCapScene.add(this.hatchCapMesh);
    this.secondaryCtx = {
      singlePassStencilMat: this.singlePassStencilMat,
      warmupScene: this.warmupScene,
      selectedCapMat: this.selectedCapMat,
      selectedCapMesh: this.selectedCapMesh,
      selectedCapScene: this.selectedCapScene,
      hatchCapMesh: this.hatchCapMesh,
      hatchCapScene: this.hatchCapScene,
      positionMesh: (mesh, plane, size, center) => positionCapMesh(mesh, plane, size, center),
    };
  }

  /**
   * ADR-452/455 — render the solid cut face for a SINGLE axis-aligned cut plane
   * (horizontal Z View-Range section, or a vertical X/Y section). Caller renders the
   * clipped scene first. Unlike the box {@link render} loop (which excludes the
   * capped plane and relies on depth parity), this keeps the cut plane active during
   * the parity passes so a lone plane caps correctly. The parity passes + `positionMesh`
   * are orientation-agnostic (the cap quad is oriented to the plane normal), so the
   * same algorithm serves any axis. `boundPlanes` (the OTHER cut planes + section box /
   * crop, if any) bound the parity geometry AND the cap quad — empty for a lone cut.
   *
   * @param renderer    Active WebGLRenderer (default framebuffer with stencil)
   * @param mainScene   BIM + DXF scene (clipped by all planes in the prior pass)
   * @param camera      Active camera
   * @param cutPlane    The axis-aligned cut plane (any orientation)
   * @param boundPlanes Other cut + section/crop planes that bound the cap (excludes this plane)
   * @param sceneBounds Scene extent for cap quad size
   */
  renderAxisCutCap(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    cutPlane: THREE.Plane,
    boundPlanes: ReadonlyArray<THREE.Plane>,
    sceneBounds: THREE.Box3 | null,
    quality: SectionCapQuality = 'full',
  ): void {
    if (this.disposed) return;

    const bounds = resolveEffectiveBounds(sceneBounds, this.deps.getBimGroup, this.deps.getDxfBounds);
    const capSize = computeCapSize(bounds);
    const capCenter = computeCapCenter(bounds);
    // Parity geometry: slice the solid at the cut plane (so the cross-section is
    // an open hole), and bound it to the section box / crop region when present.
    const parityClip = [cutPlane, ...boundPlanes] as THREE.Plane[];
    const others = boundPlanes as THREE.Plane[];

    withSectionCapRenderState(renderer, mainScene, () => {
      // ADR-452 v2.22 — dev-only diagnostic (magenta flood, see `applyCapDebugState`). No-op unless
      // `dxf-section-cap-debug=1`; reset to the real render state every frame so the flag is live.
      applyCapDebugState(this.cutCapMat, SECTION_CUT_SURFACE.color, quality);

      // 1) OPAQUE grey base poché over ALL cut geometry — crisp, no bleed-through. ADR-452 v2.22 —
      //    the ALWAYS-SOLID layer uses the ROBUST explicit 2-pass parity (no cache-desync trick),
      //    so it can never read hollow on a heavy scene; colours below keep the cheap single-pass.
      this.capCutSection(
        renderer, mainScene, camera, cutPlane, parityClip, others, capSize, capCenter,
        this.cutCapMesh, this.cutCapScene, this.cutCapMat, null, 'twopass',
      );

      // 2) Per-MATERIAL-COLOUR opaque cut faces — each cut section painted in its
      //    own material colour (concrete core vs plaster finish, etc.) so the layers
      //    read distinctly and cleanly (a busy hatch looked cheap; the clipped per-
      //    layer edges + the true material colour are the crisp, Revit-grade signal).
      //    ADR-452 v2.7/v2.9 — this loop costs 2×N full scene renders + 2×N traversals.
      //    It runs on 'colors' (camera motion: keep the coloured section visible while
      //    navigating) AND 'full' (settled), and is skipped ONLY on 'fast' (cut-slider
      //    drag) where the geometry changes every frame — there the grey base is the live
      //    preview and the refine-on-idle timer restores colours once the slider settles.
      if (quality !== 'fast') {
        const colorGroups = collectColorGroups(mainScene);
        for (const [hex, meshes] of colorGroups) {
          const mat = getColorCapMaterial(this.colorCapCache, hex);
          this.hatchCapMesh.material = mat;
          this.capCutSection(
            renderer, mainScene, camera, cutPlane, parityClip, others, capSize, capCenter,
            this.hatchCapMesh, this.hatchCapScene, mat, meshes, 'single',
          );
        }
      }
    });
  }

  /**
   * ADR-452 — one cut-section cap pass for the horizontal plane: clear stencil, run the
   * back-increment / front-decrement parity over the (optionally isolated) solids sliced
   * at the cut plane, then fill the cap quad where stencil != 0. Shared by the opaque grey
   * base (all geometry, `isolate = null`) and each per-material colour overlay (`isolate` =
   * that material's meshes).
   *
   * `parityMode` picks the parity strategy (ADR-452 v2.22):
   *  • 'twopass' — ROBUST explicit two-pass (BACK incr + FRONT decr, no cache-desync). Used by
   *                the ALWAYS-SOLID grey base so it can never read hollow on a heavy scene.
   *  • 'single'  — cheaper v2.20 single-pass (warmup + raw FRONT override). Used by the
   *                per-colour refine loop only (settle-time, off the must-be-solid path).
   */
  private capCutSection(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    cutPlane: THREE.Plane,
    parityClip: THREE.Plane[],
    others: THREE.Plane[],
    capSize: number,
    capCenter: THREE.Vector3 | null,
    capMesh: THREE.Mesh,
    capScene: THREE.Scene,
    capMaterial: THREE.Material,
    isolate: THREE.Object3D[] | null,
    parityMode: ParityMode,
  ): void {
    // Hide objects that must NOT contribute to the stencil parity, restored after
    // (SSoT `hideNonParityMeshes`, ADR-452/483):
    //  • Always-on-top overlays (edge fat-lines `LineSegments2` extend THREE.Mesh;
    //    M/V/N diagrams/labels) draw the parity Mesh material's template quad and
    //    write stray stencil → a phantom sliver at the cut. Always excluded.
    //  • Isolate path: additionally hide every OTHER bimId solid so a per-material
    //    cap stencils only its own sections (mirrors the box hatch path).
    const keep = isolate ? new Set(isolate) : null;
    const hidden = hideNonParityMeshes(mainScene, keep ? (obj) => keep.has(obj) : undefined);

    // ADR-452 v2.22 — parity strategy (grey base = robust 'twopass', colours = 'single'), see
    // `runCutParityPass`. Leaves stencil != 0 at the cut cross-section.
    runCutParityPass(renderer, mainScene, camera, parityClip, parityMode, {
      backParityMat: this.backParityMat,
      frontParityMat: this.frontParityMat,
      singlePassMat: this.cutParitySinglePassMat,
      warmupScene: this.warmupScene,
    });

    restoreHidden(hidden);

    // Cap quad ON the cut plane, masked to stencil != 0. Bounded by the section /
    // crop planes but NOT the cut plane itself (the quad sits on that plane).
    (capMaterial as THREE.Material & { clippingPlanes: THREE.Plane[] | null }).clippingPlanes = others;
    positionCapMesh(capMesh, cutPlane, capSize, capCenter);
    renderer.render(capScene, camera);
  }

  /**
   * Render stencil caps για κάθε enabled plane. Καλείται ΜΕΤΑ το main scene
   * render (caller πρέπει να έχει κάνει renderer.render(scene, camera) πρώτα
   * με ΟΛΑ τα planes clipping ενεργά).
   *
   * @param renderer    Active WebGLRenderer (στο default framebuffer με stencil)
   * @param mainScene   Η κύρια σκηνή (BIM + DXF + sectionBox + lights)
   * @param camera      Active perspective/ortho camera
   * @param planes      Όλα τα clip planes (1-6 για box, 1-6 για plane mode)
   * @param sceneBounds Bounding box για cap quad size
   */
  render(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    planes: ReadonlyArray<THREE.Plane>,
    sceneBounds: THREE.Box3 | null,
    quality: SectionCapQuality = 'full',
  ): void {
    if (this.disposed || planes.length === 0) return;

    const bounds = resolveEffectiveBounds(sceneBounds, this.deps.getBimGroup, this.deps.getDxfBounds);
    const capSize = computeCapSize(bounds);
    const capCenter = computeCapCenter(bounds);
    // ADR-452 v2.7 — hatch overlays are full-quality only (collect skipped on drafts).
    const hatchGroups = quality === 'full' ? collectHatchGroups(mainScene) : new Map<SectionHatchKey, THREE.Object3D[]>();

    withSectionCapRenderState(renderer, mainScene, () => {
      for (let i = 0; i < planes.length; i++) {
        this.renderCapForPlane(renderer, mainScene, camera, planes, i, capSize, capCenter, hatchGroups, quality);
      }
      mainScene.overrideMaterial = null;
    });
  }

  private renderCapForPlane(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    planes: ReadonlyArray<THREE.Plane>,
    index: number,
    capSize: number,
    capCenter: THREE.Vector3 | null,
    hatchGroups: Map<SectionHatchKey, THREE.Object3D[]>,
    quality: SectionCapQuality,
  ): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const currentPlane = planes[index];
    const others = planes.filter((_, idx) => idx !== index) as THREE.Plane[];

    this.singlePassStencilMat.clippingPlanes = others;
    this.capMat.clippingPlanes = others;

    renderer.clearStencil();

    // Seed Three.js stencil state cache with singlePassMat (IncrementWrap).
    // Required because the previous cap render left the cache at ReplaceStencilOp;
    // without seeding, the first BIM object would cause a cache-miss and Three.js
    // would call gl.stencilOp(INCR_WRAP), overwriting our FRONT face override below.
    renderer.render(this.warmupScene, camera);

    // Override FRONT face stencil op to DecrementWrap (exiting solid).
    // Three.js cache stays IncrementWrap (it doesn't know about this raw GL call),
    // so all BIM objects in the main pass will cache-hit and skip gl.stencilOp.
    // Back-facing fragments keep IncrementWrap (entering solid). Parity → NotEqual(0) → cap.
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);

    const hidden = hideNonParityMeshes(mainScene);
    mainScene.overrideMaterial = this.singlePassStencilMat;
    renderer.render(mainScene, camera);
    mainScene.overrideMaterial = null;
    restoreHidden(hidden);

    positionCapMesh(this.capMesh, currentPlane, capSize, capCenter);
    renderer.render(this.capScene, camera);

    // ADR-452 v2.7 — hatch overlays + selection emphasis are full-quality only; on
    // draft (drag/orbit) frames the base cap above is the live preview, and the
    // refine-on-idle pass restores these once motion settles.
    const pass: PlaneCapPass = {
      renderer, mainScene, camera, gl, otherPlanes: others, currentPlane, capSize, capCenter,
    };
    if (quality === 'full' && hatchGroups.size > 0) {
      renderHatchOverlaysForPlane(this.secondaryCtx, pass, hatchGroups);
    }

    const selectedBimIds = useSelection3DStore.getState().selectedBimIds;
    if (quality === 'full' && selectedBimIds.length > 0) {
      renderEmphasisCapForPlane(this.secondaryCtx, pass, selectedBimIds);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.capMesh.geometry.dispose();
    this.cutParitySinglePassMat.dispose();
    this.backParityMat.dispose();
    this.frontParityMat.dispose();
    this.cutCapMesh.geometry.dispose();
    this.cutCapMat.dispose();
    this.singlePassStencilMat.dispose();
    this.capMat.dispose();
    this.selectedCapMesh.geometry.dispose();
    this.selectedCapMat.dispose();
    this.hatchCapMesh.geometry.dispose();
    const warmupMesh = this.warmupScene.children[0] as THREE.Mesh | undefined;
    if (warmupMesh) {
      warmupMesh.geometry.dispose();
      this.warmupScene.remove(warmupMesh);
    }
    for (const scene of [this.capScene, this.cutCapScene, this.selectedCapScene, this.hatchCapScene]) {
      while (scene.children.length > 0) scene.remove(scene.children[0]);
    }
    for (const mat of this.colorCapCache.values()) mat.dispose();
    this.colorCapCache.clear();
    disposeHatchCap();
  }
}
