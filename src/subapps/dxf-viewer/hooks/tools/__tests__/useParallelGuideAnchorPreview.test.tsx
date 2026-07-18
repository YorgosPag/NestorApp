/**
 * useParallelGuideAnchorPreview — ADR-189 §3.13 dynamic anchor→cursor rubber band.
 *
 * Mockάρει το `useCanvasGhostPreview` harness για να αιχμαλωτίσει το config
 * (isActive/draw) και καλεί το `draw` delegate χειροκίνητα με ένα fake
 * `GhostDrawFrame`. Οι painters (`drawMoveBasePointMarker`, `drawRubberBandLine`,
 * `paintTooltip`) mockάρονται με jest.fn — είναι ΚΟΙΝΟΣ ΚΩΔΙΚΑΣ με το `useMovePreview`
 * / το Object Snap Tracking, άρα ΔΕΝ ξαναγράφουμε εδώ χρώματα/dash/font values που
 * είναι ήδη κλειδωμένα στα δικά τους tests.
 *
 * Το `guide-parallel-cursor` ΔΕΝ mockάρεται: είναι καθαρή συνάρτηση και ο σκοπός των
 * tests είναι ακριβώς να αποδείξουν ότι η γραμμή τελειώνει στο ΠΕΡΙΟΡΙΣΜΕΝΟ σημείο.
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderHook } from '@testing-library/react';
import { useParallelGuideAnchorPreview } from '../useParallelGuideAnchorPreview';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { GhostDrawFrame } from '../../../systems/preview/ghost-preview-frame';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';
import type { Guide } from '../../../systems/guides/guide-types';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import { immediateSceneScale } from '../../../systems/cursor/ImmediateSceneScaleStore';

jest.mock('../useCanvasGhostPreview', () => ({ useCanvasGhostPreview: jest.fn() }));
jest.mock('../../../rendering/ui/move-base-point-marker', () => ({
  drawMoveBasePointMarker: jest.fn(),
}));
jest.mock('../../../canvas-v2/preview-canvas/rubber-band-paint', () => ({
  drawRubberBandLine: jest.fn(),
}));
jest.mock('../../../canvas-v2/preview-canvas/tracking-paint', () => ({
  paintTooltip: jest.fn(),
}));

import { useCanvasGhostPreview } from '../useCanvasGhostPreview';
import { drawMoveBasePointMarker } from '../../../rendering/ui/move-base-point-marker';
import { drawRubberBandLine } from '../../../canvas-v2/preview-canvas/rubber-band-paint';
import { paintTooltip } from '../../../canvas-v2/preview-canvas/tracking-paint';

const mockHarness = useCanvasGhostPreview as jest.Mock;
const mockMarker = drawMoveBasePointMarker as jest.Mock;
const mockBand = drawRubberBandLine as jest.Mock;
const mockTooltip = paintTooltip as jest.Mock;

const TRANSFORM: ViewTransform = { scale: 2, offsetX: 10, offsetY: 20 };
const VIEWPORT = { width: 800, height: 600 };

/** Οδηγός άξονα Y στο x = 0 → η κάθετός του είναι ο παγκόσμιος οριζόντιος άξονας. */
const GUIDE_Y: Guide = {
  id: 'guide-test-y', axis: 'Y', offset: 0, visible: true,
} as Guide;

function lastConfig(): { isActive: boolean; useImmediateSnap?: boolean; draw: (f: GhostDrawFrame) => void } {
  return mockHarness.mock.calls.at(-1)![0];
}

function makeFrame(ctx: CanvasRenderingContext2D, effectiveCursor: Point2D | null): GhostDrawFrame {
  return { ctx, effectiveCursor, viewport: VIEWPORT, transform: TRANSFORM };
}

/** Το τελευταίο ΣΗΜΕΙΟ-ΑΚΡΟ (world) που πήρε η διακεκομμένη, από-προβεβλημένο για σύγκριση. */
function expectBandTip(tip: Point2D): void {
  expect(mockBand).toHaveBeenCalledWith(
    expect.anything(),
    CoordinateTransforms.worldToScreen({ x: 5, y: 7 }, TRANSFORM, VIEWPORT),
    CoordinateTransforms.worldToScreen(tip, TRANSFORM, VIEWPORT),
  );
}

beforeEach(() => {
  mockHarness.mockClear();
  mockMarker.mockClear();
  mockBand.mockClear();
  mockTooltip.mockClear();
  cadToggleState.set(false, false);
  cadToggleState.setSnap(false, 0);
  cadToggleState.setDimHud(true);
  immediateSceneScale.set(1);
});

afterEach(() => {
  cadToggleState.set(false, false);
  cadToggleState.setSnap(false, 0);
  cadToggleState.setDimHud(true);
  immediateSceneScale.set(1);
});

describe('useParallelGuideAnchorPreview', () => {
  it('anchor === null → isActive false, draw is a no-op (καμία πινελιά)', () => {
    renderHook(() =>
      useParallelGuideAnchorPreview({
        anchor: null, refGuide: GUIDE_Y, transform: TRANSFORM, getCanvas: () => null,
      }),
    );

    expect(lastConfig().isActive).toBe(false);

    const ctx = {} as CanvasRenderingContext2D;
    lastConfig().draw(makeFrame(ctx, { x: 1, y: 1 }));

    expect(mockMarker).not.toHaveBeenCalled();
    expect(mockBand).not.toHaveBeenCalled();
    expect(mockTooltip).not.toHaveBeenCalled();
  });

  it('anchor ορισμένο, effectiveCursor null → το ＋ ζωγραφίζεται, η διακεκομμένη ΟΧΙ', () => {
    const anchor: Point2D = { x: 5, y: 7 };
    renderHook(() =>
      useParallelGuideAnchorPreview({
        anchor, refGuide: GUIDE_Y, transform: TRANSFORM, getCanvas: () => null,
      }),
    );

    expect(lastConfig().isActive).toBe(true);

    const ctx = {} as CanvasRenderingContext2D;
    lastConfig().draw(makeFrame(ctx, null));

    // Το ＋ ΠΡΕΠΕΙ να επιβιώνει σε frames χωρίς κέρσορα (guide-click-handlers.ts §comment:
    // αλλιώς τρεμοπαίζει) — καθρεφτίζει useMovePreview :113 πριν το gate του :115.
    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith(ctx, anchor, TRANSFORM, VIEWPORT);
    expect(mockBand).not.toHaveBeenCalled();
    expect(mockTooltip).not.toHaveBeenCalled();
  });

  it('anchor + effectiveCursor ορισμένα → πρώτα ο marker, μετά η διακεκομμένη, με screen-projected σημεία', () => {
    const anchor: Point2D = { x: 5, y: 7 };
    const cursor: Point2D = { x: 40, y: 60 };
    renderHook(() =>
      useParallelGuideAnchorPreview({
        anchor, refGuide: null, transform: TRANSFORM, getCanvas: () => null,
      }),
    );

    const order: string[] = [];
    mockMarker.mockImplementation(() => order.push('marker'));
    mockBand.mockImplementation(() => order.push('band'));

    const ctx = {} as CanvasRenderingContext2D;
    lastConfig().draw(makeFrame(ctx, cursor));

    expect(order).toEqual(['marker', 'band']); // draw order pinned

    // Ο marker παίρνει WORLD συντεταγμένες (ίδιο call site με useMovePreview :113).
    expect(mockMarker).toHaveBeenCalledWith(ctx, anchor, TRANSFORM, VIEWPORT);

    // Χωρίς refGuide δεν υπάρχει περιορισμός → ωμός κέρσορας, ΧΩΡΙΣ HUD (καμία resolution).
    expectBandTip(cursor);
    expect(mockTooltip).not.toHaveBeenCalled();
  });

  it('ΔΕΝ ενεργοποιεί useImmediateSnap — ο περιορισμός ζει στο resolveParallelCursor', () => {
    renderHook(() =>
      useParallelGuideAnchorPreview({
        anchor: { x: 1, y: 1 }, refGuide: GUIDE_Y, transform: TRANSFORM, getCanvas: () => null,
      }),
    );

    expect(lastConfig().useImmediateSnap).not.toBe(true);
  });
});

describe('ΟΡΘΟ + ΒΗΜΑ — η γραμμή τελειώνει στο ΠΕΡΙΟΡΙΣΜΕΝΟ σημείο (preview ≡ commit)', () => {
  const anchor: Point2D = { x: 5, y: 7 };

  function drawWith(cursor: Point2D): void {
    renderHook(() =>
      useParallelGuideAnchorPreview({
        anchor, refGuide: GUIDE_Y, transform: TRANSFORM, getCanvas: () => null,
      }),
    );
    lastConfig().draw(makeFrame({} as CanvasRenderingContext2D, cursor));
  }

  it('ΟΡΘΟ ON σε οδηγό άξονα Y → η γραμμή κλειδώνει στην κάθετό του (παγκόσμιο οριζόντιο)', () => {
    cadToggleState.set(true, false);
    drawWith({ x: 40, y: 60 });
    // Κάθετος του Y-οδηγού = (0,1)… ο οδηγός είναι κατακόρυφη γραμμή x=offset, άρα η
    // κάθετή του κινεί ΜΟΝΟ το y του anchor· το x μένει καρφωμένο.
    expectBandTip({ x: 5, y: 60 });
  });

  it('ΒΗΜΑ (F9) ON → το άκρο κβαντίζεται· ίδιο σημείο θα δεσμεύσει και το commit', () => {
    cadToggleState.set(true, false);
    cadToggleState.setSnap(true, 10); // 10 mm, σκηνή mm (scale 1) → βήμα 10 scene units
    drawWith({ x: 40, y: 7 + 23 });
    // t = 23 κατά μήκος της καθέτου → κβαντίζεται στο 20 → y = 7 + 20.
    expectBandTip({ x: 5, y: 27 });
  });

  it('ΟΡΘΟ OFF → ελεύθερος κέρσορας (καμία προβολή)', () => {
    drawWith({ x: 40, y: 60 });
    expectBandTip({ x: 40, y: 60 });
  });
});

describe('ΛΕΥΚΟ HUD ΜΗΚΟΥΣ — κοινός painter + πύλη ΜΗΚΟΣ/ΓΩΝΙΑ', () => {
  const anchor: Point2D = { x: 5, y: 7 };

  function drawWith(cursor: Point2D): void {
    renderHook(() =>
      useParallelGuideAnchorPreview({
        anchor, refGuide: GUIDE_Y, transform: TRANSFORM, getCanvas: () => null,
      }),
    );
    lastConfig().draw(makeFrame({} as CanvasRenderingContext2D, cursor));
  }

  it('δείχνει το ΜΗΚΟΣ ΤΗΣ ΓΡΑΜΜΗΣ, αγκυρωμένο στο ΠΕΡΙΟΡΙΣΜΕΝΟ άκρο', () => {
    cadToggleState.set(true, false);
    drawWith({ x: 40, y: 7 + 30 });

    expect(mockTooltip).toHaveBeenCalledTimes(1);
    const [, point, label] = mockTooltip.mock.calls[0];
    // Αγκύρωση στο άκρο της διακεκομμένης (όχι στον ωμό κέρσορα).
    expect(point).toEqual({ x: 5, y: 37 });
    // Το νούμερο = |point − anchor| = 30 (ΟΧΙ η κάθετη απόσταση από τον οδηγό, που είναι 5).
    expect(label).toContain('30');
  });

  it('ΟΡΘΟ OFF σε ελεύθερη θέση → το HUD δείχνει ΜΗΚΟΣ ΓΡΑΜΜΗΣ, όχι κάθετη απόσταση', () => {
    // 3-4-5: anchor (5,7) → cursor (5+3, 7+4) ⇒ μήκος 5, κάθετη απόσταση από x=0 είναι 8.
    drawWith({ x: 8, y: 11 });

    const [, , label] = mockTooltip.mock.calls[0];
    expect(label).toContain('5');
    expect(label).not.toContain('8');
  });

  it('πύλη «ΜΗΚΟΣ/ΓΩΝΙΑ» OFF → η γραμμή μένει, το νούμερο εξαφανίζεται', () => {
    cadToggleState.setDimHud(false);
    drawWith({ x: 40, y: 60 });

    expect(mockBand).toHaveBeenCalledTimes(1);
    expect(mockTooltip).not.toHaveBeenCalled();
  });
});

describe('anti-drift guard — οπτική ταυτότητα ΜΟΝΟ μέσω κοινού κώδικα', () => {
  it('το source του hook (χωρίς σχόλια) δεν περιέχει hex χρώμα, setLineDash, lineWidth ή font', () => {
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
    // ΝΕΟ: το λευκό HUD περνά από τον κοινό `paintTooltip` — καμία δική μας γραμματοσειρά.
    expect(withoutComments).not.toMatch(/ctx\.font/);
    expect(withoutComments).not.toMatch(/fillText/);
  });
});
