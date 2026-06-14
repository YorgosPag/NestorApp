/**
 * ADR-455 — section-cut handle drag-store lifecycle (pure module state).
 */

import {
  startAxisCutDrag,
  endAxisCutDrag,
  getAxisCutDragAxis,
  isAxisCutDragging,
} from '../axis-cut-drag-store';

describe('axis-cut-drag-store', () => {
  afterEach(() => endAxisCutDrag());

  it('starts idle', () => {
    expect(getAxisCutDragAxis()).toBeNull();
    expect(isAxisCutDragging()).toBe(false);
  });

  it('tracks the dragged axis after start', () => {
    startAxisCutDrag('x');
    expect(getAxisCutDragAxis()).toBe('x');
    expect(isAxisCutDragging()).toBe(true);
  });

  it('replaces the axis on a second start (no stuck state)', () => {
    startAxisCutDrag('x');
    startAxisCutDrag('y');
    expect(getAxisCutDragAxis()).toBe('y');
  });

  it('clears on end (idempotent)', () => {
    startAxisCutDrag('y');
    endAxisCutDrag();
    expect(getAxisCutDragAxis()).toBeNull();
    expect(isAxisCutDragging()).toBe(false);
    endAxisCutDrag(); // second call is a no-op
    expect(isAxisCutDragging()).toBe(false);
  });
});
