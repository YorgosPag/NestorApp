/**
 * ADR-376 Phase C.1 — opening-tag-drag-controller unit tests.
 *
 * Verifies:
 *   - Pure helpers: getOffsetOrZero, tagWorldCenter, screenDeltaToWorldDelta,
 *     isOffsetSignificant
 *   - hitTestTag: hit / miss / z-order, zoom threshold, hidden tags
 *   - FSM transitions: startDrag → updateDrag → endDrag, startDrag → cancelDrag
 *   - Idempotency: cancel/end without active drag = no-op
 *   - Offset accumulation: existing offset + drag delta == final offset
 */

import {
  OpeningTagDragController,
  hitTestTag,
  tagWorldCenter,
  getOffsetOrZero,
  screenDeltaToWorldDelta,
  isOffsetSignificant,
  NULL_OFFSET,
  TAG_HIT_HALF_WIDTH_PX,
  TAG_HIT_HALF_HEIGHT_PX,
  type TagHitResult,
} from '../opening-tag-drag-controller';
import type { OpeningEntity } from '../../types/opening-types';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';

// ---------------------------------------------------------------------------
// Mocks — CoordinateTransforms.worldToScreen returns identity-shifted-by-margin
// so test assertions stay readable.
// ---------------------------------------------------------------------------

jest.mock('../../../rendering/core/CoordinateTransforms', () => ({
  CoordinateTransforms: {
    worldToScreen: jest.fn((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
  },
  MARGINS: { left: 0, top: 0, right: 0, bottom: 0 },
  COORDINATE_LAYOUT: { MARGINS: { left: 0, top: 0, right: 0, bottom: 0 } },
}));

// `computeTagCenter` is imported from OpeningTagRenderer — mock the entire
// module since it pulls in canvas-pill (which has no canvas API in jsdom).
jest.mock('../../renderers/OpeningTagRenderer', () => ({
  computeTagCenter: (opening: { id: string }) => {
    // Each fixture stores its base centroid σε `__baseCenter`.
    const base = (opening as unknown as { __baseCenter?: { x: number; y: number } })
      .__baseCenter ?? { x: 0, y: 0 };
    return { x: base.x, y: base.y, z: 0 };
  },
  OPENING_TAG_MIN_ZOOM: 0.5,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRANSFORM: ViewTransform = { offsetX: 0, offsetY: 0, scale: 1 } as ViewTransform;
const VIEWPORT: Viewport = { width: 800, height: 600 } as Viewport;
const CANVAS_RECT = { left: 0, top: 0 };

function makeOpening(
  id: string,
  baseCenter: { x: number; y: number },
  overrides: Partial<OpeningEntity['params']> = {},
): OpeningEntity {
  const opening = {
    id,
    type: 'opening' as const,
    kind: 'window' as const,
    layerId: '0',
    params: { mark: 'Π.101', tagVisible: true, ...overrides } as OpeningEntity['params'],
    geometry: {} as OpeningEntity['geometry'],
    validation: undefined as unknown as OpeningEntity['validation'],
    visible: true,
  } as unknown as OpeningEntity;
  (opening as unknown as { __baseCenter: { x: number; y: number } }).__baseCenter = baseCenter;
  return opening;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('pure helpers', () => {
  test('getOffsetOrZero — returns persisted offset', () => {
    const o = makeOpening('o1', { x: 100, y: 100 }, { tagOffset: { dx: 50, dy: -25 } });
    expect(getOffsetOrZero(o)).toEqual({ dx: 50, dy: -25 });
  });

  test('getOffsetOrZero — falls back to (0,0) when undefined', () => {
    const o = makeOpening('o1', { x: 100, y: 100 });
    expect(getOffsetOrZero(o)).toEqual(NULL_OFFSET);
  });

  test('tagWorldCenter — adds offset to base centroid', () => {
    const o = makeOpening('o1', { x: 200, y: 300 }, { tagOffset: { dx: 50, dy: -10 } });
    expect(tagWorldCenter(o)).toEqual({ x: 250, y: 290 });
  });

  test('tagWorldCenter — falls back to base centroid when no offset', () => {
    const o = makeOpening('o1', { x: 200, y: 300 });
    expect(tagWorldCenter(o)).toEqual({ x: 200, y: 300 });
  });

  test('screenDeltaToWorldDelta — scale=1 + Y inversion', () => {
    const delta = screenDeltaToWorldDelta(40, -30, TRANSFORM);
    expect(delta).toEqual({ dx: 40, dy: 30 });
  });

  test('screenDeltaToWorldDelta — scale=2 halves the delta', () => {
    const delta = screenDeltaToWorldDelta(40, 20, { ...TRANSFORM, scale: 2 });
    expect(delta).toEqual({ dx: 20, dy: -10 });
  });

  test('screenDeltaToWorldDelta — scale=0 returns null offset', () => {
    const delta = screenDeltaToWorldDelta(40, 20, { ...TRANSFORM, scale: 0 });
    expect(delta).toEqual(NULL_OFFSET);
  });

  test('isOffsetSignificant — zero offset → false', () => {
    expect(isOffsetSignificant({ dx: 0, dy: 0 })).toBe(false);
  });

  test('isOffsetSignificant — sub-mm offset → false', () => {
    expect(isOffsetSignificant({ dx: 0.5, dy: 0.5 })).toBe(false);
  });

  test('isOffsetSignificant — supra-threshold → true', () => {
    expect(isOffsetSignificant({ dx: 10, dy: 0 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hitTestTag
// ---------------------------------------------------------------------------

describe('hitTestTag', () => {
  beforeEach(() => {
    (CoordinateTransforms.worldToScreen as jest.Mock).mockClear();
    (CoordinateTransforms.worldToScreen as jest.Mock).mockImplementation(
      (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
    );
  });

  test('returns hit when click within pill bounds', () => {
    const o = makeOpening('o1', { x: 400, y: 300 });
    const hit = hitTestTag({
      openings: [o],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 400,
      clientY: 300,
    });
    expect(hit?.opening.id).toBe('o1');
  });

  test('returns null when click outside pill bounds', () => {
    const o = makeOpening('o1', { x: 400, y: 300 });
    const hit = hitTestTag({
      openings: [o],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 400 + TAG_HIT_HALF_WIDTH_PX + 5,
      clientY: 300 + TAG_HIT_HALF_HEIGHT_PX + 5,
    });
    expect(hit).toBeNull();
  });

  test('respects tagVisible=false (skipped)', () => {
    const o = makeOpening('o1', { x: 400, y: 300 }, { tagVisible: false });
    const hit = hitTestTag({
      openings: [o],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 400,
      clientY: 300,
    });
    expect(hit).toBeNull();
  });

  test('skips openings without mark', () => {
    const o = makeOpening('o1', { x: 400, y: 300 }, { mark: undefined });
    const hit = hitTestTag({
      openings: [o],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 400,
      clientY: 300,
    });
    expect(hit).toBeNull();
  });

  test('returns null when zoom below OPENING_TAG_MIN_ZOOM', () => {
    const o = makeOpening('o1', { x: 400, y: 300 });
    const hit = hitTestTag({
      openings: [o],
      transform: { ...TRANSFORM, scale: 0.3 },
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 400,
      clientY: 300,
    });
    expect(hit).toBeNull();
  });

  test('z-order — last opening wins when overlapping', () => {
    const a = makeOpening('first', { x: 400, y: 300 });
    const b = makeOpening('last', { x: 400, y: 300 });
    const hit = hitTestTag({
      openings: [a, b],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 400,
      clientY: 300,
    });
    expect(hit?.opening.id).toBe('last');
  });

  test('subtracts canvasRect offset from client coordinates', () => {
    const o = makeOpening('o1', { x: 400, y: 300 });
    const hit = hitTestTag({
      openings: [o],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: { left: 100, top: 50 },
      clientX: 500, // 500 - 100 = 400 (matches center)
      clientY: 350, // 350 - 50  = 300 (matches center)
    });
    expect(hit?.opening.id).toBe('o1');
  });

  test('hit returns existing offset as startOffset', () => {
    const o = makeOpening('o1', { x: 400, y: 300 }, { tagOffset: { dx: 25, dy: -15 } });
    const hit = hitTestTag({
      openings: [o],
      transform: TRANSFORM,
      viewport: VIEWPORT,
      canvasRect: CANVAS_RECT,
      clientX: 425, // hit at offset world center (400+25, 300+(-15)=285)
      clientY: 285,
    });
    expect(hit?.startOffset).toEqual({ dx: 25, dy: -15 });
  });
});

// ---------------------------------------------------------------------------
// FSM transitions
// ---------------------------------------------------------------------------

describe('OpeningTagDragController FSM', () => {
  function makeHit(): TagHitResult {
    return {
      opening: makeOpening('o1', { x: 100, y: 100 }, { tagOffset: { dx: 20, dy: 10 } }),
      startOffset: { dx: 20, dy: 10 },
    };
  }

  test('initial state = idle', () => {
    const c = new OpeningTagDragController();
    expect(c.getState()).toBe('idle');
    expect(c.getActiveOpeningId()).toBeNull();
  });

  test('startDrag → state=dragging + emits onDragStart', () => {
    const c = new OpeningTagDragController();
    const onDragStart = jest.fn();
    c.startDrag(makeHit(), 200, 200, { onDragStart });
    expect(c.getState()).toBe('dragging');
    expect(c.getActiveOpeningId()).toBe('o1');
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  test('updateDrag — accumulates delta on top of startOffset', () => {
    const c = new OpeningTagDragController();
    c.startDrag(makeHit(), 200, 200);
    const onDragMove = jest.fn();
    const offset = c.updateDrag(250, 180, TRANSFORM, { onDragMove });
    // delta px = (+50, -20) → world (+50, +20) → final (20+50, 10+20) = (70, 30)
    expect(offset).toEqual({ dx: 70, dy: 30 });
    expect(onDragMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }), { dx: 70, dy: 30 });
  });

  test('updateDrag — no-op when idle', () => {
    const c = new OpeningTagDragController();
    const offset = c.updateDrag(100, 100, TRANSFORM);
    expect(offset).toBeNull();
  });

  test('endDrag — commits final offset + returns to idle', () => {
    const c = new OpeningTagDragController();
    c.startDrag(makeHit(), 200, 200);
    const onDragEnd = jest.fn();
    const result = c.endDrag(250, 180, TRANSFORM, { onDragEnd });
    expect(result?.offset).toEqual({ dx: 70, dy: 30 });
    expect(c.getState()).toBe('idle');
    expect(c.getActiveOpeningId()).toBeNull();
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  test('endDrag — no-op when idle', () => {
    const c = new OpeningTagDragController();
    const result = c.endDrag(100, 100, TRANSFORM);
    expect(result).toBeNull();
  });

  test('cancelDrag — emits onDragCancel with startOffset + returns to idle', () => {
    const c = new OpeningTagDragController();
    c.startDrag(makeHit(), 200, 200);
    const onDragCancel = jest.fn();
    c.cancelDrag({ onDragCancel });
    expect(onDragCancel).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }), { dx: 20, dy: 10 });
    expect(c.getState()).toBe('idle');
  });

  test('cancelDrag — no-op when idle', () => {
    const c = new OpeningTagDragController();
    const onDragCancel = jest.fn();
    c.cancelDrag({ onDragCancel });
    expect(onDragCancel).not.toHaveBeenCalled();
  });

  test('scale=2 halves screen delta when projecting to world', () => {
    const c = new OpeningTagDragController();
    c.startDrag(
      { opening: makeOpening('o1', { x: 100, y: 100 }), startOffset: NULL_OFFSET },
      200,
      200,
    );
    const offset = c.updateDrag(240, 200, { ...TRANSFORM, scale: 2 });
    // delta px = (+40, 0) → world (+20, 0)
    expect(offset).toEqual({ dx: 20, dy: 0 });
  });

  test('two consecutive drags do not leak state', () => {
    const c = new OpeningTagDragController();
    c.startDrag(makeHit(), 200, 200);
    c.endDrag(250, 200, TRANSFORM);
    const hit2: TagHitResult = {
      opening: makeOpening('o2', { x: 500, y: 500 }),
      startOffset: NULL_OFFSET,
    };
    c.startDrag(hit2, 600, 600);
    const offset = c.updateDrag(700, 600, TRANSFORM);
    // Should reset: start offset (0,0) + delta (+100,0) → world (+100,0)
    expect(offset).toEqual({ dx: 100, dy: 0 });
    expect(c.getActiveOpeningId()).toBe('o2');
  });
});
