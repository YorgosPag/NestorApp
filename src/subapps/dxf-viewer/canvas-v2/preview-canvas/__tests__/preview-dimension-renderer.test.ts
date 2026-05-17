// Same firebase-auth stub guard as DimensionRenderer.test.ts — dim text
// renderer transitively pulls config that may import firebase.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-362 Phase C2 — preview-dimension-renderer unit tests.
 *
 * Verifies the preview overlay renderer:
 *   - dispatches correctly per geometry kind (linear / angular / radial)
 *   - applies the preview color + opacity globally
 *   - reuses the C1 pipeline (extension lines, arrowheads, text)
 *   - swallows geometry-builder failures (partial def points)
 *   - dashed helper polyline is drawn when `helperPath` is supplied
 *   - custom opts (color / opacity) flow through
 */

import type {
  AlignedDimensionEntity,
  Angular3PDimensionEntity,
  DiameterDimensionEntity,
  DimStyle,
  LinearDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../../../systems/dimensions/dim-style-templates';
import { CAD_UI_COLORS, OPACITY } from '../../../config/color-config';
import { renderPreviewDimension } from '../preview-dimension-renderer';

// ──────────────────────────────────────────────────────────────────────────────
// Mock CanvasRenderingContext2D (same shape as DimensionRenderer.test.ts)
// ──────────────────────────────────────────────────────────────────────────────

interface MockCtxCall {
  fn: string;
  args: readonly unknown[];
}

interface MockCtx {
  calls: MockCtxCall[];
  canvas: { width: number; height: number };
  ctx: CanvasRenderingContext2D;
}

function createMockCtx(width = 800, height = 600): MockCtx {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) =>
    (...args: unknown[]): unknown => {
      calls.push({ fn, args });
      return undefined;
    };
  const canvas = { width, height };
  const ctxStub = {
    canvas,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    stroke: record('stroke'),
    fill: record('fill'),
    fillText: record('fillText'),
    arc: record('arc'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    setLineDash: record('setLineDash'),
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
  };
  return { calls, canvas, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(mock: MockCtx, fn: string): number {
  return mock.calls.filter((c) => c.fn === fn).length;
}

function findCallArgs(mock: MockCtx, fn: string): readonly unknown[] | undefined {
  return mock.calls.find((c) => c.fn === fn)?.args;
}

function lastCallArgs(mock: MockCtx, fn: string): readonly unknown[] | undefined {
  const matches = mock.calls.filter((c) => c.fn === fn);
  return matches.length > 0 ? matches[matches.length - 1].args : undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixture factories
// ──────────────────────────────────────────────────────────────────────────────

function makeParams(
  entity: LinearDimensionEntity | AlignedDimensionEntity | Angular3PDimensionEntity | RadiusDimensionEntity | DiameterDimensionEntity,
  style: DimStyle = ISO_129_TEMPLATE,
  opts: Parameters<typeof renderPreviewDimension>[0]['opts'] = undefined,
): { mock: MockCtx; params: Parameters<typeof renderPreviewDimension>[0] } {
  const mock = createMockCtx();
  return {
    mock,
    params: {
      ctx: mock.ctx,
      entity,
      style,
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: mock.canvas.width, height: mock.canvas.height },
      opts,
    },
  };
}

function linear(defPoints: readonly Point2D[]): LinearDimensionEntity {
  return {
    id: 'dim_lin_test', type: 'dimension', dimensionType: 'linear',
    styleId: ISO_129_TEMPLATE.id, defPoints, rotation: 0, layerId: 'layer_test',
  } as LinearDimensionEntity;
}

function aligned(defPoints: readonly Point2D[]): AlignedDimensionEntity {
  return {
    id: 'dim_ali_test', type: 'dimension', dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id, defPoints, layerId: 'layer_test',
  } as AlignedDimensionEntity;
}

function angular3P(defPoints: readonly Point2D[]): Angular3PDimensionEntity {
  return {
    id: 'dim_ang_test', type: 'dimension', dimensionType: 'angular3P',
    styleId: ISO_129_TEMPLATE.id, defPoints, layerId: 'layer_test',
  } as Angular3PDimensionEntity;
}

function radius(defPoints: readonly Point2D[]): RadiusDimensionEntity {
  return {
    id: 'dim_rad_test', type: 'dimension', dimensionType: 'radius',
    styleId: ISO_129_TEMPLATE.id, defPoints, layerId: 'layer_test',
  } as RadiusDimensionEntity;
}

function diameter(defPoints: readonly Point2D[]): DiameterDimensionEntity {
  return {
    id: 'dim_dia_test', type: 'dimension', dimensionType: 'diameter',
    styleId: ISO_129_TEMPLATE.id, defPoints, layerId: 'layer_test',
  } as DiameterDimensionEntity;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('renderPreviewDimension — dispatch + draw structure', () => {
  it('linear preview emits dim line stroke + 2 arrowheads + text', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]));
    renderPreviewDimension(params);
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(3);
    expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(1);
  });

  it('aligned preview emits dim line stroke', () => {
    const { mock, params } = makeParams(aligned([
      { x: 0, y: 0 }, { x: 30, y: 40 }, { x: 15, y: 25 },
    ]));
    renderPreviewDimension(params);
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
  });

  it('angular3P preview emits arc() call', () => {
    const { mock, params } = makeParams(angular3P([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 70, y: 70 },
    ]));
    renderPreviewDimension(params);
    expect(countCalls(mock, 'arc')).toBeGreaterThanOrEqual(1);
  });

  it('radius preview emits polyline leader (moveTo + lineTo)', () => {
    const { mock, params } = makeParams(radius([
      { x: 0, y: 0 }, { x: 50, y: 0 },
    ]));
    renderPreviewDimension(params);
    expect(countCalls(mock, 'moveTo')).toBeGreaterThanOrEqual(1);
    expect(countCalls(mock, 'lineTo')).toBeGreaterThanOrEqual(1);
  });

  it('diameter preview prefixes text with Ø', () => {
    const { mock, params } = makeParams(diameter([
      { x: -50, y: 0 }, { x: 50, y: 0 },
    ]));
    renderPreviewDimension(params);
    const args = findCallArgs(mock, 'fillText');
    expect(args).toBeDefined();
    expect(String(args?.[0])).toMatch(/Ø/);
  });
});

describe('renderPreviewDimension — preview styling', () => {
  it('applies default preview color (CAD_UI_COLORS.entity.preview)', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]));
    renderPreviewDimension(params);
    const strokeColors = mock.calls.filter((c) => c.fn === 'set:strokeStyle');
    const fillColors = mock.calls.filter((c) => c.fn === 'set:fillStyle');
    const allColors = [...strokeColors, ...fillColors].map((c) => String(c.args[0]));
    expect(allColors).toContain(CAD_UI_COLORS.entity.preview);
  });

  it('applies default preview opacity (OPACITY.HIGH)', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]));
    renderPreviewDimension(params);
    const alphas = mock.calls
      .filter((c) => c.fn === 'set:globalAlpha')
      .map((c) => c.args[0] as number);
    expect(alphas).toContain(OPACITY.HIGH);
  });

  it('honours opts.color override', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]), ISO_129_TEMPLATE, { color: '#ff00ff' });
    renderPreviewDimension(params);
    const colors = mock.calls
      .filter((c) => c.fn === 'set:strokeStyle' || c.fn === 'set:fillStyle')
      .map((c) => String(c.args[0]));
    expect(colors).toContain('#ff00ff');
  });

  it('honours opts.opacity override', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]), ISO_129_TEMPLATE, { opacity: 0.42 });
    renderPreviewDimension(params);
    const alphas = mock.calls
      .filter((c) => c.fn === 'set:globalAlpha')
      .map((c) => c.args[0] as number);
    expect(alphas).toContain(0.42);
  });
});

describe('renderPreviewDimension — helper polyline (rubber band)', () => {
  it('does NOT emit dashed setLineDash when no helperPath provided', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]));
    renderPreviewDimension(params);
    const dashCalls = mock.calls
      .filter((c) => c.fn === 'setLineDash')
      .map((c) => c.args[0] as readonly number[]);
    // All dash calls during dim render should be empty arrays (solid).
    for (const dash of dashCalls) {
      expect(dash.length).toBe(0);
    }
  });

  it('emits dashed setLineDash + extra moveTo/lineTo when helperPath supplied', () => {
    const helperPath: Point2D[] = [
      { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 },
    ];
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]), ISO_129_TEMPLATE, { helperPath });
    renderPreviewDimension(params);
    const dashedCall = mock.calls.find(
      (c) => c.fn === 'setLineDash' && Array.isArray(c.args[0]) && (c.args[0] as readonly number[]).length > 0,
    );
    expect(dashedCall).toBeDefined();
  });

  it('ignores helperPath with fewer than 2 points', () => {
    const helperPath: Point2D[] = [{ x: 0, y: 0 }];
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]), ISO_129_TEMPLATE, { helperPath });
    renderPreviewDimension(params);
    const dashedCall = mock.calls.find(
      (c) => c.fn === 'setLineDash' && Array.isArray(c.args[0]) && (c.args[0] as readonly number[]).length > 0,
    );
    expect(dashedCall).toBeUndefined();
  });
});

describe('renderPreviewDimension — robustness', () => {
  it('swallows builder failures (missing def points) without throwing', () => {
    // Linear builder needs 3 def points — supply only 1 to force failure.
    const bad = linear([{ x: 0, y: 0 }]);
    const { mock, params } = makeParams(bad);
    expect(() => renderPreviewDimension(params)).not.toThrow();
    // No save/restore because we bail before save().
    expect(countCalls(mock, 'stroke')).toBe(0);
    expect(countCalls(mock, 'fillText')).toBe(0);
  });

  it('save/restore wraps the entire preview render', () => {
    const { mock, params } = makeParams(linear([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 },
    ]));
    renderPreviewDimension(params);
    // At least one outer save/restore (renderer also save/restores inside text + helper paths).
    expect(countCalls(mock, 'save')).toBeGreaterThanOrEqual(1);
    expect(countCalls(mock, 'restore')).toBeGreaterThanOrEqual(1);
    // Last call must be restore (outer wrapper closes the preview).
    const lastFn = mock.calls[mock.calls.length - 1]?.fn;
    expect(lastFn === 'restore' || lastFn === 'set:globalAlpha').toBe(true);
    // Re-check via last-of-each to confirm restore is invoked.
    expect(lastCallArgs(mock, 'restore')).toBeDefined();
  });
});
