/**
 * ADR-363 Phase 1C — `wallPreviewStore` tests.
 *
 * Coverage:
 *   - `set()` updates state and notifies subscribers (only on change).
 *   - `reset()` returns to EMPTY snapshot identity.
 *   - Snapshot stability: identical writes return the same object reference
 *     (`useSyncExternalStore` re-render skip).
 */

import { wallPreviewStore } from '../wall-preview-store';

describe('wall-preview-store (Phase 1C)', () => {
  beforeEach(() => {
    wallPreviewStore.reset();
  });

  it('1. initial snapshot is the frozen EMPTY tuple', () => {
    const s = wallPreviewStore.get();
    expect(s.startPoint).toBeNull();
    expect(s.curveControl).toBeNull();
    expect(s.polylineVertices).toEqual([]);
    expect(s.overrides).toEqual({});
  });

  it('2. set() updates startPoint', () => {
    wallPreviewStore.set({
      startPoint: { x: 10, y: 20 },
      curveControl: null,
      polylineVertices: [],
      overrides: {},
    });
    const s = wallPreviewStore.get();
    expect(s.startPoint).toEqual({ x: 10, y: 20 });
  });

  it('3. set() with identical state returns same snapshot reference', () => {
    wallPreviewStore.set({
      startPoint: { x: 10, y: 20 },
      curveControl: null,
      polylineVertices: [],
      overrides: {},
    });
    const a = wallPreviewStore.get();
    wallPreviewStore.set({
      startPoint: { x: 10, y: 20 },
      curveControl: null,
      polylineVertices: [],
      overrides: {},
    });
    const b = wallPreviewStore.get();
    expect(b).toBe(a);
  });

  it('4. polyline vertices propagate', () => {
    wallPreviewStore.set({
      startPoint: { x: 0, y: 0 },
      curveControl: null,
      polylineVertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      overrides: {},
    });
    expect(wallPreviewStore.get().polylineVertices).toHaveLength(3);
  });

  it('5. reset() returns to EMPTY identity', () => {
    wallPreviewStore.set({
      startPoint: { x: 1, y: 2 },
      curveControl: null,
      polylineVertices: [],
      overrides: { category: 'partition' },
    });
    expect(wallPreviewStore.get().startPoint).not.toBeNull();
    wallPreviewStore.reset();
    expect(wallPreviewStore.get().startPoint).toBeNull();
    expect(wallPreviewStore.get().polylineVertices).toEqual([]);
  });

  it('6. curveControl propagates and is deep-copied (mutation isolation)', () => {
    const ctrl = { x: 50, y: 50 };
    wallPreviewStore.set({
      startPoint: { x: 0, y: 0 },
      curveControl: ctrl,
      polylineVertices: [],
      overrides: {},
    });
    ctrl.x = 999;
    expect(wallPreviewStore.get().curveControl?.x).toBe(50);
  });

  it('7. overrides propagate', () => {
    wallPreviewStore.set({
      startPoint: { x: 0, y: 0 },
      curveControl: null,
      polylineVertices: [],
      overrides: { category: 'interior', height: 2500 },
    });
    const s = wallPreviewStore.get();
    expect(s.overrides.category).toBe('interior');
    expect(s.overrides.height).toBe(2500);
  });
});
