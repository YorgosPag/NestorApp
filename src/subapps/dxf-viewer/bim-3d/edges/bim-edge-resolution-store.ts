/**
 * ADR-375 Phase C.7 — BIM 3D viewport-resolution store (singleton).
 *
 * Stores the current renderer viewport size (CSS px) **and its pixel ratio**. `LineMaterial` needs
 * both as uniforms to render screen-space line widths consistently across any zoom, aspect or
 * HiDPI change.
 *
 * Written by `scene-manager-resize` (the SCENE owns it, not the edge overlay) on every viewport
 * resize AND on every devicePixelRatio change; consumed by every fat-line material in the BIM 3D
 * scene through `createSceneFatLineMaterial` (ADR-650 M8β/Γ v2 — the edge overlay is no longer the
 * only consumer, which is why the docblock no longer says «edge»).
 *
 * ⚠️ **`pixelRatio` is part of the snapshot, not a caller-side lookup.** `LineMaterial` measures
 * BOTH `resolution` and `linewidth` in the SAME unit: whatever `resolution` is expressed in,
 * `linewidth` is too (`offset /= resolution.y` in the vertex shader). The drawing buffer is
 * `CSS × pixelRatio`, so a material that scaled only its `linewidth` by the ratio — the pre-v2
 * behaviour — drew every line `pixelRatio×` too thick on a HiDPI screen. Publishing the ratio here,
 * from the ONE place that knows the renderer's clamped `bimPixelRatio()`, is what makes the two
 * values impossible to express in different units.
 *
 * Pattern: tiny SSoT, zero React state, ADR-040 compliant (resize is low-frequency, single update
 * per browser resize event).
 */
import * as THREE from 'three';
import { createExternalStore } from '../../stores/createExternalStore';

type ResolutionListener = (width: number, height: number, pixelRatio: number) => void;

interface ResolutionSnapshot {
  /** Viewport width in CSS px (what `renderer.setSize` was given). */
  readonly width: number;
  /** Viewport height in CSS px. */
  readonly height: number;
  /** The renderer's clamped device pixel ratio (`bimPixelRatio()`); drawing buffer = CSS × this. */
  readonly pixelRatio: number;
}

class BimEdgeResolutionStore {
  // SSoT pub/sub via createExternalStore (WAVE 2.7). Single-value identity guard
  // (width+height pair) — `equals` field-compares so a no-op `setSize` (same size)
  // stays a no-op, matching the hand-rolled early-return this replaces. The public
  // `subscribe` signature passes (width, height) to the listener (unlike the
  // factory's bare `() => void`), so the wrapper reads `store.get()` at notify time.
  private readonly store = createExternalStore<ResolutionSnapshot>(
    { width: 1, height: 1, pixelRatio: 1 },
    {
      equals: (a, b) =>
        a.width === b.width && a.height === b.height && a.pixelRatio === b.pixelRatio,
    },
  );

  /**
   * Publish the live viewport. `pixelRatio` defaults to 1 so a caller that genuinely has no
   * renderer (tests) gets CSS ≡ device px; the ONE production writer always passes the renderer's
   * own clamped ratio, because a stale ratio is exactly the HiDPI width bug described above.
   */
  setSize(width: number, height: number, pixelRatio = 1): void {
    if (width <= 0 || height <= 0 || pixelRatio <= 0) return;
    this.store.set({ width, height, pixelRatio });
  }

  getSize(): ResolutionSnapshot {
    return this.store.get();
  }

  /** Copy current size into target THREE.Vector2 (zero alloc when reusing). */
  copyInto(target: THREE.Vector2): THREE.Vector2 {
    const { width, height } = this.store.get();
    return target.set(width, height);
  }

  subscribe(listener: ResolutionListener): () => void {
    return this.store.subscribe(() => {
      const { width, height, pixelRatio } = this.store.get();
      listener(width, height, pixelRatio);
    });
  }
}

export const bimEdgeResolutionStore = new BimEdgeResolutionStore();
