/**
 * dxf-backdrop-cache.ts — Frozen DXF backdrop for 1:1 entity-drag (ADR-516 Phase 2).
 *
 * PROBLEM (measured, 2026-06-29): dragging a gizmo axis to move a BIM entity with a DXF floor plan
 * loaded lags — the entity trails the 0ms OS cursor. Root cause is GPU back-pressure: the DXF underlay
 * (thousands of static LineSegments) is re-drawn EVERY frame via `renderPostFxOverlays` while dragging,
 * saturating the draw queue on a weak GPU. The BIM itself is tiny (≈546 tris).
 *
 * SOLUTION (Revit "fast display" / C4D interactive redraw / WebGL static-scene caching): during an
 * ENTITY drag the camera is fixed (OrbitControls off), so the underlay is 100% static. Render it ONCE
 * into an offscreen target and, every drag frame, BLIT that cache instead of re-drawing the lines.
 * The underlay lives on the ground plane and the BIM is opaque, so compositing as
 *   blit(cached underlay) → render BIM live → render gizmo live
 * preserves occlusion (walls cover lines behind them) with ZERO re-draw of the thousands of segments.
 *
 * Caches ONLY the underlay: the live BIM render is cheap and keeps EVERY dynamic behaviour (move,
 * resize, dependent re-clip, pipe/wire/fitting follow via `Bim3DEditLivePreview`) working unchanged —
 * no "which meshes are dynamic" bookkeeping needed.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-516-timing-latency-ssot.md
 */

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { renderPostFxOverlays } from './post-fx-overlay-pass';
import { ensureSizedRenderTarget } from './sized-render-target';

/** Render paths that own the frame instead of the frozen backdrop (section cut / final render). */
export interface BackdropGuards {
  isSectionActive(): boolean;
  isPathTracerActive(): boolean;
}

export class DxfBackdropCache {
  private rt: THREE.WebGLRenderTarget | null = null;
  private quad: FullScreenQuad | null = null;
  private quadMaterial: THREE.MeshBasicMaterial | null = null;
  private armed = false;
  private captured = false;
  private readonly size = new THREE.Vector2();

  constructor(private readonly guards: BackdropGuards) {}

  /** Begin an entity drag (camera fixed) → next frame captures the static underlay. */
  arm(): void { this.armed = true; this.captured = false; }

  /** End the entity drag → back to the normal raster/SSAO paths. */
  disarm(): void { this.armed = false; this.captured = false; }

  /** Force a re-capture next frame (DXF overlay re-synced, or the viewport resized). */
  invalidate(): void { this.captured = false; }

  /** True when the frozen-backdrop composite path should own this frame. */
  isActive(): boolean {
    return this.armed && !this.guards.isSectionActive() && !this.guards.isPathTracerActive();
  }

  /** Composite this drag frame: blit cached underlay → live BIM → live gizmo (no line re-draw). */
  renderFrame(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    this.ensureTarget(renderer);
    if (!this.captured) this.capture(renderer, scene, camera);
    // 1) Backdrop: opaque fullscreen quad of the cached underlay (clears the screen + paints it).
    this.quad?.render(renderer);
    // 2) BIM live, KEEPING the blitted colour (clear depth only, so the BIM depth-tests fresh).
    const prevAutoClearColor = renderer.autoClearColor;
    renderer.autoClearColor = false;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.autoClearColor = prevAutoClearColor;
    // 3) Gizmo on top, live (the manipulator must follow the cursor; the underlay is in the cache).
    renderPostFxOverlays(renderer, scene, camera, 'gizmo');
  }

  /** Render the static underlay once into the offscreen target (over the dark clear colour). */
  private capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderPostFxOverlays(renderer, scene, camera, 'underlay');
    renderer.setRenderTarget(null);
    this.captured = true;
  }

  /**
   * Lazily (re)allocate the cache target to the current drawing-buffer size + blit quad (SSoT
   * `ensureSizedRenderTarget`). A resize re-uses the same texture via setSize; `captured` is reset
   * by the owner's `invalidate()` on resize/DPR-change, so the stale cache is never blitted.
   */
  private ensureTarget(renderer: THREE.WebGLRenderer): void {
    renderer.getDrawingBufferSize(this.size);
    this.rt = ensureSizedRenderTarget(this.rt, this.size.x, this.size.y, (w, h) => {
      const rt = new THREE.WebGLRenderTarget(w, h);
      // Match the screen output colour space so the blitted backdrop is pixel-identical to a live render.
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      return rt;
    });
    if (!this.quadMaterial) {
      this.quadMaterial = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, toneMapped: false });
      this.quad = new FullScreenQuad(this.quadMaterial);
    }
    this.quadMaterial.map = this.rt.texture;
  }

  dispose(): void {
    this.rt?.dispose();
    this.quad?.dispose();
    this.quadMaterial?.dispose();
    this.rt = null;
    this.quad = null;
    this.quadMaterial = null;
  }
}
