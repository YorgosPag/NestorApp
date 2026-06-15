/**
 * ADR-040 cursor-lag Φ5 — pointer rect cache.
 *
 * Verifies the cache serves a single getBoundingClientRect read across many
 * mousemove-style calls and re-reads only when invalidated / element changes —
 * the whole point being to stop the per-mousemove forced reflow.
 */

import {
  getCachedClientRect,
  invalidatePointerRectCache,
  resetPointerRectCache,
} from '../pointer-rect-cache';

class FakeResizeObserver {
  observe(): void { /* no-op — invalidation driven manually in tests */ }
  disconnect(): void { /* no-op */ }
  unobserve(): void { /* no-op */ }
}

function makeElement(rect: Partial<DOMRect>): { el: HTMLElement; reads: () => number } {
  let reads = 0;
  const full = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 80, toJSON: () => ({}), ...rect } as DOMRect;
  const el = {
    getBoundingClientRect: () => { reads++; return full; },
  } as unknown as HTMLElement;
  return { el, reads: () => reads };
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver;
});

beforeEach(() => resetPointerRectCache());

describe('pointer-rect-cache', () => {
  it('reads the DOM only once across repeated calls for the same element', () => {
    const { el, reads } = makeElement({ width: 640, height: 480 });
    const a = getCachedClientRect(el);
    const b = getCachedClientRect(el);
    const c = getCachedClientRect(el);
    expect(reads()).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.width).toBe(640);
  });

  it('re-reads after invalidatePointerRectCache()', () => {
    const { el, reads } = makeElement({ width: 100 });
    getCachedClientRect(el);
    getCachedClientRect(el);
    expect(reads()).toBe(1);
    invalidatePointerRectCache();
    getCachedClientRect(el);
    expect(reads()).toBe(2);
  });

  it('re-reads when the element changes', () => {
    const first = makeElement({ width: 100 });
    const second = makeElement({ width: 200 });
    getCachedClientRect(first.el);
    const r2 = getCachedClientRect(second.el);
    expect(first.reads()).toBe(1);
    expect(second.reads()).toBe(1);
    expect(r2.width).toBe(200);
  });

  it('reset drops the cache so the next call re-reads', () => {
    const { el, reads } = makeElement({ width: 100 });
    getCachedClientRect(el);
    resetPointerRectCache();
    getCachedClientRect(el);
    expect(reads()).toBe(2);
  });
});
