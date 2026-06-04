/**
 * SlabTypePreviewRenderer — standalone mini THREE viewport for the «Edit Slab
 * Type» dialog's live preview (ADR-412/ADR-414). Slab analogue of
 * `WallTypePreviewRenderer`.
 *
 * A SELF-CONTAINED, lightweight renderer — deliberately NOT the main ADR-040
 * high-frequency 3D path. A tiny scene with a FIXED 3/4 camera (front + top
 * faces visible so the vertical layer stack reads), shadows OFF, RENDER-ON-DEMAND.
 *
 * Each DNA layer becomes a textured `BoxGeometry` band STACKED VERTICALLY across
 * the slab thickness (geometry from `buildSlabTypePreviewBands`, materials from
 * the shared texture-aware `getMaterial3D`). Highlight is a bright edge OUTLINE —
 * it NEVER mutates the shared material singletons.
 *
 * @see ../converters/slab-type-preview-geometry.ts — pure band math
 * @see WallTypePreviewRenderer.ts — the wall sibling
 */

import * as THREE from 'three';
import type { SlabDna } from '../../bim/types/slab-dna-types';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { setPlanarWorldUvs } from '../converters/bim-uv-helpers';
import { createBimLights } from '../scene/scene-setup';
import { PreviewOrbitControls } from './preview-orbit-controls';
import { resolvePreviewPivot, PreviewPivotMarker } from './preview-pivot';
import {
  buildSlabTypePreviewBands,
  type SlabPreviewBand,
} from '../converters/slab-type-preview-geometry';

/** Synthetic stub footprint (meters) — a short, wide slab patch. */
const STUB_WIDTH_M = 1.4; // X (along the section the layers read across)
const STUB_DEPTH_M = 0.9; // Z
/**
 * 3/4 view direction. Weighted toward +Z (the FRONT face, where the vertical
 * layer stack is visible) + +Y (TOP) + a smaller +X so the slab reads as a solid
 * with its layered edge facing the viewer.
 */
const VIEW_DIR = new THREE.Vector3(0.85, 1.05, 1.5).normalize();
const HIGHLIGHT_COLOR = 0x38bdf8; // sky-400 — bright outline on the active band.
const BG_COLOR = 0x1a1a1a;

/** A built band: its mesh + the DNA layer id it represents. */
interface BandMesh {
  readonly layerId: string;
  readonly mesh: THREE.Mesh;
}

export class SlabTypePreviewRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bandGroup: THREE.Group;
  private readonly controls: PreviewOrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pivotMarker: PreviewPivotMarker;
  private bands: BandMesh[] = [];
  private outline: THREE.LineSegments | null = null;
  private dna: SlabDna | undefined;

  constructor(container: HTMLElement) {
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
  setDna(dna: SlabDna | undefined): void {
    this.dna = dna;
    this.clearBands();
    this.clearOutline();
    if (dna) {
      for (const band of buildSlabTypePreviewBands(dna)) {
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
    this.clearOutline();
    const target = layerId ? this.bands.find((b) => b.layerId === layerId) : undefined;
    if (target) {
      const edges = new THREE.EdgesGeometry(target.mesh.geometry);
      this.outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR }),
      );
      this.outline.position.copy(target.mesh.position);
      this.outline.scale.setScalar(1.015);
      this.scene.add(this.outline);
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
    const hits = this.raycaster.intersectObjects(this.bandGroup.children, false);
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
      this.bandGroup.children, clientX, clientY,
    );
    if (!point) return;
    this.controls.setPivot(point);
    this.pivotMarker.flashAt(point, () => this.render());
  }

  private buildBand(band: SlabPreviewBand): BandMesh {
    const geo = new THREE.BoxGeometry(STUB_WIDTH_M, band.heightM, STUB_DEPTH_M);
    setPlanarWorldUvs(geo, { dominantAxis: 'z' }); // front face (x,y) world UVs
    const mesh = new THREE.Mesh(geo, getMaterial3D(band.materialId));
    mesh.position.set(0, band.centerYM, 0);
    this.bandGroup.add(mesh);
    return { layerId: band.layerId, mesh };
  }

  /**
   * Fit the whole stub in view, fully centered. Solves the exact camera distance
   * so all 8 box corners sit inside the frustum (both H and V FOV) — a tight fit
   * that fills the panel WITHOUT clipping any corner.
   */
  private fitCamera(): void {
    const totalM = this.dna ? this.dna.totalThickness / 1000 : 0.2;
    const [hx, hy, hz] = [STUB_WIDTH_M / 2, totalM / 2, STUB_DEPTH_M / 2];
    const dir = VIEW_DIR; // unit, origin → camera
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 180 / 2);
    const tanH = tanV * this.camera.aspect;
    let dist = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Vector3(sx * hx, sy * hy, sz * hz);
      const depthAt = p.dot(dir);
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
    if (!this.outline) return;
    this.scene.remove(this.outline);
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.outline = null;
  }
}
