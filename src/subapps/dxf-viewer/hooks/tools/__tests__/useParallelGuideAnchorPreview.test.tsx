/**
 * useParallelGuideAnchorPreview — ADR-189 §3.13 dynamic anchor→cursor rubber band.
 *
 * Mockάρει το `useCanvasGhostPreview` harness για να αιχμαλωτίσει το config
 * (isActive/draw) και καλεί το `draw` delegate χειροκίνητα με ένα fake
 * `GhostDrawFrame`. Οι δύο painters (`drawMoveBasePointMarker`,
 * `drawRubberBandLine`) mockάρονται με jest.fn — το ίδιο ΚΟΙΝΟ ΚΩΔΙΚΑ με το
 * `useMovePreview`, άρα ΔΕΝ ξαναγράφουμε εδώ τα χρώματα/dash values που είναι
 * ήδη κλειδωμένα στο `rendering/ui/__tests__/move-base-point-marker.test.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderHook } from '@testing-library/react';
import { useParallelGuideAnchorPreview } from '../useParallelGuideAnchorPreview';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { GhostDrawFrame } from '../../../systems/preview/ghost-preview-frame';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';

jest.mock('../useCanvasGhostPreview', () => ({ useCanvasGhostPreview: jest.fn() }));
jest.mock('../../../rendering/ui/move-base-point-marker', () => ({
  drawMoveBasePointMarker: jest.fn(),
}));
jest.mock('../../../canvas-v2/preview-canvas/rubber-band-paint', () => ({
  drawRubberBandLine: jest.fn(),
}));

import { useCanvasGhostPreview } from '../useCanvasGhostPreview';
import { drawMoveBasePointMarker } from '../../../rendering/ui/move-base-point-marker';
import { drawRubberBandLine } from '../../../canvas-v2/preview-canvas/rubber-band-paint';

const mockHarness = useCanvasGhostPreview as jest.Mock;
const mockMarker = drawMoveBasePointMarker as jest.Mock;
const mockBand = drawRubberBandLine as jest.Mock;

const TRANSFORM: ViewTransform = { scale: 2, offsetX: 10, offsetY: 20 };
const VIEWPORT = { width: 800, height: 600 };

function lastConfig(): { isActive: boolean; useImmediateSnap?: boolean; draw: (f: GhostDrawFrame) => void } {
  return mockHarness.mock.calls.at(-1)![0];
}

function makeFrame(ctx: CanvasRenderingContext2D, effectiveCursor: Point2D | null): GhostDrawFrame {
  return { ctx, effectiveCursor, viewport: VIEWPORT, transform: TRANSFORM };
}

beforeEach(() => {
  mockHarness.mockClear();
  mockMarker.mockClear();
  mockBand.mockClear();
});

describe('useParallelGuideAnchorPreview', () => {
  it('anchor === null → isActive false, draw is a no-op (καμία πινελιά)', () => {
    renderHook(() =>
      useParallelGuideAnchorPreview({ anchor: null, transform: TRANSFORM, getCanvas: () => null }),
    );

    expect(lastConfig().isActive).toBe(false);

    const ctx = {} as CanvasRenderingContext2D;
    lastConfig().draw(makeFrame(ctx, { x: 1, y: 1 }));

    expect(mockMarker).not.toHaveBeenCalled();
    expect(mockBand).not.toHaveBeenCalled();
  });

  it('anchor ορισμένο, effectiveCursor null → το ＋ ζωγραφίζεται, η διακεκομμένη ΟΧΙ', () => {
    const anchor: Point2D = { x: 5, y: 7 };
    renderHook(() =>
      useParallelGuideAnchorPreview({ anchor, transform: TRANSFORM, getCanvas: () => null }),
    );

    expect(lastConfig().isActive).toBe(true);

    const ctx = {} as CanvasRenderingContext2D;
    lastConfig().draw(makeFrame(ctx, null));

    // Το ＋ ΠΡΕΠΕΙ να επιβιώνει σε frames χωρίς κέρσορα (guide-click-handlers.ts §comment:
    // αλλιώς τρεμοπαίζει) — καθρεφτίζει useMovePreview :113 πριν το gate του :115.
    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith(ctx, anchor, TRANSFORM, VIEWPORT);
    expect(mockBand).not.toHaveBeenCalled();
  });

  it('anchor + effectiveCursor ορισμένα → πρώτα ο marker, μετά η διακεκομμένη, με screen-projected σημεία', () => {
    const anchor: Point2D = { x: 5, y: 7 };
    const cursor: Point2D = { x: 40, y: 60 };
    renderHook(() =>
      useParallelGuideAnchorPreview({ anchor, transform: TRANSFORM, getCanvas: () => null }),
    );

    const order: string[] = [];
    mockMarker.mockImplementation(() => order.push('marker'));
    mockBand.mockImplementation(() => order.push('band'));

    const ctx = {} as CanvasRenderingContext2D;
    lastConfig().draw(makeFrame(ctx, cursor));

    expect(order).toEqual(['marker', 'band']); // draw order pinned

    // Ο marker παίρνει WORLD συντεταγμένες (ίδιο call site με useMovePreview :113).
    expect(mockMarker).toHaveBeenCalledWith(ctx, anchor, TRANSFORM, VIEWPORT);

    // Η διακεκομμένη παίρνει SCREEN-projected σημεία (anchor + cursor, προβεβλημένα).
    const expectedAnchorScreen = CoordinateTransforms.worldToScreen(anchor, TRANSFORM, VIEWPORT);
    const expectedCursorScreen = CoordinateTransforms.worldToScreen(cursor, TRANSFORM, VIEWPORT);
    expect(mockBand).toHaveBeenCalledWith(ctx, expectedAnchorScreen, expectedCursorScreen);
  });

  it('ΔΕΝ ενεργοποιεί useImmediateSnap — ο sign resolver του commit διαβάζει τον ΩΜΟ κέρσορα', () => {
    renderHook(() =>
      useParallelGuideAnchorPreview({ anchor: { x: 1, y: 1 }, transform: TRANSFORM, getCanvas: () => null }),
    );

    expect(lastConfig().useImmediateSnap).not.toBe(true);
  });
});

describe('anti-drift guard — οπτική ταυτότητα με το Move ΜΟΝΟ μέσω κοινού κώδικα', () => {
  it('το source του hook (χωρίς σχόλια) δεν περιέχει hex χρώμα, setLineDash, ή lineWidth', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../useParallelGuideAnchorPreview.ts'),
      'utf8',
    );

    // Το ίδιο το header comment ΑΝΑΦΕΡΕΙ `setLineDash`/`lineWidth` σαν ΠΑΡΑΔΕΙΓΜΑ του τι
    // απαγορεύεται (τεκμηρίωση του κανόνα) — αφαιρούμε τα σχόλια ΠΡΙΝ το match, ώστε ο
    // φρουρός να ελέγχει πραγματικό ΚΩΔΙΚΑ, όχι πεζά που εξηγούν τον κανόνα.
    const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const withoutComments = withoutBlockComments.replace(/\/\/.*$/gm, '');

    expect(withoutComments).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(withoutComments).not.toMatch(/setLineDash/);
    expect(withoutComments).not.toMatch(/lineWidth/);
  });
});
