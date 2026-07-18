/**
 * guide-click-handlers — 'guide-parallel' click path (ADR-189 §3.13).
 *
 * Οδηγεί το ΠΡΑΓΜΑΤΙΚΟ `handleGuideToolClick` (activeTool 'guide-parallel') και
 * κλειδώνει το ANCHOR που φτάνει στο `onParallelRefSelected`: η ΠΡΟΒΟΛΗ του κλικ
 * πάνω στη γραμμή του οδηγού (`projectPointOntoGuide`) — ΟΧΙ το ωμό σημείο του κλικ.
 *
 * Καλύπτει επίσης τον ΚΛΑΔΟ COMMIT: όταν `parallelRefGuideId` είναι ήδη
 * επιλεγμένο, το δεύτερο κλικ ΔΕΝ ξαναδιαλέγει αναφορά — δρομολογείται στο
 * `onParallelDistanceCommitted` με τον ΩΜΟ worldPoint (η γεωμετρία ανήκει στον
 * workflow handler, όχι εδώ).
 */

import { handleGuideToolClick } from '../guide-click-handlers';
import type { GuideClickContext } from '../guide-click-handlers';
import type { UseCanvasClickHandlerParams } from '../canvas-click-types';
import type { Guide } from '../../../systems/guides/guide-types';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeGuide(overrides: Pick<Guide, 'id' | 'axis'> & Partial<Guide>): Guide {
  return {
    offset: 0,
    label: null,
    style: null,
    visible: true,
    locked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    parentId: null,
    groupId: null,
    ...overrides,
  };
}

const VERTICAL_GUIDE = makeGuide({ id: 'guide-x-1', axis: 'X', offset: 100 });
const HORIZONTAL_GUIDE = makeGuide({ id: 'guide-y-1', axis: 'Y', offset: 50 });
const DIAGONAL_GUIDE = makeGuide({
  id: 'guide-xz-1',
  axis: 'XZ',
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 100, y: 100 },
});

function makeTransform(scale = 1): ViewTransform {
  return { scale, offsetX: 0, offsetY: 0 };
}

function makeCtx(worldPoint: Point2D, transform: ViewTransform = makeTransform()): GuideClickContext {
  return {
    worldPoint,
    shiftKey: false,
    transform,
    levelManager: { currentLevelId: null, getLevelScene: () => null },
  };
}

/**
 * Ελάχιστα πεδία που πραγματικά διαβάζει το `guide-parallel` σκέλος του
 * `handleGuideToolClick` (activeTool + guide callbacks/state). Τα υπόλοιπα ~25
 * υποχρεωτικά πεδία του `UseCanvasClickHandlerParams` δεν αγγίζονται από αυτό
 * το μονοπάτι — `as unknown as` εδώ είναι established convention στο test-suite
 * αυτού του φακέλου (π.χ. dxf-scene-wall-cutback.test.ts) για ογκώδη param types.
 */
function makeParams(overrides: {
  guides?: readonly Guide[];
  onParallelRefSelected?: jest.Mock;
  onParallelDistanceCommitted?: jest.Mock;
  parallelRefGuideId?: string | null;
}): UseCanvasClickHandlerParams {
  return {
    activeTool: 'guide-parallel',
    guides: overrides.guides ?? [],
    onParallelRefSelected: overrides.onParallelRefSelected ?? jest.fn(),
    onParallelDistanceCommitted: overrides.onParallelDistanceCommitted ?? jest.fn(),
    parallelRefGuideId: overrides.parallelRefGuideId ?? null,
  } as unknown as UseCanvasClickHandlerParams;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('handleGuideToolClick — guide-parallel anchor pinning', () => {
  it('κατακόρυφος οδηγός (X, offset 100): anchor = {offset, click.y}', () => {
    const onParallelRefSelected = jest.fn();
    const params = makeParams({ guides: [VERTICAL_GUIDE], onParallelRefSelected });
    const ctx = makeCtx({ x: 103, y: 250 });

    const consumed = handleGuideToolClick(ctx, params);

    expect(consumed).toBe(true);
    expect(onParallelRefSelected).toHaveBeenCalledTimes(1);
    expect(onParallelRefSelected).toHaveBeenCalledWith('guide-x-1', { x: 100, y: 250 });
  });

  it('οριζόντιος οδηγός (Y, offset 50): anchor = {click.x, offset}', () => {
    const onParallelRefSelected = jest.fn();
    const params = makeParams({ guides: [HORIZONTAL_GUIDE], onParallelRefSelected });
    const ctx = makeCtx({ x: 300, y: 52 });

    handleGuideToolClick(ctx, params);

    expect(onParallelRefSelected).toHaveBeenCalledTimes(1);
    expect(onParallelRefSelected).toHaveBeenCalledWith('guide-y-1', { x: 300, y: 50 });
  });

  it('διαγώνιος οδηγός (XZ): anchor = κάθετη προβολή πάνω στο segment', () => {
    const onParallelRefSelected = jest.fn();
    const params = makeParams({ guides: [DIAGONAL_GUIDE], onParallelRefSelected });
    // Κλικ κοντά στη διαγώνιο (0,0)→(100,100), λίγο έξω από τη γραμμή.
    const ctx = makeCtx({ x: 52, y: 48 });

    handleGuideToolClick(ctx, params);

    expect(onParallelRefSelected).toHaveBeenCalledTimes(1);
    const [guideId, anchor] = onParallelRefSelected.mock.calls[0] as [string, Point2D];
    expect(guideId).toBe('guide-xz-1');
    // Κάθετη προβολή του (52,48) πάνω στο segment (0,0)-(100,100): t=0.5 → (50,50).
    expect(anchor.x).toBeCloseTo(50, 6);
    expect(anchor.y).toBeCloseTo(50, 6);
  });

  it('κλικ ΜΑΚΡΙΑ από κάθε οδηγό (πέρα από 30/scale) — callback ΔΕΝ καλείται', () => {
    const onParallelRefSelected = jest.fn();
    const params = makeParams({
      guides: [VERTICAL_GUIDE, HORIZONTAL_GUIDE, DIAGONAL_GUIDE],
      onParallelRefSelected,
    });
    const ctx = makeCtx({ x: 1000, y: 1000 });

    const consumed = handleGuideToolClick(ctx, params);

    expect(consumed).toBe(true); // το guide-parallel καταναλώνει πάντα το κλικ
    expect(onParallelRefSelected).not.toHaveBeenCalled();
  });

  it('μη-παλινδρόμηση: το ΠΡΩΤΟ κλικ επιλέγει αναφορά και ΔΕΝ κάνει commit', () => {
    const onParallelRefSelected = jest.fn();
    const onParallelDistanceCommitted = jest.fn();
    const params = makeParams({
      guides: [VERTICAL_GUIDE],
      onParallelRefSelected,
      onParallelDistanceCommitted,
      parallelRefGuideId: null,
    });

    handleGuideToolClick(makeCtx({ x: 103, y: 250 }), params);

    expect(onParallelRefSelected).toHaveBeenCalledTimes(1);
    expect(onParallelDistanceCommitted).not.toHaveBeenCalled();
  });
});

describe('handleGuideToolClick — guide-parallel commit by second click', () => {
  it('parallelRefGuideId ορισμένο → δρομολόγηση σε commit, ΟΧΙ σε νέα επιλογή αναφοράς', () => {
    const onParallelRefSelected = jest.fn();
    const onParallelDistanceCommitted = jest.fn();
    const params = makeParams({
      guides: [VERTICAL_GUIDE],
      onParallelRefSelected,
      onParallelDistanceCommitted,
      parallelRefGuideId: 'guide-x-1',
    });
    const ctx = makeCtx({ x: 103, y: 250 });

    const consumed = handleGuideToolClick(ctx, params);

    expect(consumed).toBe(true);
    expect(onParallelRefSelected).not.toHaveBeenCalled();
    expect(onParallelDistanceCommitted).toHaveBeenCalledTimes(1);
    expect(onParallelDistanceCommitted).toHaveBeenCalledWith('guide-x-1', { x: 103, y: 250 });
  });

  it('περνά τον ΩΜΟ worldPoint — καμία προβολή/γεωμετρία μέσα στον click handler', () => {
    const onParallelDistanceCommitted = jest.fn();
    const params = makeParams({
      guides: [DIAGONAL_GUIDE],
      onParallelDistanceCommitted,
      parallelRefGuideId: 'guide-xz-1',
    });

    handleGuideToolClick(makeCtx({ x: 52, y: 48 }), params);

    // Αν ο handler «βοηθούσε» προβάλλοντας, εδώ θα έφτανε το (50,50).
    expect(onParallelDistanceCommitted).toHaveBeenCalledWith('guide-xz-1', { x: 52, y: 48 });
  });

  it('commit ΚΑΙ μακριά από κάθε οδηγό — το κλικ δεν χρειάζεται να πέσει πάνω σε γραμμή', () => {
    const onParallelDistanceCommitted = jest.fn();
    const params = makeParams({
      guides: [VERTICAL_GUIDE],
      onParallelDistanceCommitted,
      parallelRefGuideId: 'guide-x-1',
    });

    handleGuideToolClick(makeCtx({ x: 900, y: 900 }), params);

    expect(onParallelDistanceCommitted).toHaveBeenCalledWith('guide-x-1', { x: 900, y: 900 });
  });

  it('χωρίς οδηγούς στα params το commit περνά κανονικά (ο handler δεν τους χρειάζεται)', () => {
    const onParallelDistanceCommitted = jest.fn();
    const params = makeParams({
      guides: [],
      onParallelDistanceCommitted,
      parallelRefGuideId: 'guide-x-1',
    });

    const consumed = handleGuideToolClick(makeCtx({ x: 10, y: 20 }), params);

    expect(consumed).toBe(true);
    expect(onParallelDistanceCommitted).toHaveBeenCalledTimes(1);
  });
});
