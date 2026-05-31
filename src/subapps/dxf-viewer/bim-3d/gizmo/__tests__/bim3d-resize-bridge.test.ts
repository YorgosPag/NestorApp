/**
 * ADR-402 Phase B — bim3d-resize-bridge: gizmo resize drag → new entity params.
 *
 * Pure, no mocks. Verifies the column slice delegates to the existing 2D
 * grip-drag SSoT (`applyColumnGripDrag`) with the correct mm→canvas scaling, and
 * short-circuits to `null` for unmapped axes / no-op drags / unsupported kinds.
 */

import { computeColumnResizeParams, toCanvasDelta } from '../bim3d-resize-bridge';
import type { ResizeDragMm } from '../bim3d-resize-bridge';
import { applyColumnGripDrag } from '../../../bim/columns/column-grips';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { mmScaleFor } from '../../../utils/scene-units';
import type { ColumnParams } from '../../../bim/types/column-types';

function rect(overrides: Partial<ColumnParams> = {}): ColumnParams {
  return { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...overrides };
}

function drag(axis: ResizeDragMm['axis'], deltaMm: { x: number; y: number }): ResizeDragMm {
  return { axis, mode: 'normal', deltaMm, cursorMm: deltaMm };
}

describe('toCanvasDelta', () => {
  it('scales mm delta by the scene scale (mm scene = ×1)', () => {
    expect(toCanvasDelta({ x: 50, y: -20 }, 1)).toEqual({ x: 50, y: -20 });
  });

  it('scales for a metre scene (×0.001)', () => {
    expect(toCanvasDelta({ x: 1000, y: 2000 }, 0.001)).toEqual({ x: 1, y: 2 });
  });
});

describe('computeColumnResizeParams (ADR-402 Phase B)', () => {
  it('resize-x → column-width, delegating to applyColumnGripDrag', () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('x', { x: 50, y: 0 }));
    expect(next).not.toBeNull();
    const expected = applyColumnGripDrag('column-width', {
      originalParams: p, delta: toCanvasDelta({ x: 50, y: 0 }, mmScaleFor(p)),
    });
    expect(next!.width).toBeCloseTo(expected.width, 6);
    expect(next!.width).toBeGreaterThan(p.width);
  });

  it('resize-z → column-depth', () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('z', { x: 0, y: 50 }));
    expect(next).not.toBeNull();
    const expected = applyColumnGripDrag('column-depth', {
      originalParams: p, delta: toCanvasDelta({ x: 0, y: 50 }, mmScaleFor(p)),
    });
    expect(next!.depth).toBeCloseTo(expected.depth, 6);
  });

  it('resize-y has no column mapping → null', () => {
    expect(computeColumnResizeParams(rect(), drag('y', { x: 0, y: 30 }))).toBeNull();
  });

  it('zero delta → null (no-op, referential short-circuit)', () => {
    expect(computeColumnResizeParams(rect(), drag('x', { x: 0, y: 0 }))).toBeNull();
  });

  it('scales the delta by mmScaleFor for a metre-unit column', () => {
    const p = rect({ sceneUnits: 'm' });
    const next = computeColumnResizeParams(p, drag('x', { x: 100, y: 0 }));
    expect(next).not.toBeNull();
    const expected = applyColumnGripDrag('column-width', {
      originalParams: p, delta: toCanvasDelta({ x: 100, y: 0 }, mmScaleFor(p)),
    });
    expect(next!.width).toBeCloseTo(expected.width, 9);
  });

  it('circular column depth (resize-z) is a no-op → null', () => {
    const circular = buildDefaultColumnParams({ x: 0, y: 0 }, 'circular');
    expect(computeColumnResizeParams(circular, drag('z', { x: 0, y: 50 }))).toBeNull();
  });
});
