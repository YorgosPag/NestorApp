/**
 * ADR-189 §3.13 — «Παράλληλος οδηγός»: COMMIT ΜΕ ΔΕΥΤΕΡΟ ΚΛΙΚ.
 *
 * Οδηγεί τον ΠΡΑΓΜΑΤΙΚΟ `useGuideWorkflowHandlers` (καμία απομίμηση της λογικής)
 * και κλειδώνει τη σύμβαση που ενώνει ζωγραφική / HUD / Enter / κλικ:
 *
 *   1. Το κλικ-commit περνά από το ΕΝΑ SSoT `resolveParallelCursor` — άρα ΟΡΘΟ και
 *      βήμα (F9) το επηρεάζουν ακριβώς όπως επηρεάζουν τη διακεκομμένη.
 *   2. Η ΠΛΗΚΤΡΟΛΟΓΗΜΕΝΗ τιμή ΝΙΚΑ τον κέρσορα (WYSIWYG: αυτό δείχνει το φάντασμα).
 *   3. Μηδενική απόσταση ⇒ ΚΑΝΕΝΑΣ οδηγός (εκφυλισμένο), αλλά καθαρό state.
 *   4. Μετά από κάθε commit το numeric flow μηδενίζεται μέσω ΕΝΟΣ μονοπατιού
 *      (`cancel()` → `_onCancel` → `setParallelRefGuideId(null)`).
 *
 * Ο `CanvasNumericInputStore` ΔΕΝ mock-άρεται: είναι module-level store χωρίς
 * εξαρτήσεις και η αλληλεπίδρασή του με τον handler είναι ακριβώς το υπό δοκιμή.
 *
 * NOTE (repo gotcha): ΜΗΝ κάνεις `import { jest } from '@jest/globals'` — σπάει το
 * hoisting του `jest.mock`. Χρησιμοποίησε το ambient global.
 */

import { renderHook, act } from '@testing-library/react';

import { useGuideWorkflowHandlers } from '../useGuideWorkflowHandlers';
import type { UseGuideWorkflowHandlersParams } from '../useGuideWorkflowHandlers';
import { CanvasNumericInputStore } from '../../../systems/canvas-numeric-input/CanvasNumericInputStore';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import type { Guide } from '../../../systems/guides/guide-types';
import type { Point2D } from '../../../rendering/types/Types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

const GUIDE_X = makeGuide({ id: 'guide-x-1', axis: 'X', offset: 100 });
const GUIDE_Y = makeGuide({ id: 'guide-y-1', axis: 'Y', offset: 50 });
const GUIDE_XZ = makeGuide({
  id: 'guide-xz-1',
  axis: 'XZ',
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 100, y: 100 },
});

interface Harness {
  addParallelGuide: jest.Mock;
  setParallelRefGuideId: jest.Mock;
  handlers: ReturnType<typeof useGuideWorkflowHandlers>;
}

/**
 * Ελάχιστα πεδία που πραγματικά αγγίζει το parallel σκέλος (guides +
 * addParallelGuide + setParallelRefGuideId). Τα υπόλοιπα ~30 πεδία των
 * `UseGuideStateReturn` / `GuideWorkflowState` δεν καλούνται σε αυτό το μονοπάτι —
 * `as unknown as` είναι established convention του test-suite για ογκώδη params.
 */
function mount(guides: readonly Guide[]): Harness {
  const addParallelGuide = jest.fn();
  const setParallelRefGuideId = jest.fn();

  const params = {
    guideState: { guides, addParallelGuide },
    cpState: {},
    showPromptDialog: jest.fn(),
    t: (key: string) => key,
    notifyWarning: jest.fn(),
    state: { setParallelRefGuideId },
  } as unknown as UseGuideWorkflowHandlersParams;

  const { result } = renderHook(() => useGuideWorkflowHandlers(params));
  return { addParallelGuide, setParallelRefGuideId, handlers: result.current };
}

/** Πρώτο κλικ: επιλογή αναφοράς + άνοιγμα του numeric flow. */
function selectRef(h: Harness, guideId: string, anchor: Point2D): void {
  act(() => { h.handlers.handleParallelRefSelected(guideId, anchor); });
}

/** Δεύτερο κλικ: commit στη θέση `worldPoint`. */
function commitAt(h: Harness, guideId: string, worldPoint: Point2D): void {
  act(() => { h.handlers.handleParallelDistanceCommitted(guideId, worldPoint); });
}

beforeEach(() => {
  CanvasNumericInputStore.cancel();
  cadToggleState.set(false, false);
  cadToggleState.setSnap(false, 0);
});

afterAll(() => {
  CanvasNumericInputStore.cancel();
  cadToggleState.set(false, false);
  cadToggleState.setSnap(false, 0);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleParallelDistanceCommitted — commit με δεύτερο κλικ, και στους 3 άξονες', () => {
  it('άξονας X: απόσταση = |Δx| από το offset, πρόσημο = πλευρά του κλικ', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });

    commitAt(h, 'guide-x-1', { x: 160, y: 250 });

    expect(h.addParallelGuide).toHaveBeenCalledTimes(1);
    const [id, signed] = h.addParallelGuide.mock.calls[0] as [string, number];
    expect(id).toBe('guide-x-1');
    expect(signed).toBeCloseTo(60, 6);
  });

  it('άξονας X, αρνητική πλευρά: το πρόσημο ακολουθεί το κλικ', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });

    commitAt(h, 'guide-x-1', { x: 75, y: 250 });

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(-25, 6);
  });

  it('άξονας Y: απόσταση = |Δy| από το offset', () => {
    const h = mount([GUIDE_Y]);
    selectRef(h, 'guide-y-1', { x: 300, y: 50 });

    commitAt(h, 'guide-y-1', { x: 300, y: 90 });

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(40, 6);
  });

  it('διαγώνιος (XZ): απόσταση = ΚΑΘΕΤΗ, όχι ευκλείδεια από το anchor', () => {
    const h = mount([GUIDE_XZ]);
    selectRef(h, 'guide-xz-1', { x: 50, y: 50 });

    // (30,70): κάθετη απόσταση από τη διαγώνιο = 40/√2 ≈ 28.284, ενώ η
    // ευκλείδεια από το anchor είναι √(400+400) ≈ 28.284 — εδώ συμπίπτουν
    // επειδή το σημείο βρίσκεται ήδη πάνω στην κάθετο του anchor.
    commitAt(h, 'guide-xz-1', { x: 30, y: 70 });

    const [, signed] = h.addParallelGuide.mock.calls[0] as [string, number];
    expect(signed).toBeCloseTo(40 / Math.SQRT2, 6);
  });

  it('διαγώνιος (XZ): κλικ ΕΚΤΟΣ καθέτου → μετρά μόνο η κάθετη συνιστώσα', () => {
    const h = mount([GUIDE_XZ]);
    selectRef(h, 'guide-xz-1', { x: 50, y: 50 });

    // (0,40): κατά μήκος -30/√2, κάθετα +40/√2. Η ευκλείδεια από το anchor
    // (√(2500+100) ≈ 50.99) ΔΕΝ πρέπει να φτάσει στην εντολή.
    commitAt(h, 'guide-xz-1', { x: 0, y: 40 });

    const [, signed] = h.addParallelGuide.mock.calls[0] as [string, number];
    expect(signed).toBeCloseTo(40 / Math.SQRT2, 6);
  });
});

describe('handleParallelDistanceCommitted — η ΠΛΗΚΤΡΟΛΟΓΗΜΕΝΗ τιμή νικά το κλικ', () => {
  it('buffer με τιμή → μέγεθος από την πληκτρολόγηση, πλευρά από το κλικ', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });
    act(() => {
      CanvasNumericInputStore.addChar('2');
      CanvasNumericInputStore.addChar('5');
    });

    // Ο κέρσορας λέει 60 δεξιά· ο χρήστης έχει γράψει 25 — αυτό βλέπει στο φάντασμα.
    commitAt(h, 'guide-x-1', { x: 160, y: 250 });

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(25, 6);
  });

  it('η πληκτρολόγηση δίνει ΜΟΝΟ μέγεθος — η πλευρά μένει του κέρσορα', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });
    act(() => { CanvasNumericInputStore.addChar('9'); });

    commitAt(h, 'guide-x-1', { x: 20, y: 250 }); // αριστερά ⇒ πλευρά −1

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(-9, 6);
  });

  it('κενός buffer → νικά ο κέρσορας', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });

    commitAt(h, 'guide-x-1', { x: 130, y: 250 });

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(30, 6);
  });
});

describe('handleParallelDistanceCommitted — ΟΡΘΟ και ΒΗΜΑ επηρεάζουν το κλικ', () => {
  it('ΟΡΘΟ ON σε διαγώνιο: το σημείο κλειδώνει στην κάθετο ΤΟΥ ΟΔΗΓΟΥ', () => {
    cadToggleState.set(true, false);
    const h = mount([GUIDE_XZ]);
    selectRef(h, 'guide-xz-1', { x: 50, y: 50 });

    // Ελεύθερα το (0,40) έχει και κατά-μήκος συνιστώσα· με ΟΡΘΟ αυτή πετιέται,
    // αλλά η ΚΑΘΕΤΗ απόσταση παραμένει η ίδια — αυτό είναι το ζητούμενο.
    commitAt(h, 'guide-xz-1', { x: 0, y: 40 });

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(40 / Math.SQRT2, 6);
  });

  it('ΒΗΜΑ (F9) ON: η απόσταση κβαντίζεται πριν φτάσει στην εντολή', () => {
    cadToggleState.set(true, false);
    cadToggleState.setSnap(true, 10); // mmToScene = 1 στο test env ⇒ βήμα 10
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });

    commitAt(h, 'guide-x-1', { x: 163, y: 250 }); // ωμό 63 → κβάντιση στο 60

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(60, 6);
  });

  it('ΒΗΜΑ OFF: η ίδια θέση δίνει την ωμή απόσταση (η κβάντιση δεν είναι πάντα ενεργή)', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });

    commitAt(h, 'guide-x-1', { x: 163, y: 250 });

    expect(h.addParallelGuide.mock.calls[0][1]).toBeCloseTo(63, 6);
  });
});

describe('handleParallelDistanceCommitted — εκφυλισμένα + καθαρισμός state', () => {
  it('μηδενική απόσταση (κλικ πάνω στον οδηγό) → ΚΑΝΕΝΑΣ οδηγός', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });

    commitAt(h, 'guide-x-1', { x: 100, y: 400 });

    expect(h.addParallelGuide).not.toHaveBeenCalled();
  });

  it('μηδενική απόσταση → το state ΚΑΘΑΡΙΖΕΙ κανονικά (καμία παγίδα εργαλείου)', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });
    h.setParallelRefGuideId.mockClear();

    commitAt(h, 'guide-x-1', { x: 100, y: 400 });

    expect(h.setParallelRefGuideId).toHaveBeenCalledWith(null);
    expect(CanvasNumericInputStore.getAnchor()).toBeNull();
  });

  it('επιτυχές commit → anchor/refGuide/buffer μηδενίζονται, μία φορά setParallelRefGuideId(null)', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });
    act(() => { CanvasNumericInputStore.addChar('7'); });
    h.setParallelRefGuideId.mockClear();

    commitAt(h, 'guide-x-1', { x: 160, y: 250 });

    expect(h.setParallelRefGuideId).toHaveBeenCalledTimes(1);
    expect(h.setParallelRefGuideId).toHaveBeenCalledWith(null);
    expect(CanvasNumericInputStore.getAnchor()).toBeNull();
    expect(CanvasNumericInputStore.getRefGuide()).toBeNull();
    expect(CanvasNumericInputStore.getBuffer()).toBe('');
  });

  it('άγνωστο refGuideId → κανένας οδηγός, αλλά καθαρό state', () => {
    const h = mount([GUIDE_X]);
    selectRef(h, 'guide-x-1', { x: 100, y: 250 });
    h.setParallelRefGuideId.mockClear();

    commitAt(h, 'ghost-id', { x: 160, y: 250 });

    expect(h.addParallelGuide).not.toHaveBeenCalled();
    expect(h.setParallelRefGuideId).toHaveBeenCalledWith(null);
    expect(CanvasNumericInputStore.getAnchor()).toBeNull();
  });

  it('commit χωρίς προηγούμενη επιλογή αναφοράς (χαμένο anchor) → no-op, κανένα crash', () => {
    const h = mount([GUIDE_X]);

    commitAt(h, 'guide-x-1', { x: 160, y: 250 });

    expect(h.addParallelGuide).not.toHaveBeenCalled();
  });
});

describe('handleParallelRefSelected — παγώνει τον οδηγό στον numeric store', () => {
  it('το πρώτο κλικ ενεργοποιεί το numeric flow με anchor + refGuide', () => {
    const h = mount([GUIDE_XZ]);

    selectRef(h, 'guide-xz-1', { x: 50, y: 50 });

    expect(h.setParallelRefGuideId).toHaveBeenCalledWith('guide-xz-1');
    expect(CanvasNumericInputStore.getAnchor()).toEqual({ x: 50, y: 50 });
    expect(CanvasNumericInputStore.getRefGuide()?.id).toBe('guide-xz-1');
  });

  it('άγνωστος οδηγός → δεν ενεργοποιείται τίποτα (καμία παγίδα με ορφανό ref id)', () => {
    const h = mount([GUIDE_X]);

    selectRef(h, 'ghost-id', { x: 0, y: 0 });

    expect(h.setParallelRefGuideId).not.toHaveBeenCalled();
    expect(CanvasNumericInputStore.getAnchor()).toBeNull();
  });
});
