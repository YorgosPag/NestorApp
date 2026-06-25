/**
 * ADR-530 — TextRenderer glyph-paint branch unit tests.
 *
 * Verifies the paint decision: fill a cached glyph Path2D when a CAD font
 * resolves, else fall back to the legacy CSS ctx.fillText (zero regression).
 * The font modules are mocked so no real TTF is loaded in the suite.
 */

import type { ResolvedFont } from '../../../text-engine/fonts';

// Firebase auth chain reaches BaseEntityRenderer via PhaseManager → GripProvider
// → user-settings → firestore. Stub it before any imports execute so the test
// env doesn't need fetch / real firebase init. (Mirror DimensionRenderer.test.ts.)
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

jest.mock('../../../text-engine/fonts', () => ({
  resolveEntityFont: jest.fn(() => null),
  getGlyphRun: jest.fn(() => ({
    path: new Path2D(),
    metrics: { width: 60, ascent: 80, descent: 20 },
  })),
  GLYPH_REFERENCE_SIZE: 100,
}));

import { TextRenderer } from '../TextRenderer';

function makeCtx() {
  return {
    fill: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 42 })),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    canvas: {
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
      width: 800,
      height: 600,
    },
  } as unknown as CanvasRenderingContext2D & {
    fill: jest.Mock; fillText: jest.Mock; scale: jest.Mock; translate: jest.Mock;
  };
}

const resolved: ResolvedFont = { font: {} as never, cacheName: 'Liberation Sans' };

describe('TextRenderer glyph paint (ADR-530)', () => {
  it('fills a scaled glyph path when a font resolves', () => {
    const ctx = makeCtx();
    const renderer = new TextRenderer(ctx);

    // screenHeight 100 → scale 1 → widthPx = metrics.width (60).
    const width = (renderer as unknown as {
      paintText: (...a: unknown[]) => number;
    }).paintText(0, 0, 'A', 100, 'left', 'top', resolved);

    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.scale).toHaveBeenCalledWith(1, 1);
    expect(width).toBe(60);
  });

  it('falls back to ctx.fillText when no font resolves', () => {
    const ctx = makeCtx();
    const renderer = new TextRenderer(ctx);

    const width = (renderer as unknown as {
      paintText: (...a: unknown[]) => number;
    }).paintText(5, 7, 'A', 100, 'left', 'top', null);

    expect(ctx.fillText).toHaveBeenCalledWith('A', 5, 7);
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(width).toBe(42);
  });
});
