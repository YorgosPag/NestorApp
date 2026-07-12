/**
 * ADR-639 Στάδιο 5 — WebGL line-layer imperative manager (STEP 9, no React).
 *
 * A pure lifecycle class — a small clone of `ThreeJsSceneManager` — that owns the
 * layer's WebGL context, `THREE.Scene`, `OrthographicCamera`, and the bucketed
 * `LineSegments2` meshes. The thin React leaf (STEP 10) `new`s it, drives it, and
 * `dispose()`s it on unmount; this class touches no React and no high-frequency
 * store subscription (ADR-040 rule 1/4).
 *
 * It delegates every non-trivial computation to the pure STEP 3-8 helpers:
 *   • renderer  → `createWebglLineRenderer` (STEP 3, shared desynchronized ctx)
 *   • buffers   → `buildWebglLineBuffers`   (STEP 5, built ONCE per scene identity)
 *   • camera    → `computeOrthoBounds`/`applyToCamera` (STEP 4, pixel-exact)
 *   • LOD       → `computeInstanceCount`     (STEP 6, per-tick, zero re-upload)
 *   • teardown  → `disposeWebglLineResources` (STEP 7)
 *
 * The ENTIRE per-pan/zoom cost is one `tick()`: read the transform SSoT, recompute
 * four ortho bounds + one `updateProjectionMatrix()`, set each bucket's
 * `instanceCount`, and `renderer.render()` — the buffers are never touched (that is
 * the whole point of Στάδιο 5). Buffers rebuild only on scene-identity change
 * (`setScene`) or a low-frequency content signal (`invalidate`).
 *
 * @see canvas-v2/webgl-lines/webgl-line-buffer-builder.ts — the buffers this uploads
 * @see canvas-v2/webgl-lines/webgl-line-ortho-camera.ts   — the per-tick projection
 * @see canvas-v2/webgl-lines/webgl-line-lod.ts            — the per-tick instanceCount
 * @see bim-3d/scene/ThreeJsSceneManager.ts                — the mirrored lifecycle class
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import type { DxfScene, DxfEntityUnion } from '../dxf-canvas/dxf-types';
import type { Viewport } from '../../rendering/types/Types';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { resolveEntityRenderStyle } from '../dxf-canvas/dxf-renderer-style-resolve';
import { isEntityLayerSkipped } from '../dxf-canvas/dxf-entity-layer-skip';
import { createWebglLineRenderer, webglLinePixelRatio } from './webgl-line-renderer-setup';
import { buildWebglLineBuffers, type WebglLineBucket } from './webgl-line-buffer-builder';
import { computeOrthoBounds, applyToCamera } from './webgl-line-ortho-camera';
import { computeInstanceCount } from './webgl-line-lod';
import { disposeWebglLineResources } from './webgl-line-dispose';
import { setWebglLineLayerActive, setWebglOwnedEntityIds } from './webgl-line-layer-store';

/**
 * On-screen segment length (CSS px) below which a segment is dropped by the LOD.
 *
 * MUST be 0 at idle = the LOD is truly OFF (draw EVERY owned segment) → pixel-identical
 * to Canvas2D. A previous value of 1 was WRONG: it dropped every sub-pixel-length segment,
 * which silently erased dense hatch/γραμμοσκίαση fills — in an exploded permit those are
 * thousands of SHORT (~mm) LINE entities that render sub-pixel at fit-view yet, drawn en
 * masse by Canvas2D, form a visible tone. Since the DxfRenderer SUPPRESSES owned lines
 * (they're the GPU layer's job), LOD-dropping them left them drawn by NEITHER layer →
 * they vanished (incident 2026-07-12: hatches flashed on load then disappeared). A >0
 * cutoff is an interaction-only optimisation for later (drop detail WHILE panning a weak
 * GPU, restored to 0 at rest) — never at idle. `computeInstanceCount(_, _, 0)` draws all.
 */
const IDLE_CUTOFF_PX = 0;

/** One live GPU bucket + the metadata `tick`/`syncDevicePixelRatio` need each frame. */
interface ManagedBucket {
  readonly mesh: LineSegments2;
  readonly material: LineMaterial;
  /** DESC-sorted world lengths — the LOD binary-search input (STEP 6). */
  readonly worldLengths: Float32Array;
  /** Pre-DPR width (px) → `material.linewidth = lineWidthPx * dpr` on DPR change. */
  readonly lineWidthPx: number;
}

export class WebglLineLayerManager {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;

  private buckets: ManagedBucket[] = [];
  /** The exact set of entity ids the GPU owns; STEP 12 reads it to suppress Canvas2D. */
  private ownedEntityIds: ReadonlySet<string> = new Set();

  /** Current scene — reference equality gates the rebuild (mirror of the bitmap cache). */
  private currentScene: DxfScene | null = null;
  /** Live CSS-px viewport, updated by `resize` (never `canvas.width/height`). */
  private viewport: Viewport = { width: 0, height: 0 };

  private dirty = true;
  private disposed = false;

  private readonly onContextLost = (event: Event): void => {
    // Keep the canvas from being torn down by the browser; fall back to Canvas2D.
    event.preventDefault();
    setWebglLineLayerActive(false);
    this.markDirty();
  };

  private readonly onContextRestored = (): void => {
    if (this.disposed) return;
    // Buffers live in the lost context → rebuild them, then re-arm the layer.
    this.rebuild();
    setWebglLineLayerActive(true);
    this.markDirty();
  };

  constructor(container: HTMLElement) {
    this.renderer = createWebglLineRenderer();
    this.canvas = this.renderer.domElement;
    // The layer is one slice of the canvas stack: fill the leaf div, never capture
    // pointer events (all interaction is owned by the z10 Canvas2D above).
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    // Bounds are pushed every tick by `computeOrthoBounds`; the initial ones are placeholders.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    this.camera.position.set(0, 0, 0);

    this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
  }

  /**
   * Point the layer at a scene. Rebuilds the persistent buffers ONLY when the scene
   * IDENTITY changes (reference equality — same contract as the bitmap cache, an
   * in-place mutation silently skips, documented in the ADR). Pass `null` to clear.
   */
  setScene(scene: DxfScene | null): void {
    if (this.disposed) return;
    if (scene === this.currentScene) return;
    this.currentScene = scene;
    this.rebuild();
  }

  /**
   * Rebuild the buffers from the CURRENT scene without a scene-identity change —
   * called when a low-frequency content signal (layer colour/freeze, isolate, LWDISPLAY,
   * dxfImport projection) alters the resolved style. Idempotent.
   */
  invalidate(): void {
    if (this.disposed) return;
    this.rebuild();
  }

  /** Dispose the old meshes and pack the current scene into fresh `LineSegments2` buckets. */
  private rebuild(): void {
    this.disposeBuckets();
    if (!this.currentScene) {
      this.ownedEntityIds = new Set();
      setWebglOwnedEntityIds(this.ownedEntityIds);
      return;
    }
    const { layersById } = this.currentScene;
    const resolveStyle = (entity: DxfEntityUnion) => resolveEntityRenderStyle(entity, layersById);
    const isLayerSkipped = (entity: DxfEntityUnion) => isEntityLayerSkipped(entity, layersById);

    const result = buildWebglLineBuffers(this.currentScene.entities, resolveStyle, isLayerSkipped);
    this.ownedEntityIds = result.ownedEntityIds;
    setWebglOwnedEntityIds(this.ownedEntityIds);
    const dpr = webglLinePixelRatio();
    const resolutionX = this.viewport.width * dpr;
    const resolutionY = this.viewport.height * dpr;
    for (const bucket of result.buckets) {
      this.buckets.push(this.createBucketMesh(bucket, dpr, resolutionX, resolutionY));
    }
    this.markDirty();
  }

  /** Build one `LineSegments2` (geometry + LineMaterial) for a packed bucket and mount it. */
  private createBucketMesh(
    bucket: WebglLineBucket,
    dpr: number,
    resolutionX: number,
    resolutionY: number,
  ): ManagedBucket {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(bucket.positions);
    geometry.setColors(bucket.colors);
    const material = new LineMaterial({
      vertexColors: true,
      transparent: true,
      opacity: bucket.alpha,
      // Fixed device-px width regardless of zoom (AutoCAD LWDISPLAY parity).
      linewidth: bucket.lineWidthPx * dpr,
      // Flat 2D layer — every segment sits at z=0, so depth is meaningless; disabling it
      // avoids self z-fighting and keeps the layer a pure painter's-order slice.
      depthTest: false,
      depthWrite: false,
      // MSAA edge smoothing for the fat lines (mirror of the BIM edge overlay).
      alphaToCoverage: true,
    });
    material.resolution.set(resolutionX, resolutionY);
    const mesh = new LineSegments2(geometry, material);
    // Ortho-clipped for free; no per-frame CPU frustum cull needed on a flat layer.
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, material, worldLengths: bucket.worldLengths, lineWidthPx: bucket.lineWidthPx };
  }

  /** The set of entity ids the GPU layer draws — STEP 12 suppresses Canvas2D iff a member. */
  getOwnedEntityIds(): ReadonlySet<string> {
    return this.ownedEntityIds;
  }

  /**
   * ADR-040 — driven by the UnifiedFrameScheduler once per rAF tick, ONLY when dirty.
   * Reads the transform SSoT event-time (never a captured prop → never stale), recomputes
   * the ortho projection + per-bucket LOD instance count, and renders. Zero buffer touch.
   */
  tick(): void {
    if (this.disposed) return;
    const transform = getImmediateTransform();
    const bounds = computeOrthoBounds(transform, this.viewport);
    // Unlaid-out viewport (0×0) or degenerate scale → nothing to project this frame.
    // Clearing dirty is safe: resize / the transform SSoT re-arm it when state is valid.
    if (!bounds) {
      this.dirty = false;
      return;
    }
    applyToCamera(this.camera, bounds);
    for (const bucket of this.buckets) {
      const count = computeInstanceCount(bucket.worldLengths, transform.scale, IDLE_CUTOFF_PX);
      bucket.mesh.geometry.instanceCount = count;
    }
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  }

  /** ADR-040 on-demand SSoT — the scheduler renders this layer only when true. */
  isDirty(): boolean {
    return !this.disposed && this.dirty;
  }

  /** Force a redraw on the next scheduler tick (transform / resize / content change). */
  markDirty(): void {
    if (!this.disposed) this.dirty = true;
  }

  /**
   * Apply a new CSS-px size. Updates the live viewport (feeds the ortho bounds), the
   * renderer drawing buffer, and every fat-line material resolution (drawing-buffer px).
   * The geometry is NOT rebuilt — resize is camera + resolution only.
   */
  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.viewport = { width, height };
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, true);
    const dpr = webglLinePixelRatio();
    for (const bucket of this.buckets) bucket.material.resolution.set(width * dpr, height * dpr);
    this.markDirty();
  }

  /** Re-apply pixel ratio after a `devicePixelRatio` CHANGE (monitor swap / OS zoom). */
  syncDevicePixelRatio(): void {
    if (this.disposed) return;
    const dpr = webglLinePixelRatio();
    this.renderer.setPixelRatio(dpr);
    const { width, height } = this.viewport;
    if (width > 0 && height > 0) this.renderer.setSize(width, height, true);
    for (const bucket of this.buckets) {
      bucket.material.resolution.set(width * dpr, height * dpr);
      bucket.material.linewidth = bucket.lineWidthPx * dpr;
    }
    this.markDirty();
  }

  /** Dispose every bucket's geometry + material and detach them from the scene. */
  private disposeBuckets(): void {
    for (const bucket of this.buckets) {
      this.scene.remove(bucket.mesh);
      bucket.mesh.geometry.dispose();
      bucket.material.dispose();
    }
    this.buckets = [];
  }

  /**
   * Release the layer's GPU resources and detach the canvas. The leaf MUST have
   * UNREGISTERED its scheduler callback first (mirror `BimViewport3D.tsx:207-213`) so
   * no tick can fire mid-teardown.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    disposeWebglLineResources({
      renderer: this.renderer,
      meshes: this.buckets.map((bucket) => bucket.mesh),
      canvas: this.canvas,
    });
    this.buckets = [];
    this.ownedEntityIds = new Set();
    setWebglOwnedEntityIds(this.ownedEntityIds);
  }
}
