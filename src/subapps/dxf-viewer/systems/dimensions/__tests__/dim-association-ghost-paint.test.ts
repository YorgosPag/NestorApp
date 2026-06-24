// Firebase-auth stub guard — renderPreviewDimension transitively pulls dim text
// config that may import firebase (same guard as preview-dimension-renderer.test.ts).
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
 * ADR-362 Phase J4 — dim-association-ghost-paint unit tests.
 *
 * Verifies the live-follow paint SSoT:
 *   - only dims referencing a MOVING host are painted (selection logic)
 *   - the 2nd intersection host (`geometryId2`) is also detected
 *   - the painted dim follows the moving geometry (preview ≡ commit recompute)
 *   - no moving entities / no dims → no-op
 */

import type {
  AlignedDimensionEntity,
  DimensionEntity,
  DimStyle,
} from '../../../types/dimension';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import { paintAssociatedDimensionGhosts } from '../dim-association-ghost-paint';

// ── Mock CanvasRenderingContext2D ───────────────────────────────────────────────

interface MockCtxCall { fn: string; args: readonly unknown[]; }
interface MockCtx { calls: MockCtxCall[]; ctx: CanvasRenderingContext2D; }

function createMockCtx(): MockCtx {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const ctxStub = {
    canvas: { width: 800, height: 600 },
    save: record('save'), restore: record('restore'), beginPath: record('beginPath'),
    moveTo: record('moveTo'), lineTo: record('lineTo'), closePath: record('closePath'),
    stroke: record('stroke'), fill: record('fill'), fillText: record('fillText'),
    arc: record('arc'), translate: record('translate'), rotate: record('rotate'),
    scale: record('scale'), setLineDash: record('setLineDash'),
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
    set lineCap(_v: string) {}, set globalAlpha(_v: number) {}, set font(_v: string) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function moveToArgs(mock: MockCtx): Point2D[] {
  return mock.calls.filter(c => c.fn === 'moveTo').map(c => ({ x: c.args[0] as number, y: c.args[1] as number }));
}

// ── Fixtures ────────────────────────────────────────────────────────────────────

function line(id: string, start: Point2D, end: Point2D): SceneEntity {
  return { id, type: 'line', start, end, layerId: 'L' } as unknown as SceneEntity;
}

/** Aligned dim measuring line `geomId` endpoints, dim line offset at `dimLineRef`. */
function alignedDimOnLine(geomId: string, start: Point2D, end: Point2D, dimLineRef: Point2D): DimensionEntity {
  return {
    id: 'dim_ali', type: 'dimension', dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id, layerId: 'L',
    defPoints: [start, end, dimLineRef],
    associations: [
      { geometryId: geomId, defPointIndex: 0, associationType: 'endpoint', subIndex: 0 },
      { geometryId: geomId, defPointIndex: 1, associationType: 'endpoint', subIndex: 1 },
    ],
  } as unknown as AlignedDimensionEntity as DimensionEntity;
}

const STYLE: DimStyle = ISO_129_TEMPLATE;
const resolveStyle = (): DimStyle => STYLE;
const baseParams = {
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
  viewport: { width: 800, height: 600 },
  resolveStyle,
  sceneUnits: 'mm' as const,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('paintAssociatedDimensionGhosts — selection', () => {
  it('paints a dim whose endpoint host is moving (returns 1, strokes emitted)', () => {
    const orig = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const dim = alignedDimOnLine('L1', { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 });
    const moved = line('L1', { x: 10, y: 0 }, { x: 110, y: 0 });
    const mock = createMockCtx();

    const painted = paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mock.ctx,
      movingEntities: new Map([['L1', moved]]),
      dims: [dim],
      getOriginalEntity: (id) => (id === 'L1' ? orig : undefined),
    });

    expect(painted).toBe(1);
    expect(mock.calls.some(c => c.fn === 'stroke')).toBe(true);
  });

  it('does NOT paint a dim that references no moving host (returns 0)', () => {
    const dim = alignedDimOnLine('L1', { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 });
    const mock = createMockCtx();

    const painted = paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mock.ctx,
      movingEntities: new Map([['OTHER', line('OTHER', { x: 0, y: 0 }, { x: 1, y: 1 })]]),
      dims: [dim],
      getOriginalEntity: () => undefined,
    });

    expect(painted).toBe(0);
    expect(mock.calls.length).toBe(0);
  });

  it('detects the 2nd intersection host via geometryId2', () => {
    const dim = {
      id: 'dim_int', type: 'dimension', dimensionType: 'aligned',
      styleId: ISO_129_TEMPLATE.id, layerId: 'L',
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 80 }],
      associations: [
        { geometryId: 'A', defPointIndex: 0, associationType: 'intersection', geometryId2: 'B' },
      ],
    } as unknown as DimensionEntity;
    const mock = createMockCtx();

    // Only host B (the geometryId2) is moving — must still be detected.
    const painted = paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mock.ctx,
      movingEntities: new Map([['B', line('B', { x: 0, y: 0 }, { x: 1, y: 1 })]]),
      dims: [dim],
      getOriginalEntity: () => undefined,
    });

    expect(painted).toBe(1);
  });

  it('is a no-op with empty movingEntities or empty dims', () => {
    const dim = alignedDimOnLine('L1', { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 });
    const mock = createMockCtx();
    expect(paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mock.ctx, movingEntities: new Map(), dims: [dim], getOriginalEntity: () => undefined,
    })).toBe(0);
    expect(paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mock.ctx, movingEntities: new Map([['L1', line('L1', { x: 0, y: 0 }, { x: 1, y: 1 })]]),
      dims: [], getOriginalEntity: () => undefined,
    })).toBe(0);
    expect(mock.calls.length).toBe(0);
  });
});

describe('paintAssociatedDimensionGhosts — live follow (preview ≡ commit)', () => {
  it('moving the host shifts the rendered dim-line stroke by the same delta', () => {
    const orig = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const dim = alignedDimOnLine('L1', { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 });

    // Frame A: host at original position (identity move via same coords).
    const mockA = createMockCtx();
    paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mockA.ctx,
      movingEntities: new Map([['L1', orig]]),
      dims: [dim], getOriginalEntity: (id) => (id === 'L1' ? orig : undefined),
    });

    // Frame B: host moved +10 in X → dim foot points must shift +10 in X.
    const mockB = createMockCtx();
    paintAssociatedDimensionGhosts({
      ...baseParams, ctx: mockB.ctx,
      movingEntities: new Map([['L1', line('L1', { x: 10, y: 0 }, { x: 110, y: 0 })]]),
      dims: [dim], getOriginalEntity: (id) => (id === 'L1' ? orig : undefined),
    });

    // Arrowheads draw in translated local space (moveTo ≈ 0 → translation-invariant),
    // so compare only the world-space geometry strokes (ext lines + dim line): take the
    // max moveTo X, which belongs to the rightmost foot point. At scale 1 a +10 world
    // shift maps to a +10 screen-X shift (linear transform → translation invariant).
    const maxX = (mock: MockCtx) => Math.max(...moveToArgs(mock).map(p => p.x));
    expect(moveToArgs(mockA).length).toBeGreaterThan(0);
    expect(maxX(mockB) - maxX(mockA)).toBeCloseTo(10, 5);
  });
});
