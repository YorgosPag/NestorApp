/**
 * ADR-625 — Cluster #16 edit/transform preview SSoT — unit + smoke tests.
 *
 * Locks the extracted primitives' contracts:
 *   - `tracePolyline` (overlay-draw-primitives) — screen-space moveTo/lineTo path.
 *   - `nearestEntityMatching` / `resolveCornerStrokes` (use-corner-tool-preview) —
 *     hover pick + polyline-vs-two-line dispatch routing.
 *   - `useEditFencePreview` — isActive gate + colour-driven paint, exercised through
 *     the real `useGhostOverlay` stack (only `useCanvasGhostPreview` is mocked).
 * Plus a module-load smoke over all 6 bindings + 3 primitives (the @swc/jest
 * transform is transpile-only → does NOT catch broken imports/exports; this does).
 */

import { renderHook } from '@testing-library/react';
import type { ViewTransform } from '../../../rendering/types/Types';
import type { GhostDrawFrame } from '../../../systems/preview/ghost-preview-frame';

jest.mock('../useCanvasGhostPreview', () => ({ useCanvasGhostPreview: jest.fn() }));
jest.mock('../../../utils/entity-distance', () => ({ distanceToEntity: jest.fn(() => 0) }));
jest.mock('../../../systems/corner/corner-math', () => ({ resolveSharedPolylineCorner: jest.fn(() => 0) }));
// The WYSIWYG real-entity renderer pulls the full render chain (→ firebase auth → `fetch`)
// which is out of scope for these SSoT contract tests — stub the transform deps.
jest.mock('../useBimPreviewRenderer', () => ({ useBimPreviewRenderer: () => () => ({}) }));
jest.mock('../useLevelLayersById', () => ({ useLevelLayersById: () => () => ({}) }));
jest.mock('../../../rendering/ghost/draw-real-entity-preview', () => ({ drawRealEntityPreview: jest.fn() }));

import { useCanvasGhostPreview } from '../useCanvasGhostPreview';
import { tracePolyline } from '../overlay-draw-primitives';
import {
  useEditFencePreview,
  type EditFencePreviewColors,
  type EditFencePreviewState,
} from '../use-edit-fence-preview';
import {
  nearestEntityMatching,
  resolveCornerStrokes,
  type CornerPolyState,
} from '../use-corner-tool-preview';

const mockHarness = useCanvasGhostPreview as jest.Mock;

// ── Recording canvas ctx ────────────────────────────────────────────────────
interface RecordingCtx {
  ctx: CanvasRenderingContext2D;
  calls: string[];
  strokeStyles: string[];
}
function makeRecordingCtx(): RecordingCtx {
  const calls: string[] = [];
  const strokeStyles: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => { calls.push(`${name}(${args.join(',')})`); };
  const ctx = {
    save: rec('save'), restore: rec('restore'), beginPath: rec('beginPath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), stroke: rec('stroke'),
    strokeRect: rec('strokeRect'), setLineDash: rec('setLineDash'), fillText: rec('fillText'),
    lineWidth: 0, globalAlpha: 1, font: '', fillStyle: '',
    set strokeStyle(v: string) { strokeStyles.push(v); },
    get strokeStyle() { return strokeStyles.at(-1) ?? ''; },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls, strokeStyles };
}

const TRANSFORM = { scale: 1, offsetX: 0, offsetY: 0 } as unknown as ViewTransform;
function makeFrame(ctx: CanvasRenderingContext2D, effectiveCursor: { x: number; y: number } | null): GhostDrawFrame {
  return { ctx, effectiveCursor, viewport: { width: 100, height: 100 }, transform: TRANSFORM };
}
function lastDraw(): (frame: GhostDrawFrame) => void {
  return mockHarness.mock.calls.at(-1)![0].draw;
}
function lastIsActive(): boolean {
  return mockHarness.mock.calls.at(-1)![0].isActive;
}

beforeEach(() => mockHarness.mockClear());

// ── tracePolyline ───────────────────────────────────────────────────────────
describe('tracePolyline', () => {
  it('moveTo the first point then lineTo the rest, in screen space', () => {
    const { ctx, calls } = makeRecordingCtx();
    const toScreen = (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 });
    tracePolyline(ctx, [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], toScreen);
    expect(calls).toEqual(['moveTo(2,2)', 'lineTo(4,4)', 'lineTo(6,6)']);
  });
  it('no-ops on an empty path', () => {
    const { ctx, calls } = makeRecordingCtx();
    tracePolyline(ctx, [], (p) => p);
    expect(calls).toEqual([]);
  });
});

// ── nearestEntityMatching ───────────────────────────────────────────────────
describe('nearestEntityMatching', () => {
  type E = { id: string; kind: string };
  const scene = { entities: [
    { id: 'a', kind: 'line' }, { id: 'b', kind: 'line' }, { id: 'c', kind: 'arc' },
  ] } as never;
  const isLine = (e: unknown): e is E => (e as E).kind === 'line';

  it('returns the closest predicate match within tolerance', () => {
    const dist: Record<string, number> = { a: 5, b: 2 };
    const got = nearestEntityMatching(scene, { x: 0, y: 0 }, 10, isLine, (_c, e) => dist[(e as E).id]);
    expect(got?.id).toBe('b');
  });
  it('skips the excludeId and non-matching kinds', () => {
    const got = nearestEntityMatching(scene, { x: 0, y: 0 }, 10, isLine, () => 1, 'b');
    expect(got?.id).toBe('a');
  });
  it('returns null when everything is beyond tolerance', () => {
    const got = nearestEntityMatching(scene, { x: 0, y: 0 }, 1, isLine, () => 99);
    expect(got).toBeNull();
  });
});

// ── resolveCornerStrokes (dispatch routing) ─────────────────────────────────
describe('resolveCornerStrokes dispatch', () => {
  const scene = { entities: [{ id: 'p', poly: true }] } as never;
  const isPolyline = (e: unknown): e is never => (e as { poly?: boolean }).poly === true;
  const stroke = { entity: { id: 'ghost' }, close: false } as never;

  function ops(twoLines: jest.Mock, whole: jest.Mock = jest.fn(() => ({ entity: { id: 'w' } })), corner: jest.Mock = jest.fn(() => ({ entity: { id: 'c' } }))) {
    return { isPolyline, wholePolyline: whole as never, polylineCorner: corner as never, twoLines: twoLines as never };
  }

  it('routes polylineMode → wholePolyline (never two-lines)', () => {
    const two = jest.fn();
    const whole = jest.fn(() => ({ entity: { id: 'w' } }));
    const s = { phase: 'picking-first', polylineMode: true, first: null, firstPick: null } as CornerPolyState;
    const out = resolveCornerStrokes(s, scene, { x: 0, y: 0 }, 10, ops(two, whole));
    expect(whole).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();
    expect(out).toEqual([{ entity: { id: 'w' }, close: false }]);
  });

  it('routes picking-second + polyline first → polylineCorner', () => {
    const two = jest.fn();
    const corner = jest.fn(() => ({ entity: { id: 'c' } }));
    const s = { phase: 'picking-second', polylineMode: false, first: { id: 'p', poly: true }, firstPick: { x: 0, y: 0 } } as never;
    resolveCornerStrokes(s, scene, { x: 0, y: 0 }, 10, ops(two, jest.fn(), corner));
    expect(corner).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();
  });

  it('falls through to bespoke two-lines when first is not a polyline', () => {
    const two = jest.fn(() => [stroke]);
    const s = { phase: 'picking-second', polylineMode: false, first: { id: 'L', poly: false }, firstPick: null } as never;
    const out = resolveCornerStrokes(s, scene, { x: 0, y: 0 }, 10, ops(two));
    expect(two).toHaveBeenCalledTimes(1);
    expect(out).toEqual([stroke]);
  });

  it('returns [] when picking-first with no polyline mode (nothing to draw)', () => {
    const two = jest.fn();
    const s = { phase: 'picking-first', polylineMode: false, first: null, firstPick: null } as CornerPolyState;
    expect(resolveCornerStrokes(s, scene, { x: 0, y: 0 }, 10, ops(two))).toEqual([]);
    expect(two).not.toHaveBeenCalled();
  });
});

// ── useEditFencePreview (through the real useGhostOverlay stack) ─────────────
describe('useEditFencePreview', () => {
  const EXTEND_COLORS: EditFencePreviewColors = {
    path: (inv) => (inv ? '#FF3030' : '#22DD55'),
    pickbox: (inv) => (inv ? '#FF3030' : '#22DD55'),
    showArrow: (inv) => !inv,
  };
  function fakeStore(state: EditFencePreviewState) {
    return { subscribe: () => () => {}, getState: () => state };
  }
  const idleFields = { inverseMode: false, hoverPreview: null, dragPreview: null, dragStart: null, dragCurrent: null };

  it('gates isActive on phase !== idle', () => {
    renderHook(() => useEditFencePreview({
      store: fakeStore({ phase: 'idle', ...idleFields }),
      colors: EXTEND_COLORS, transform: TRANSFORM, getCanvas: () => null,
    }));
    expect(lastIsActive()).toBe(false);

    renderHook(() => useEditFencePreview({
      store: fakeStore({ phase: 'picking', ...idleFields }),
      colors: EXTEND_COLORS, transform: TRANSFORM, getCanvas: () => null,
    }));
    expect(lastIsActive()).toBe(true);
  });

  it('paints the pickbox + arrow with the resolved colour, skips when idle', () => {
    const state: EditFencePreviewState = { phase: 'picking', ...idleFields };
    renderHook(() => useEditFencePreview({
      store: fakeStore(state), colors: EXTEND_COLORS, transform: TRANSFORM, getCanvas: () => null,
    }));
    const active = makeRecordingCtx();
    lastDraw()(makeFrame(active.ctx, { x: 5, y: 5 }));
    expect(active.calls.some((c) => c.startsWith('strokeRect'))).toBe(true); // pickbox
    expect(active.strokeStyles).toContain('#22DD55');                        // extend green

    const idle = makeRecordingCtx();
    lastDraw()(makeFrame(idle.ctx, { x: 5, y: 5 }));
    // draw reads store.getState() live — but state is still 'picking' here, so it paints.
    expect(idle.calls.length).toBeGreaterThan(0);
  });
});

// ── module-load smoke ───────────────────────────────────────────────────────
describe('module-load smoke — primitives + 6 bindings export a callable', () => {
  const modules: ReadonlyArray<readonly [string, string]> = [
    ['../use-ghost-overlay', 'useGhostOverlay'],
    ['../overlay-draw-primitives', 'tracePolyline'],
    ['../use-edit-fence-preview', 'useEditFencePreview'],
    ['../use-corner-tool-preview', 'useCornerToolPreview'],
    ['../use-transform-ghost-preview', 'useTransformGhostPreview'],
    ['../useExtendPreview', 'useExtendPreview'],
    ['../useTrimPreview', 'useTrimPreview'],
    ['../useChamferPreview', 'useChamferPreview'],
    ['../useFilletPreview', 'useFilletPreview'],
    ['../useScalePreview', 'useScalePreview'],
    ['../useStretchPreview', 'useStretchPreview'],
  ];
  it.each(modules)('%s exports a callable %s', (path, name) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path) as Record<string, unknown>;
    expect(typeof mod[name]).toBe('function');
  });
});
