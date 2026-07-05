/**
 * ADR-402 Phase B — bim3d-resize-bridge: gizmo resize drag → new entity params.
 *
 * Pure, no mocks. Verifies:
 *   - plan resize (X/Z) delegates to the existing 2D grip-drag SSoT with the
 *     correct per-type unit handling (column ÷mmScaleFor, beam raw-mm);
 *   - wall thickness is computed RELATIVELY (±2·perp, gizmo-appropriate);
 *   - axis-Y resize patches the vertical field (wall/column height, beam depth,
 *     slab thickness);
 *   - no-op / unsupported axes short-circuit to `null`.
 */

import {
  computeColumnResizeParams,
  computeWallResizeParams,
  computeBeamResizeParams,
  computeSlabResizeParams,
  toCanvasDelta,
} from '../bim3d-resize-bridge';
import type { ResizeDragMm } from '../bim3d-resize-bridge';
import { applyColumnGripDrag } from '../../../bim/columns/column-grips';
import { applyBeamGripDrag } from '../../../bim/beams/beam-grips';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import { buildDefaultBeamParams } from '../../../hooks/drawing/beam-completion';
import { buildDefaultSlabParams } from '../../../hooks/drawing/slab-completion';
import { mmScaleFor } from '../../../utils/scene-units';
import type { ColumnParams } from '../../../bim/types/column-types';

function rect(overrides: Partial<ColumnParams> = {}): ColumnParams {
  return { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...overrides };
}

/** Wall along world X (axis (1,0), perp (0,1)) so resize-z deltaMm.y drives thickness. */
function wallAlongX() {
  return buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
}

/** Beam along world X (axis (1,0), perp (0,1)) so deltaMm.y drives width. */
function beamAlongX() {
  return buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
}

function squareSlab() {
  return buildDefaultSlabParams([
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ]);
}

function drag(
  axis: ResizeDragMm['axis'],
  deltaMm: { x: number; y: number },
  deltaUpMm = 0,
  mode: ResizeDragMm['mode'] = 'normal',
): ResizeDragMm {
  return { axis, mode, deltaMm, deltaUpMm, cursorMm: deltaMm };
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

  it('resize-y → column height (vertical mm patch)', () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, 300));
    expect(next).not.toBeNull();
    expect(next!.height).toBeCloseTo(p.height + 300, 6);
  });

  it('resize-y with zero vertical delta → null', () => {
    expect(computeColumnResizeParams(rect(), drag('y', { x: 0, y: 0 }, 0))).toBeNull();
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

  it('circular column depth (resize-z) → symmetric diameter resize (ADR-519 N-quadrant)', () => {
    // ADR-519 — η circular κολόνα εκπέμπει τα quadrant grips με τα ΙΔΙΑ kinds width(E)/depth(N),
    // ώστε ΚΑΘΕ quadrant να κάνει συμμετρικό diameter resize. Άρα το 3D resize-z (→ column-depth)
    // ΔΕΝ είναι no-op πλέον· αλλάζει τη διάμετρο (3Δ === 2Δ N-quadrant).
    const circular = buildDefaultColumnParams({ x: 0, y: 0 }, 'circular');
    const next = computeColumnResizeParams(circular, drag('z', { x: 0, y: 50 }));
    expect(next).not.toBeNull();
    const expected = applyColumnGripDrag('column-depth', {
      originalParams: circular, delta: toCanvasDelta({ x: 0, y: 50 }, mmScaleFor(circular)),
    });
    expect(next!.width).toBeCloseTo(expected.width, 6); // circular quadrant → diameter (width)
    expect(next!.width).not.toBeCloseTo(circular.width, 6);
  });
});

describe('computeColumnResizeParams — top/base vertical grips (ADR-401 F.3)', () => {
  it("TOP grip (mode 'normal') → height += Δ, base fixed", () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, 400, 'normal'));
    expect(next).not.toBeNull();
    expect(next!.height).toBeCloseTo(p.height + 400, 6);
    expect(next!.baseOffset).toBe(p.baseOffset);
  });

  it("BASE grip (mode 'mirror') dragged DOWN (Δ<0) → base lowers, top stays (height grows)", () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, -300, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseOffset).toBeCloseTo(p.baseOffset - 300, 6);
    expect(next!.height).toBeCloseTo(p.height + 300, 6);
  });

  it("BASE grip dragged UP (Δ>0) → base rises, top stays (height shrinks)", () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, 200, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseOffset).toBeCloseTo(p.baseOffset + 200, 6);
    expect(next!.height).toBeCloseTo(p.height - 200, 6);
  });

  it('BASE grip with zero vertical delta → null', () => {
    expect(computeColumnResizeParams(rect(), drag('y', { x: 0, y: 0 }, 0, 'mirror'))).toBeNull();
  });

  it('dragging the TOP grip while top is attached → detaches top first, then edits height', () => {
    const p = rect({ topBinding: 'attached', attachTopToIds: ['beam-1'] });
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, 500, 'normal'));
    expect(next).not.toBeNull();
    expect(next!.topBinding).not.toBe('attached');
    expect(next!.attachTopToIds).toBeUndefined();
    expect(next!.height).toBeCloseTo(p.height + 500, 6);
  });

  it('dragging the BASE grip while base is attached → detaches base first, then edits baseOffset', () => {
    const p = rect({ baseBinding: 'attached', attachBaseToIds: ['slab-1'] });
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, -150, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseBinding).not.toBe('attached');
    expect(next!.attachBaseToIds).toBeUndefined();
    expect(next!.baseOffset).toBeCloseTo(p.baseOffset - 150, 6);
  });

  it('TOP grip on a non-attached column leaves the top binding untouched', () => {
    const p = rect();
    const next = computeColumnResizeParams(p, drag('y', { x: 0, y: 0 }, 100, 'normal'));
    expect(next!.topBinding).toBe(p.topBinding);
    expect(next!.attachTopToIds).toBe(p.attachTopToIds);
  });
});

describe('computeWallResizeParams (ADR-402 Phase B)', () => {
  it('plan resize perpendicular to the axis → thickness += 2·perp (relative)', () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('z', { x: 0, y: 25 }));
    expect(next).not.toBeNull();
    expect(next!.thickness).toBeCloseTo(p.thickness + 50, 6);
  });

  it('plan resize parallel to the axis → null (perp component 0)', () => {
    const p = wallAlongX();
    expect(computeWallResizeParams(p, drag('x', { x: 25, y: 0 }))).toBeNull();
  });

  it('manual thickness drag drops dna (validator parity)', () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('z', { x: 0, y: 25 }));
    expect(next).not.toBeNull();
    expect(next!.dna).toBeUndefined();
  });

  it('resize-y → wall height (vertical mm patch)', () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, 500));
    expect(next).not.toBeNull();
    expect(next!.height).toBeCloseTo(p.height + 500, 6);
  });

  it('thickness clamps to MIN on an over-shrink', () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('z', { x: 0, y: -100000 }));
    // clamped to a positive minimum, never zero/negative
    expect(next).not.toBeNull();
    expect(next!.thickness).toBeGreaterThan(0);
    expect(next!.thickness).toBeLessThan(p.thickness);
  });
});

describe('computeWallResizeParams — top/base vertical grips (ADR-401 E.3)', () => {
  it("TOP grip (mode 'normal') → height += Δ, base fixed", () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, 400, 'normal'));
    expect(next).not.toBeNull();
    expect(next!.height).toBeCloseTo(p.height + 400, 6);
    expect(next!.baseOffset).toBe(p.baseOffset);
  });

  it("BASE grip (mode 'mirror') dragged DOWN (Δ<0) → base lowers, top stays (height grows)", () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, -300, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseOffset).toBeCloseTo(p.baseOffset - 300, 6);
    expect(next!.height).toBeCloseTo(p.height + 300, 6);
  });

  it("BASE grip dragged UP (Δ>0) → base rises, top stays (height shrinks)", () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, 200, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseOffset).toBeCloseTo(p.baseOffset + 200, 6);
    expect(next!.height).toBeCloseTo(p.height - 200, 6);
  });

  it('BASE grip with zero vertical delta → null', () => {
    expect(computeWallResizeParams(wallAlongX(), drag('y', { x: 0, y: 0 }, 0, 'mirror'))).toBeNull();
  });

  it('dragging the TOP grip while top is attached → detaches top first (Revit), then edits height', () => {
    const p = { ...wallAlongX(), topBinding: 'attached' as const, attachTopToIds: ['beam-1'] };
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, 500, 'normal'));
    expect(next).not.toBeNull();
    expect(next!.topBinding).not.toBe('attached');
    expect(next!.attachTopToIds).toBeUndefined();
    expect(next!.height).toBeCloseTo(p.height + 500, 6);
  });

  it('dragging the BASE grip while base is attached → detaches base first, then edits baseOffset', () => {
    const p = { ...wallAlongX(), baseBinding: 'attached' as const, attachBaseToIds: ['slab-1'] };
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, -150, 'mirror'));
    expect(next).not.toBeNull();
    expect(next!.baseBinding).not.toBe('attached');
    expect(next!.attachBaseToIds).toBeUndefined();
    expect(next!.baseOffset).toBeCloseTo(p.baseOffset - 150, 6);
  });

  it('TOP grip on a non-attached wall leaves the top binding untouched', () => {
    const p = wallAlongX();
    const next = computeWallResizeParams(p, drag('y', { x: 0, y: 0 }, 100, 'normal'));
    expect(next!.topBinding).toBe(p.topBinding);
    expect(next!.attachTopToIds).toBe(p.attachTopToIds);
  });
});

describe('computeBeamResizeParams (ADR-402 Phase B)', () => {
  it('plan resize → width via beam-width grip SSoT (raw mm delta)', () => {
    const p = beamAlongX();
    const next = computeBeamResizeParams(p, drag('z', { x: 0, y: 25 }));
    expect(next).not.toBeNull();
    const expected = applyBeamGripDrag('beam-width', { originalParams: p, delta: { x: 0, y: 25 } });
    expect(next!.width).toBeCloseTo(expected.width, 6);
    expect(next!.width).toBeGreaterThan(p.width);
  });

  it('resize-y → beam depth (vertical mm patch)', () => {
    const p = beamAlongX();
    const next = computeBeamResizeParams(p, drag('y', { x: 0, y: 0 }, 300));
    expect(next).not.toBeNull();
    expect(next!.depth).toBeCloseTo(p.depth + 300, 6);
  });

  it('parallel plan drag → null (perp 0)', () => {
    const p = beamAlongX();
    expect(computeBeamResizeParams(p, drag('x', { x: 25, y: 0 }))).toBeNull();
  });
});

describe('computeSlabResizeParams (ADR-402 Phase B)', () => {
  it('resize-y → slab thickness (vertical mm patch)', () => {
    const p = squareSlab();
    const next = computeSlabResizeParams(p, drag('y', { x: 0, y: 0 }, 60));
    expect(next).not.toBeNull();
    expect(next!.thickness).toBeCloseTo(p.thickness + 60, 6);
  });

  it('plan axis → null (footprint is edited per-vertex in 2D)', () => {
    const p = squareSlab();
    expect(computeSlabResizeParams(p, drag('x', { x: 50, y: 0 }))).toBeNull();
    expect(computeSlabResizeParams(p, drag('z', { x: 0, y: 50 }))).toBeNull();
  });

  it('resize-y with zero vertical delta → null', () => {
    expect(computeSlabResizeParams(squareSlab(), drag('y', { x: 0, y: 0 }, 0))).toBeNull();
  });
});
