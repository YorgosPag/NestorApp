/**
 * ADR-530 / ADR-557 Φάση C — TextRenderer.paintText delegation unit tests.
 *
 * The glyph-vs-CSS paint DECISION now lives in the shared SSoT `paintTextRun`
 * (`text-engine/fonts/glyph-run-draw.ts`, covered by glyph-run-draw.test.ts) — the SAME
 * routine the 3D textured-plane converter uses. Here we verify only that `paintText`
 * FORWARDS to that SSoT with the correct run params (origin / height / align / baseline /
 * resolved / tracking). The font modules are mocked so no real TTF is loaded in the suite.
 */

import type { ResolvedFont } from '../../../text-engine/fonts';
import { paintTextRun } from '../../../text-engine/fonts';

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
  paintTextRun: jest.fn(() => 60),
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
  } as unknown as CanvasRenderingContext2D;
}

const resolved: ResolvedFont = { font: {} as never, cacheName: 'Liberation Sans' };

describe('TextRenderer.paintText → shared paintTextRun SSoT (ADR-557 Φάση C)', () => {
  beforeEach(() => (paintTextRun as jest.Mock).mockClear());

  it('forwards the run params (resolved font + tracking) to paintTextRun', () => {
    const ctx = makeCtx();
    const width = (new TextRenderer(ctx) as unknown as {
      paintText: (...a: unknown[]) => number;
    }).paintText(5, 7, 'AB', 100, 'center', 'middle', resolved, 2);

    expect(paintTextRun).toHaveBeenCalledWith(ctx, 'AB', {
      originX: 5, originY: 7, targetHeight: 100, align: 'center', baseline: 'middle', resolved, tracking: 2,
    });
    expect(width).toBe(60); // returns the SSoT's advance width
  });

  it('forwards a null font (CSS fallback tier) unchanged, tracking defaults to 1', () => {
    const ctx = makeCtx();
    (new TextRenderer(ctx) as unknown as {
      paintText: (...a: unknown[]) => number;
    }).paintText(0, 0, 'A', 50, 'left', 'top', null);

    expect(paintTextRun).toHaveBeenCalledWith(ctx, 'A', {
      originX: 0, originY: 0, targetHeight: 50, align: 'left', baseline: 'top', resolved: null, tracking: 1,
    });
  });
});
