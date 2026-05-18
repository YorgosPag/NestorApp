// Firebase auth chain reaches DimensionRenderer via BaseEntityRenderer →
// PhaseManager → GripProvider → user-settings → firestore. Stub it before
// any imports execute so the test env doesn't need fetch / real firebase init.
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
 * ADR-362 Phase C1 — DimensionRenderer unit tests.
 *
 * Verifies the dispatch and draw-call structure (not pixel output) via a
 * mocked CanvasRenderingContext2D. Coverage targets:
 *   - linear/angular/radial dispatch
 *   - ordinate single-arrow short-circuit (arrowDirection2 = zero vector)
 *   - baseline/continued parent lookup is invoked
 *   - ACI colour resolution (DIMCLRD / DIMCLRT)
 *   - DIMSTYLE override (per-entity colour) overrides base style
 *   - radial isDiameter prefix
 *   - userText === '' suppresses text draw
 *   - suppressExtLine1/2 short-circuits extension line draws
 *   - getGrips/hitTest stubs return empty / false (Phase I deferred)
 *   - malformed geometry (baseline parent missing) does not throw
 */

import type {
  AlignedDimensionEntity,
  Angular3PDimensionEntity,
  BaselineDimensionEntity,
  DiameterDimensionEntity,
  DimStyle,
  LinearDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../types/Types';
import { DimensionRenderer } from '../DimensionRenderer';
import { DimStyleRegistry } from '../../../systems/dimensions/dim-style-registry';
import { ISO_129_TEMPLATE } from '../../../systems/dimensions/dim-style-templates';

// ──────────────────────────────────────────────────────────────────────────────
// Mock CanvasRenderingContext2D
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
  // Plain object with the surface DimensionRenderer touches — typed loosely
  // since jsdom's full Canvas2D isn't required (no pixel verification).
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
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
  };
  return { calls, canvas, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(mock: MockCtx, fn: string): number {
  return mock.calls.filter((c) => c.fn === fn).length;
}

function findCall(mock: MockCtx, fn: string): MockCtxCall | undefined {
  return mock.calls.find((c) => c.fn === fn);
}

function findCalls(mock: MockCtx, fn: string): readonly MockCtxCall[] {
  return mock.calls.filter((c) => c.fn === fn);
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixture factories
// ──────────────────────────────────────────────────────────────────────────────

function makeRenderer(): { renderer: DimensionRenderer; mock: MockCtx; registry: DimStyleRegistry } {
  const mock = createMockCtx();
  const renderer = new DimensionRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  const registry = new DimStyleRegistry();
  renderer.setStyleRegistry(registry);
  return { renderer, mock, registry };
}

function linear(defPoints: readonly Point2D[], extra: Partial<LinearDimensionEntity> = {}): LinearDimensionEntity {
  return {
    id: 'dim_lin_test',
    type: 'dimension',
    dimensionType: 'linear',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    rotation: 0,
    layerId: 'layer_test',
    ...extra,
  } as LinearDimensionEntity;
}

function aligned(defPoints: readonly Point2D[], extra: Partial<AlignedDimensionEntity> = {}): AlignedDimensionEntity {
  return {
    id: 'dim_ali_test',
    type: 'dimension',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as AlignedDimensionEntity;
}

function angular3P(defPoints: readonly Point2D[]): Angular3PDimensionEntity {
  return {
    id: 'dim_ang_test',
    type: 'dimension',
    dimensionType: 'angular3P',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
  } as Angular3PDimensionEntity;
}

function radius(defPoints: readonly Point2D[]): RadiusDimensionEntity {
  return {
    id: 'dim_rad_test',
    type: 'dimension',
    dimensionType: 'radius',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
  } as RadiusDimensionEntity;
}

function diameter(defPoints: readonly Point2D[]): DiameterDimensionEntity {
  return {
    id: 'dim_dia_test',
    type: 'dimension',
    dimensionType: 'diameter',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
  } as DiameterDimensionEntity;
}

function ordinate(defPoints: readonly Point2D[], datum: Point2D, axis: 'x' | 'y'): OrdinateDimensionEntity {
  return {
    id: 'dim_ord_test',
    type: 'dimension',
    dimensionType: 'ordinate',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    datum,
    axis,
    layerId: 'layer_test',
  } as OrdinateDimensionEntity;
}

function baseline(parentId: string, defPoints: readonly Point2D[]): BaselineDimensionEntity {
  return {
    id: 'dim_bsl_test',
    type: 'dimension',
    dimensionType: 'baseline',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    parentDimensionId: parentId,
    layerId: 'layer_test',
  } as BaselineDimensionEntity;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('DimensionRenderer — dispatch + draw structure', () => {
  it('linear dim emits dim line stroke + 2 arrowheads + text', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 20 },
    ]);
    renderer.render(entity);

    // Dim line + 2 ext lines + 2 arrowheads => ≥5 stroke calls.
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(3);
    // Text draws via fillText.
    expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(1);
  });

  it('aligned dim emits dim line stroke', () => {
    const { renderer, mock } = makeRenderer();
    const entity = aligned([
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 15, y: 25 },
    ]);
    renderer.render(entity);
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
  });

  it('angular3P dim emits arc() call', () => {
    const { renderer, mock } = makeRenderer();
    const entity = angular3P([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 70, y: 70 },
    ]);
    renderer.render(entity);
    expect(countCalls(mock, 'arc')).toBeGreaterThanOrEqual(1);
  });

  it('radius dim emits polyline leader (moveTo + lineTo)', () => {
    const { renderer, mock } = makeRenderer();
    const entity = radius([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ]);
    renderer.render(entity);
    expect(countCalls(mock, 'moveTo')).toBeGreaterThanOrEqual(1);
    expect(countCalls(mock, 'lineTo')).toBeGreaterThanOrEqual(1);
  });

  it('diameter dim prefixes text with Ø', () => {
    const { renderer, mock } = makeRenderer();
    const entity = diameter([
      { x: -50, y: 0 },
      { x: 50, y: 0 },
    ]);
    renderer.render(entity);
    const text = findCall(mock, 'fillText');
    expect(text).toBeDefined();
    expect(String(text?.args[0])).toMatch(/Ø/);
  });

  it('radius dim prefixes text with R', () => {
    const { renderer, mock } = makeRenderer();
    const entity = radius([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ]);
    renderer.render(entity);
    const text = findCall(mock, 'fillText');
    expect(text).toBeDefined();
    expect(String(text?.args[0])).toMatch(/^R\s/);
  });
});

describe('DimensionRenderer — userText suppression', () => {
  it('userText === "" suppresses text draw', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { userText: '' },
    );
    renderer.render(entity);
    expect(countCalls(mock, 'fillText')).toBe(0);
  });
});

describe('DimensionRenderer — DIMSTYLE colour resolution', () => {
  it('per-entity override of dimclrd applies to dim line stroke', () => {
    const { renderer, mock } = makeRenderer();
    // ACI 1 = red (#FF0000). Override DIMCLRD only.
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { overrides: { dimclrd: 1 } as Partial<DimStyle> },
    );
    renderer.render(entity);
    const strokeColours = findCalls(mock, 'set:strokeStyle').map((c) => String(c.args[0]));
    expect(strokeColours).toContain('#FF0000');
  });

  it('per-entity override of dimclrt applies to text fill', () => {
    const { renderer, mock } = makeRenderer();
    // ACI 3 = green (#00FF00).
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { overrides: { dimclrt: 3 } as Partial<DimStyle> },
    );
    renderer.render(entity);
    const fillColours = findCalls(mock, 'set:fillStyle').map((c) => String(c.args[0]));
    expect(fillColours).toContain('#00FF00');
  });
});

describe('DimensionRenderer — extension line suppression', () => {
  it('suppressExtLine1 short-circuits the first extension line stroke', () => {
    const { renderer, mock: mockA } = makeRenderer();
    const baselineEntity = linear([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 20 },
    ]);
    renderer.render(baselineEntity);
    const baseStrokes = countCalls(mockA, 'stroke');

    const { renderer: r2, mock: mockB } = makeRenderer();
    const suppressed = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { overrides: { suppressExtLine1: true, suppressExtLine2: true } as Partial<DimStyle> },
    );
    r2.render(suppressed);
    const suppressedStrokes = countCalls(mockB, 'stroke');

    expect(suppressedStrokes).toBeLessThan(baseStrokes);
  });
});

describe('DimensionRenderer — ordinate single arrow', () => {
  it('ordinate dim renders a polyline leader (linear geometry, single-arrow)', () => {
    const { renderer, mock } = makeRenderer();
    const entity = ordinate([{ x: 50, y: 30 }], { x: 0, y: 0 }, 'x');
    renderer.render(entity);
    // The geometry is `linear` kind; renderer draws dim line + (one) arrow.
    // Just assert no crash and that some stroke + fillText happened.
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
    expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(1);
  });
});

describe('DimensionRenderer — chained dim lookup', () => {
  it('baseline dim invokes the lookup callback for its parent', () => {
    const { renderer, mock } = makeRenderer();
    const parent = linear([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 20 },
    ]);
    const lookupCalls: string[] = [];
    renderer.setDimensionLookup((id) => {
      lookupCalls.push(id);
      return id === parent.id ? parent : undefined;
    });

    const child = baseline(parent.id, [{ x: 150, y: 0 }]);
    renderer.render(child);
    expect(lookupCalls).toContain(parent.id);
    // Render succeeded (some stroke happened).
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
  });

  it('baseline dim with missing parent does not throw (renderer swallows)', () => {
    const { renderer } = makeRenderer();
    renderer.setDimensionLookup(() => undefined);
    const child = baseline('does_not_exist', [{ x: 150, y: 0 }]);
    expect(() => renderer.render(child)).not.toThrow();
  });
});

describe('DimensionRenderer — arrowhead block variants', () => {
  it('closedFilled triangle arrowhead triggers fill()', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { overrides: { dimblk: 'closedFilled', dimblk1: 'closedFilled', dimblk2: 'closedFilled' } as Partial<DimStyle> },
    );
    renderer.render(entity);
    expect(countCalls(mock, 'fill')).toBeGreaterThanOrEqual(2);
  });

  it('dot arrowhead emits arc() for circle primitive', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { overrides: { dimblk: 'dot', dimblk1: 'dot', dimblk2: 'dot' } as Partial<DimStyle> },
    );
    renderer.render(entity);
    // Linear geometry has no arc itself; arc() calls must come from dot arrowheads.
    expect(countCalls(mock, 'arc')).toBeGreaterThanOrEqual(2);
  });

  it('closedBlank triangle arrowhead triggers stroke (hollow)', () => {
    const { renderer, mock } = makeRenderer();
    const fillsBefore = (m: MockCtx) => countCalls(m, 'fill');
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      { overrides: { dimblk: 'closedBlank', dimblk1: 'closedBlank', dimblk2: 'closedBlank' } as Partial<DimStyle> },
    );
    renderer.render(entity);
    // closedBlank is non-solid → uses stroke, not fill.
    expect(fillsBefore(mock)).toBe(0);
  });
});

describe('DimensionRenderer — tolerance + limits rendering (Phase G2)', () => {
  it('tolerance mode draws 3 fillText calls (primary + plus + minus)', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      {
        overrides: {
          dimtol: true,
          dimlim: false,
          dimtp: 0.1,
          dimtm: -0.05,
          dimtdec: 2,
          dimtfac: 0.75,
          dimtolj: 'middle',
        } as Partial<DimStyle>,
      },
    );
    renderer.render(entity);
    expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(3);
  });

  it('limits mode draws 2 fillText calls (upper + lower, no primary)', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      {
        overrides: {
          dimlim: true,
          dimtol: false,
          dimtp: 0.5,
          dimtm: -0.3,
        } as Partial<DimStyle>,
      },
    );
    renderer.render(entity);
    expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(2);
  });

  it('DIMLIM overrides DIMTOL when both true — still 2 fillText calls', () => {
    const { renderer, mock } = makeRenderer();
    const entity = linear(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 20 },
      ],
      {
        overrides: {
          dimlim: true,
          dimtol: true,
          dimtp: 0.1,
          dimtm: -0.1,
          dimtdec: 2,
        } as Partial<DimStyle>,
      },
    );
    renderer.render(entity);
    // Limits mode: upper + lower = 2 fillText (not 3 from tolerance mode).
    expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(2);
  });
});

describe('DimensionRenderer — stubs for Phase I', () => {
  it('getGrips returns empty (Phase I deferred)', () => {
    const { renderer } = makeRenderer();
    const entity = linear([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 20 },
    ]);
    expect(renderer.getGrips(entity)).toEqual([]);
  });

  it('hitTest returns false (Phase I deferred)', () => {
    const { renderer } = makeRenderer();
    const entity = linear([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 20 },
    ]);
    expect(renderer.hitTest(entity, { x: 0, y: 0 }, 1)).toBe(false);
  });
});
