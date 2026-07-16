/**
 * BandStackPreviewRenderer — SSoT mini THREE viewport for every «Edit … Type»
 * dialog live preview (ADR-412/ADR-414). Wall and slab previews were byte-level
 * twins (jscpd: 101L/627T + 45L/425T clones); this owns the shared scene and the
 * siblings supply only what genuinely differs, via a `BandStackPreviewSpec`.
 *
 * A SELF-CONTAINED, lightweight renderer — deliberately NOT the main
 * `ThreeJsSceneManager` / `BimViewport3D` (the ADR-040 high-frequency path). A
 * tiny scene with a FIXED 3/4 camera, shadows OFF (a preview needs none), and
 * RENDER-ON-DEMAND (one frame per state change — no RAF loop).
 *
 * Each DNA layer becomes a textured `BoxGeometry` band (geometry from the spec's
 * `buildBands`, materials from the shared texture-aware `getMaterial3D`).
 * Highlight is a bright edge OUTLINE — it NEVER mutates the shared material
 * singletons (that would bleed into the main 3D scene).
 *
 * Lifecycle: construct → `setDna` / `setHighlight` / `applyTextures` / `resize`
 * → `dispose` (frees the WebGL context — browsers cap concurrent contexts).
 *
 * @see SlabTypePreviewRenderer.ts / WallTypePreviewRenderer.ts — the specs
 * @see ../materials/MaterialCatalog3D.ts — getMaterial3D (texture-aware)
 * @see docs/centralized-systems/reference/adrs/ADR-414-wall-type-live-preview.md
 */

import * as THREE from 'three';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { setBoxWorldUvs } from '../converters/bim-uv-helpers';
import { createBimLights } from '../scene/scene-setup';
import { PreviewOrbitControls } from './preview-orbit-controls';
import { resolvePreviewPivot, PreviewPivotMarker } from './preview-pivot';

const HIGHLIGHT_COLOR = 0x38bdf8; // sky-400 — bright outline on the active band.
const BG_COLOR = 0x1a1a1a;

/** The minimum a DNA must expose to be previewed: identified layers + total mm. */
export interface PreviewDnaLike {
  readonly layers: readonly { readonly id: string; readonly materialId: string }[];
  /** mm — sum of layer thicknesses (SSoT). */
  readonly totalThickness: number;
}

/** The minimum a built band must expose: what it is, and what it's made of. */
export interface PreviewBandLike {
  readonly layerId: string;
  readonly materialId: string;
}

/** A band's box in preview meters. Tuples are `[x, y, z]`. */
export interface PreviewBandBox {
  readonly size: readonly [number, number, number];
  readonly position: readonly [number, number, number];
}

/** Everything that differs between the wall / slab previews — and nothing else. */
export interface BandStackPreviewSpec<TDna extends PreviewDnaLike, TBand extends PreviewBandLike> {
  /** 3/4 view direction (unit, origin → camera) chosen so the layer stack reads. */
  readonly viewDir: THREE.Vector3;
  /** Stub thickness (m) used to frame the camera before any DNA arrives. */
  readonly fallbackThicknessM: number;
  /** Pure band math — the stack this preview draws. */
  buildBands(dna: TDna): readonly TBand[];
  /** This band's box, in the stub's local frame. */
  boxOf(band: TBand): PreviewBandBox;
  /** Stub half-extents `[hx, hy, hz]` for the given total thickness (m). */
  halfExtents(totalM: number): readonly [number, number, number];
}

/**
 * What a preview panel needs from a renderer. `BandStackPreviewRenderer` (and so
 * every sibling) satisfies it structurally — panels depend on this, not on a
 * concrete class, so the generic panel stays free of the band type parameter.
 */
export interface BandStackPreviewHandle<TDna extends PreviewDnaLike> {
  setDna(dna: TDna | undefined): void;
  setHighlight(layerId: string | null): void;
  applyTextures(): void;
  pickLayerAt(ndcX: number, ndcY: number): string | null;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** A built band: its mesh + the DNA layer id it represents. */
interface BandMesh {
  readonly layerId: string;
  readonly mesh: THREE.Mesh;
}

export class BandStackPreviewRenderer<
  TDna extends PreviewDnaLike,
  TBand extends PreviewBandLike,
> {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bandGroup: THREE.Group;
  private readonly controls: PreviewOrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pivotMarker: PreviewPivotMarker;
  private bands: BandMesh[] = [];
  private outline: THREE.LineSegments | null = null;
  private highlightedLayerId: string | null = null;
  private dna: TDna | undefined;

  constructor(
    container: HTMLElement,
    private readonly spec: BandStackPreviewSpec<TDna, TBand>,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || 320, container.clientHeight || 240);
    this.renderer.setClearColor(BG_COLOR, 1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const lights = createBimLights();
    this.scene.add(lights.ambient, lights.sun, lights.hemi);
    lights.sun.castShadow = false; // preview: no shadow maps allocated
    lights.sun.position.set(2, 4, 3);

    this.camera = new THREE.PerspectiveCamera(35, this.aspect(), 0.01, 100);
    this.bandGroup = new THREE.Group();
    this.scene.add(this.bandGroup);
    this.pivotMarker = new PreviewPivotMarker(this.scene);

    // Zoom (wheel) + pan (left drag) + rotate (right drag), render-on-demand.
    // Alt + left-click re-centres the orbit pivot on the picked band point.
    this.controls = new PreviewOrbitControls(
      this.camera,
      this.renderer.domElement,
      () => this.render(),
      (cx, cy) => this.setPivotAt(cx, cy),
    );
  }

  /** Replace the previewed composition (rebuilds bands + reframes the camera). */
  setDna(dna: TDna | undefined): void {
    this.dna = dna;
    this.clearBands();
    this.clearOutline();
    if (dna) {
      for (const band of this.spec.buildBands(dna)) {
        this.bands.push(this.buildBand(band));
      }
    }
    // Keep auto-framing while editing layers — but never override a view the
    // user has zoomed/panned/rotated themselves.
    if (!this.controls.adjusted) {
      this.fitCamera();
      this.controls.recenter();
    }
    this.render();
  }

  /** Outline the active band (or clear when null). Never mutates materials. */
  setHighlight(layerId: string | null): void {
    // Idempotent — same layer (e.g. a pointermove that stays on the band) is a
    // no-op, so the outline does NOT clear+rebuild every frame (that flickered).
    if (layerId === this.highlightedLayerId) return;
    this.clearOutline();
    this.highlightedLayerId = layerId;
    const target = layerId ? this.bands.find((b) => b.layerId === layerId) : undefined;
    if (target) {
      const edges = new THREE.EdgesGeometry(target.mesh.geometry);
      this.outline = new THREE.LineSegments(
        edges,
        // depthTest:false + high renderOrder → crisp on top, no z-fighting, so the
        // outline can sit EXACTLY on the band edges (scale 1.0) and coincide with
        // its boundaries instead of overhanging (the old 1.015 scale missed them).
        new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR, depthTest: false, transparent: true }),
      );
      this.outline.position.copy(target.mesh.position);
      this.outline.renderOrder = 998;
      this.bandGroup.add(this.outline); // same parent as the bands → shared coords
    }
    this.render();
  }

  /** Re-resolve materials after an async texture load (flat → textured swap). */
  applyTextures(): void {
    if (!this.dna) return;
    const byId = new Map(this.dna.layers.map((l) => [l.id, l.materialId]));
    for (const band of this.bands) {
      const matId = byId.get(band.layerId);
      if (matId) band.mesh.material = getMaterial3D(matId);
    }
    this.render();
  }

  /** Hit-test a band at canvas-normalized coords (−1..1); returns its layer id. */
  pickLayerAt(ndcX: number, ndcY: number): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    // Raycast ONLY the band meshes — never the highlight outline / pivot marker
    // (LineSegments have a ~1-unit raycast threshold that would steal the hit and
    // make the pick oscillate band↔null while the cursor moves → outline flicker).
    const hits = this.raycaster.intersectObjects(this.bands.map((b) => b.mesh), false);
    const mesh = hits[0]?.object;
    return this.bands.find((b) => b.mesh === mesh)?.layerId ?? null;
  }

  /** Re-fit the renderer + camera to the container size. */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    if (!this.controls.adjusted) {
      this.fitCamera(); // distance depends on aspect → refit so nothing is clipped
      this.controls.recenter();
    } else {
      this.camera.updateProjectionMatrix(); // preserve the user's view, just fix aspect
    }
    this.render();
  }

  /** Free the WebGL context + GPU resources. Call on unmount. */
  dispose(): void {
    this.clearBands();
    this.clearOutline();
    this.pivotMarker.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  /**
   * Alt+click: set the orbit pivot to the world-point under the cursor (a band
   * point when one is hit, else a camera-facing plane through the centre) and
   * flash a crosshair there so the re-centre is visible. SSoT in `preview-pivot`.
   */
  private setPivotAt(clientX: number, clientY: number): void {
    const point = resolvePreviewPivot(
      this.raycaster, this.camera, this.renderer.domElement,
      this.bands.map((b) => b.mesh), clientX, clientY, // bands only (skip outline/marker)
    );
    if (!point) return;
    this.controls.setPivot(point);
    this.pivotMarker.flashAt(point, () => this.render());
  }

  private buildBand(band: TBand): BandMesh {
    const { size, position } = this.spec.boxOf(band);
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    setBoxWorldUvs(geo); // per-face world-meter UVs → matches the 3D (no stripes)
    const mesh = new THREE.Mesh(geo, getMaterial3D(band.materialId));
    mesh.position.set(position[0], position[1], position[2]);
    this.bandGroup.add(mesh);
    return { layerId: band.layerId, mesh };
  }

  /**
   * Fit the whole stub in view, fully centered. Solves the exact camera distance
   * so all 8 box corners sit inside the frustum (both H and V FOV) — a tight fit
   * that fills the panel WITHOUT clipping any corner (the bounding-sphere
   * approximation over-zoomed an asymmetric view and clipped the near corner).
   */
  private fitCamera(): void {
    const totalM = this.dna ? this.dna.totalThickness / 1000 : this.spec.fallbackThicknessM;
    const [hx, hy, hz] = this.spec.halfExtents(totalM);
    const dir = this.spec.viewDir; // unit, origin → camera
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 180 / 2);
    const tanH = tanV * this.camera.aspect;
    let dist = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Vector3(sx * hx, sy * hy, sz * hz);
      const depthAt = p.dot(dir); // corner's offset toward the camera
      dist = Math.max(dist, depthAt + Math.abs(p.dot(right)) / tanH, depthAt + Math.abs(p.dot(up)) / tanV);
    }
    dist *= 1.04; // small breathing margin
    this.camera.position.copy(dir).multiplyScalar(dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private aspect(): number {
    const w = this.renderer.domElement.width || 320;
    const h = this.renderer.domElement.height || 240;
    return w / h;
  }

  private clearBands(): void {
    for (const band of this.bands) {
      this.bandGroup.remove(band.mesh);
      band.mesh.geometry.dispose(); // materials are shared singletons — never dispose
    }
    this.bands = [];
  }

  private clearOutline(): void {
    this.highlightedLayerId = null;
    if (!this.outline) return;
    this.bandGroup.remove(this.outline);
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.outline = null;
  }
}
