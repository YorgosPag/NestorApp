// Firebase auth chain reaches ImageRenderer via BaseEntityRenderer → PhaseManager →
// GripProvider → user-settings → firestore. Stub it before any imports execute
// (mirror ScaleBarRenderer.test.ts) so the test env doesn't need fetch / real firebase init.
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
 * ADR-651 Φάση Ε — ImageRenderer smoke tests.
 *
 * Verifies: type guard, contain-fit placeholder-vs-image branching (via a mocked
 * `HatchImageCache.resolve()` — deterministic, no jsdom `Image.decode()` flakiness),
 * rotation-aware corner grips, and rotation-aware fill hit-test.
 */

// Deterministic image-cache stub — the SAME reused SSoT (ADR-643 Φ1), mocked here so the
// test controls exactly when `resolve()` returns an image vs `null` (loading/error).
let mockResolvedImage: { width: number; height: number } | null = null;
jest.mock('../shared/hatch-image-cache', () => ({
  HatchImageCache: jest.fn().mockImplementation(() => ({
    resolve: () => mockResolvedImage,
  })),
}));

import type { Point2D } from '../../types/Types';
import type { ImageEntity } from '../../../types/image';
import { ImageRenderer } from '../ImageRenderer';

// ──────────────────────────────────────────────────────────────────────────────
// Mock CanvasRenderingContext2D (mirror ScaleBarRenderer.test.ts)
// ──────────────────────────────────────────────────────────────────────────────

interface MockCtxCall {
  fn: string;
  args: readonly unknown[];
}

interface MockCtx {
  calls: MockCtxCall[];
  ctx: CanvasRenderingContext2D;
}

function createMockCtx(width = 800, height = 600): MockCtx {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) =>
    (...args: unknown[]): unknown => {
      calls.push({ fn, args });
      return undefined;
    };
  const canvas = {
    width, height,
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, right: width, bottom: height }),
  };
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
    drawImage: record('drawImage'),
    transform: record('transform'),
    setLineDash: record('setLineDash'),
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    get strokeStyle() { return '#000000'; },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    get globalAlpha() { return 1; },
    set globalCompositeOperation(v: string) { calls.push({ fn: 'set:globalCompositeOperation', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set lineJoin(v: string) { calls.push({ fn: 'set:lineJoin', args: [v] }); },
    set shadowBlur(v: number) { calls.push({ fn: 'set:shadowBlur', args: [v] }); },
    set shadowColor(v: string) { calls.push({ fn: 'set:shadowColor', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(mock: MockCtx, fn: string): number {
  return mock.calls.filter((c) => c.fn === fn).length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

function makeRenderer(): { renderer: ImageRenderer; mock: MockCtx } {
  const mock = createMockCtx();
  const renderer = new ImageRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

function makeImage(overrides: Partial<ImageEntity> = {}): ImageEntity {
  return {
    id: 'img_render_test',
    type: 'image',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    url: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

beforeEach(() => {
  mockResolvedImage = null;
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ImageRenderer — render smoke', () => {
  it('draws a dashed placeholder while the image has not resolved yet', () => {
    const { renderer, mock } = makeRenderer();
    expect(() => renderer.render(makeImage())).not.toThrow();
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
    expect(countCalls(mock, 'drawImage')).toBe(0);
  });

  it('draws the resolved image contain-fit once resolved', () => {
    mockResolvedImage = { width: 200, height: 100 }; // 2:1 aspect, same as the 100x50 box
    const { renderer, mock } = makeRenderer();
    expect(() => renderer.render(makeImage())).not.toThrow();
    expect(countCalls(mock, 'drawImage')).toBe(1);
    expect(countCalls(mock, 'transform')).toBeGreaterThanOrEqual(1);
    const call = mock.calls.find((c) => c.fn === 'drawImage');
    // Contain-fit: aspect matches the box exactly → full width/height, zero offset.
    expect(call?.args).toEqual([mockResolvedImage, 0, 0, 100, 50]);
  });

  it('centers a mismatched-aspect image inside the box (contain-fit letterbox)', () => {
    mockResolvedImage = { width: 100, height: 100 }; // square image in a 100×50 box
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage());
    const call = mock.calls.find((c) => c.fn === 'drawImage');
    // fitScale = min(100/100, 50/100) = 0.5 → fitW=50, fitH=50 → centred: dx=25, dy=0.
    expect(call?.args).toEqual([mockResolvedImage, 25, 0, 50, 50]);
  });

  it('ignores non-image entities (type guard short-circuits)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render({ id: 'not_an_image', type: 'line', layerId: 'lyr_test' } as unknown as ImageEntity);
    expect(countCalls(mock, 'stroke')).toBe(0);
    expect(countCalls(mock, 'drawImage')).toBe(0);
  });
});

describe('ImageRenderer — getGrips', () => {
  // ADR-654 — ο renderer ζωγραφίζει ΑΚΡΙΒΩΣ τις λαβές που πιάνει το interaction registry
  // (κοινό `getImageGrips` SSoT): MOVE + ROTATION + 4 γωνιακές + 3 μεσοπλευρικές (E/S/W).
  it('returns the SAME 9 tagged grips as the interaction registry (move + rotation + 4 corners + 3 edges)', () => {
    const { renderer } = makeRenderer();
    const grips = renderer.getGrips(makeImage({ rotation: 30 }));
    expect(grips).toHaveLength(9);
    expect(grips.map((g) => g.gripKind?.kind)).toEqual([
      'image-move', 'image-rotation',
      'image-corner-ne', 'image-corner-nw', 'image-corner-sw', 'image-corner-se',
      'image-edge-e', 'image-edge-s', 'image-edge-w',
    ]);
    expect(grips[0].movesEntity).toBe(true);
    // ADR-654 — τα glyph shapes ΠΡΕΠΕΙ να ανατίθενται (αλλιώς move/rotation φαίνονται ως τετράγωνα):
    // move → σταυρός 4-βελών, rotation → καμπύλο βέλος, γωνίες + μεσοπλευρικές → default 'square'.
    expect(grips.map((g) => g.shape)).toEqual([
      'move', 'rotation',
      'square', 'square', 'square', 'square',
      'square', 'square', 'square',
    ]);
  });

  it('returns [] for non-image entities', () => {
    const { renderer } = makeRenderer();
    const grips = renderer.getGrips({ id: 'x', type: 'line', layerId: 'lyr_test' } as unknown as ImageEntity);
    expect(grips).toEqual([]);
  });
});

describe('ImageRenderer — hitTest (fill, rotation-aware)', () => {
  it('hits a point INSIDE the axis-aligned box', () => {
    const { renderer } = makeRenderer();
    const img = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50 });
    const inside: Point2D = { x: 50, y: 25 };
    expect(renderer.hitTest(img, inside, 0)).toBe(true);
  });

  it('misses a point OUTSIDE the axis-aligned box', () => {
    const { renderer } = makeRenderer();
    const img = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50 });
    const outside: Point2D = { x: 200, y: 200 };
    expect(renderer.hitTest(img, outside, 0)).toBe(false);
  });

  it('respects rotation: a point outside the UNROTATED box but inside the ROTATED one hits', () => {
    const { renderer } = makeRenderer();
    // 100×50 box rotated 90° CCW about (0,0): now occupies x∈[-50,0], y∈[0,100].
    const img = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50, rotation: 90 });
    const rotatedInside: Point2D = { x: -25, y: 50 };
    expect(renderer.hitTest(img, rotatedInside, 0)).toBe(true);
    const unrotatedInsideOnly: Point2D = { x: 50, y: 25 };
    expect(renderer.hitTest(img, unrotatedInsideOnly, 0)).toBe(false);
  });

  it('returns false for non-image entities', () => {
    const { renderer } = makeRenderer();
    expect(
      renderer.hitTest(
        { id: 'x', type: 'line', layerId: 'lyr_test' } as unknown as ImageEntity,
        { x: 0, y: 0 },
        5,
      ),
    ).toBe(false);
  });
});
