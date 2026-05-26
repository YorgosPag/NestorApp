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

type ResolutionListener = (width: number, height: number) => void;

class BimEdgeResolutionStore {
  private width = 1;
  private height = 1;
  private readonly listeners = new Set<ResolutionListener>();

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    for (const listener of this.listeners) listener(width, height);
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** Copy current size into target THREE.Vector2 (zero alloc when reusing). */
  copyInto(target: THREE.Vector2): THREE.Vector2 {
    return target.set(this.width, this.height);
  }

  subscribe(listener: ResolutionListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export const bimEdgeResolutionStore = new BimEdgeResolutionStore();
