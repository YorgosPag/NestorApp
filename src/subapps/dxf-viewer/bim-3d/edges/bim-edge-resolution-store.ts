/**
 * ADR-375 Phase C.7 — BIM 3D Edge Resolution Store (singleton).
 *
 * Stores the current renderer viewport size (px). LineMaterial requires this
 * value as a uniform to render screen-space line widths consistently across
 * any zoom or aspect change.
 *
 * Updated by ThreeJsSceneManager.resize() on every viewport resize event.
 * Consumed by edge materials via subscribe() — listeners apply the new
 * resolution to their LineMaterial.resolution uniform on next render.
 *
 * Pattern: tiny SSoT, zero React state, ADR-040 compliant (resize is
 * low-frequency, single update per browser resize event).
 */
import * as THREE from 'three';
import { createExternalStore } from '../../stores/createExternalStore';

type ResolutionListener = (width: number, height: number) => void;

interface ResolutionSnapshot {
  readonly width: number;
  readonly height: number;
}

class BimEdgeResolutionStore {
  // SSoT pub/sub via createExternalStore (WAVE 2.7). Single-value identity guard
  // (width+height pair) — `equals` field-compares so a no-op `setSize` (same size)
  // stays a no-op, matching the hand-rolled early-return this replaces. The public
  // `subscribe` signature passes (width, height) to the listener (unlike the
  // factory's bare `() => void`), so the wrapper reads `store.get()` at notify time.
  private readonly store = createExternalStore<ResolutionSnapshot>(
    { width: 1, height: 1 },
    { equals: (a, b) => a.width === b.width && a.height === b.height },
  );

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.store.set({ width, height });
  }

  getSize(): { width: number; height: number } {
    return this.store.get();
  }

  /** Copy current size into target THREE.Vector2 (zero alloc when reusing). */
  copyInto(target: THREE.Vector2): THREE.Vector2 {
    const { width, height } = this.store.get();
    return target.set(width, height);
  }

  subscribe(listener: ResolutionListener): () => void {
    return this.store.subscribe(() => {
      const { width, height } = this.store.get();
      listener(width, height);
    });
  }
}

export const bimEdgeResolutionStore = new BimEdgeResolutionStore();
