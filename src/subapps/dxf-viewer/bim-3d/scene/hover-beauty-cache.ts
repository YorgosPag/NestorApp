/**
 * hover-beauty-cache.ts — Frozen "beauty" snapshot for INSTANT 3D hover outline (ADR-549 Φ3).
 *
 * PROBLEM (measured 2026-07-22, weak GPU): with the LIVE hover silhouette, every hover-id change
 * fires a FULL scene render — avg 37-44ms, max 187ms (full raster + shadow-toggle material churn) —
 * to repaint a 2px outline. The BVH raycast pick itself is ~0.5ms; the cost is 100% the beauty
 * re-render (dirty-reason histogram: `explicitDirty`, SSAO off).
 *
 * SOLUTION (mirror of ADR-516 `DxfBackdropCache` + the 2D bitmap cache of ADR-040): when ONLY the
 * hover changed (camera + geometry + lights + selection all static), the beauty is identical to the
 * previous frame. Snapshot the framebuffer AFTER the beauty render but BEFORE the outline overlay,
 * then on a hover-only frame BLIT that snapshot and redraw just the (cheap) outline. 40ms → ~1-2ms.
 *
 * The snapshot is captured ONLY on a cacheable frame (static raster/SSAO — NOT backdrop-drag, section
 * cut, path-trace, camera interaction or animation); any non-cacheable frame {@link invalidate}s it,
 * so a hover-only blit can never show a stale beauty. A resize re-allocates the texture (→ miss →
 * full render re-captures), so no explicit resize hook is required.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-549-3d-cursor-swim-perf.md · ADR-516 (backdrop)
 */

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export class HoverBeautyCache {
  private texture: THREE.FramebufferTexture | null = null;
  private quad: FullScreenQuad | null = null;
  private quadMaterial: THREE.MeshBasicMaterial | null = null;
  private captured = false;
  private readonly size = new THREE.Vector2();

  /** Drop the snapshot — the next full frame must re-capture before a hover-only blit is allowed. */
  invalidate(): void {
    this.captured = false;
  }

  /** True when a valid beauty snapshot exists to blit. */
  hasCapture(): boolean {
    return this.captured && this.texture !== null;
  }

  /**
   * Snapshot the CURRENT screen framebuffer (the clean beauty, before the outline overlay) into the
   * cache texture. Call once per cacheable full frame; allocates lazily on the first call / a resize.
   */
  capture(renderer: THREE.WebGLRenderer): void {
    this.ensure(renderer);
    if (!this.texture) return;
    renderer.setRenderTarget(null); // snapshot the screen, not any lingering offscreen target
    renderer.copyFramebufferToTexture(this.texture);
    this.captured = true;
  }

  /** Hover-only frame: paint the cached beauty fullscreen over the screen. Returns false on a miss. */
  blit(renderer: THREE.WebGLRenderer): boolean {
    if (!this.captured || !this.quad) return false;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
    return true;
  }

  /** (Re)allocate the cache texture + blit quad to the current drawing-buffer size. Idempotent. */
  private ensure(renderer: THREE.WebGLRenderer): void {
    const size = renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.floor(size.x));
    const h = Math.max(1, Math.floor(size.y));
    if (this.texture && this.texture.image.width === w && this.texture.image.height === h) return;
    this.texture?.dispose();
    this.texture = new THREE.FramebufferTexture(w, h);
    this.texture.colorSpace = THREE.SRGBColorSpace; // match the sRGB screen → blit is pixel-identical
    this.captured = false; // old snapshot is the wrong size
    if (!this.quadMaterial) {
      this.quadMaterial = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, toneMapped: false });
      this.quad = new FullScreenQuad(this.quadMaterial);
    }
    this.quadMaterial.map = this.texture;
  }

  dispose(): void {
    this.texture?.dispose();
    this.quad?.dispose();
    this.quadMaterial?.dispose();
    this.texture = null;
    this.quad = null;
    this.quadMaterial = null;
  }
}
