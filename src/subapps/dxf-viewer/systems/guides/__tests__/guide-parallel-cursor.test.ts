/**
 * `resolveParallelCursor` — SSoT του περιορισμένου κέρσορα στη ροή «Παράλληλος
 * οδηγός» (ADR-189 §3.13).
 *
 * Η ΚΕΝΤΡΙΚΗ ΕΓΓΥΗΣΗ που κλειδώνουν αυτά τα tests: με ΟΡΘΟ ON το `lineLength`
 * (αυτό που δείχνει το λευκό HUD) ισούται με `|signedPerpDistance|` (αυτό που
 * τοποθετεί το commit) — δηλαδή το HUD ΔΕΝ μπορεί να πει άλλο νούμερο από αυτό
 * που θα φτιάξει ο οδηγός. Επίσης ότι το `sign` βγαίνει ΠΑΝΤΑ από το ΤΕΛΙΚΟ
 * σημείο, ποτέ από τον ωμό κέρσορα.
 */

import { resolveParallelCursor, readParallelCursorToggles } from '../guide-parallel-cursor';
import { resolveParallelSide } from '../guide-parallel-side';
import type { Guide } from '../guide-types';
import type { Point2D } from '../../../rendering/types/Types';
import { cadToggleState } from '../../constraints/cad-toggle-state';
import { immediateSceneScale } from '../../cursor/ImmediateSceneScaleStore';

const SQRT1_2 = Math.SQRT1_2;

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'guide_001',
    axis: 'X',
    offset: 100,
    label: null,
    style: null,
    visible: true,
    locked: false,
    createdAt: '2026-07-18T00:00:00.000Z',
    parentId: null,
    groupId: null,
    ...overrides,
  };
}

const FREE = { ortho: false, stepSnap: false } as const;
const ORTHO = { ortho: true, stepSnap: false } as const;

/** Ο διαγώνιος οδηγός των tests: (0,0)→(10,10), κάθετη n = (−√½, √½). */
const DIAGONAL = makeGuide({
  axis: 'XZ', offset: 0, startPoint: { x: 0, y: 0 }, endPoint: { x: 10, y: 10 },
});
/** Σημείο ΠΑΝΩ στον διαγώνιο — το anchor είναι πάντα προβολή του κλικ στη γραμμή. */
const DIAGONAL_ANCHOR: Point2D = { x: 5, y: 5 };

describe('resolveParallelCursor — άξονας X (κατακόρυφος οδηγός)', () => {
  const guide = makeGuide({ axis: 'X', offset: 100 });
  const anchor: Point2D = { x: 100, y: 50 };

  it('ΟΡΘΟ OFF: το σημείο είναι ο ωμός κέρσορας', () => {
    const r = resolveParallelCursor(guide, anchor, { x: 130, y: 90 }, FREE);

    expect(r.point).toEqual({ x: 130, y: 90 });
    expect(r.signedPerpDistance).toBeCloseTo(30, 9);
    expect(r.sign).toBe(1);
    expect(r.lineLength).toBeCloseTo(Math.hypot(30, 40), 9);
  });

  it('ΟΡΘΟ ON: το σημείο προβάλλεται στην κάθετο (= παγκόσμιο οριζόντιο)', () => {
    const r = resolveParallelCursor(guide, anchor, { x: 130, y: 90 }, ORTHO);

    expect(r.point).toEqual({ x: 130, y: 50 });
    expect(r.signedPerpDistance).toBeCloseTo(30, 9);
    expect(r.lineLength).toBeCloseTo(30, 9);
  });

  it('αρνητική πλευρά: κέρσορας αριστερά του οδηγού ⇒ sign −1 και αρνητική κάθετη', () => {
    const r = resolveParallelCursor(guide, anchor, { x: 60, y: 20 }, ORTHO);

    expect(r.point).toEqual({ x: 60, y: 50 });
    expect(r.signedPerpDistance).toBeCloseTo(-40, 9);
    expect(r.sign).toBe(-1);
    expect(r.lineLength).toBeCloseTo(40, 9);
  });

  it('κέρσορας ΠΑΝΩ στον οδηγό ⇒ μηδενική απόσταση, μηδενικό μήκος', () => {
    const r = resolveParallelCursor(guide, anchor, { x: 100, y: 77 }, ORTHO);

    expect(r.signedPerpDistance).toBeCloseTo(0, 9);
    expect(r.lineLength).toBeCloseTo(0, 9);
  });
});

describe('resolveParallelCursor — άξονας Y (οριζόντιος οδηγός)', () => {
  const guide = makeGuide({ axis: 'Y', offset: 20 });
  const anchor: Point2D = { x: 5, y: 20 };

  it('ΟΡΘΟ ON: η κάθετος είναι το παγκόσμιο κατακόρυφο', () => {
    const r = resolveParallelCursor(guide, anchor, { x: 90, y: 35 }, ORTHO);

    expect(r.point).toEqual({ x: 5, y: 35 });
    expect(r.signedPerpDistance).toBeCloseTo(15, 9);
    expect(r.sign).toBe(1);
    expect(r.lineLength).toBeCloseTo(15, 9);
  });

  it('ΟΡΘΟ OFF: ωμός κέρσορας, κάθετη = διαφορά Y', () => {
    const r = resolveParallelCursor(guide, anchor, { x: 90, y: 8 }, FREE);

    expect(r.point).toEqual({ x: 90, y: 8 });
    expect(r.signedPerpDistance).toBeCloseTo(-12, 9);
    expect(r.sign).toBe(-1);
  });
});

describe('resolveParallelCursor — διαγώνιος οδηγός (XZ)', () => {
  it('ΟΡΘΟ ON: κλειδώνει στην ΠΡΑΓΜΑΤΙΚΗ κάθετο του οδηγού, ΟΧΙ σε παγκόσμιο H/V', () => {
    const r = resolveParallelCursor(DIAGONAL, DIAGONAL_ANCHOR, { x: 8, y: 0 }, ORTHO);

    // t = (3, −5) · (−√½, √½) = −4√2 ⇒ point = anchor + n·t = (9, 1)
    expect(r.point.x).toBeCloseTo(9, 9);
    expect(r.point.y).toBeCloseTo(1, 9);
    expect(r.signedPerpDistance).toBeCloseTo(-4 * Math.SQRT2, 9);
    expect(r.sign).toBe(-1);
  });

  it('ΟΡΘΟ OFF: ωμός κέρσορας, κάθετη απόσταση = προβολή στο n', () => {
    const r = resolveParallelCursor(DIAGONAL, DIAGONAL_ANCHOR, { x: 8, y: 0 }, FREE);

    expect(r.point).toEqual({ x: 8, y: 0 });
    expect(r.signedPerpDistance).toBeCloseTo(8 * -SQRT1_2 + 0 * SQRT1_2, 9);
    expect(r.sign).toBe(-1);
  });

  it('η άλλη πλευρά του διαγωνίου δίνει sign +1', () => {
    const r = resolveParallelCursor(DIAGONAL, DIAGONAL_ANCHOR, { x: 0, y: 8 }, ORTHO);

    expect(r.signedPerpDistance).toBeGreaterThan(0);
    expect(r.sign).toBe(1);
  });

  it('κέρσορας ΠΑΝΩ στον διαγώνιο ⇒ μηδενική κάθετη απόσταση', () => {
    const r = resolveParallelCursor(DIAGONAL, DIAGONAL_ANCHOR, { x: 3, y: 3 }, ORTHO);

    expect(r.signedPerpDistance).toBeCloseTo(0, 9);
    expect(r.lineLength).toBeCloseTo(0, 9);
  });
});

describe('resolveParallelCursor — εκφυλισμένος / ελλιπής διαγώνιος (ΔΕΝ πετά exception)', () => {
  it('start === end ⇒ fallback στον ωμό κέρσορα με μηδενική κάθετη', () => {
    const guide = makeGuide({
      axis: 'XZ', offset: 0, startPoint: { x: 4, y: 4 }, endPoint: { x: 4, y: 4 },
    });

    const r = resolveParallelCursor(guide, { x: 4, y: 4 }, { x: 9, y: 1 }, ORTHO);

    expect(r.point).toEqual({ x: 9, y: 1 });
    expect(r.signedPerpDistance).toBe(0);
    expect(r.lineLength).toBeCloseTo(Math.hypot(5, -3), 9);
  });

  it('XZ χωρίς άκρα ⇒ ίδιο fallback', () => {
    const guide = makeGuide({ axis: 'XZ', offset: 0 });

    const r = resolveParallelCursor(guide, { x: 0, y: 0 }, { x: 2, y: 3 }, ORTHO);

    expect(r.point).toEqual({ x: 2, y: 3 });
    expect(r.signedPerpDistance).toBe(0);
  });
});

describe('resolveParallelCursor — ΒΗΜΑ (SNAP / F9)', () => {
  it('ΟΡΘΟ ON + βήμα: κβαντίζει το ΒΑΘΜΩΤΟ ⇒ το σημείο ΜΕΝΕΙ πάνω στην κάθετο', () => {
    const r = resolveParallelCursor(
      DIAGONAL, DIAGONAL_ANCHOR, { x: 8, y: 0 },
      { ortho: true, stepSnap: true, stepSceneUnits: 2 },
    );

    // t = −4√2 ≈ −5.657 → κβαντισμένο σε −6 ⇒ point = anchor + n·(−6)
    expect(r.signedPerpDistance).toBeCloseTo(-6, 9);
    expect(r.point.x).toBeCloseTo(5 + 6 * SQRT1_2, 9);
    expect(r.point.y).toBeCloseTo(5 - 6 * SQRT1_2, 9);
    // Το σημείο παραμένει ακριβώς πάνω στην κάθετο του anchor.
    const alongGuide = (r.point.x - 5) * SQRT1_2 + (r.point.y - 5) * SQRT1_2;
    expect(alongGuide).toBeCloseTo(0, 9);
  });

  it('ΟΡΘΟ OFF + βήμα: κβαντίζει το ΜΗΚΟΣ από το anchor, διατηρώντας τη διεύθυνση', () => {
    const guide = makeGuide({ axis: 'X', offset: 0 });
    const anchor: Point2D = { x: 0, y: 0 };

    const r = resolveParallelCursor(
      guide, anchor, { x: 3, y: 4 }, // μήκος 5
      { ortho: false, stepSnap: true, stepSceneUnits: 2 },
    );

    expect(r.lineLength).toBeCloseTo(6, 9); // 5 → πλησιέστερο πολλαπλάσιο του 2
    expect(r.point.x).toBeCloseTo(3.6, 9);  // ίδια διεύθυνση (3,4)/5
    expect(r.point.y).toBeCloseTo(4.8, 9);
  });

  it('stepSnap true αλλά βήμα 0/παράλειψη ⇒ καμία κβάντιση', () => {
    const guide = makeGuide({ axis: 'X', offset: 0 });

    const zero = resolveParallelCursor(guide, { x: 0, y: 0 }, { x: 3, y: 4 },
      { ortho: false, stepSnap: true, stepSceneUnits: 0 });
    const missing = resolveParallelCursor(guide, { x: 0, y: 0 }, { x: 3, y: 4 },
      { ortho: false, stepSnap: true });

    expect(zero.point).toEqual({ x: 3, y: 4 });
    expect(missing.point).toEqual({ x: 3, y: 4 });
  });

  it('stepSnap false αγνοεί το μέγεθος βήματος (η πύλη είναι το F9)', () => {
    const guide = makeGuide({ axis: 'X', offset: 0 });

    const r = resolveParallelCursor(guide, { x: 0, y: 0 }, { x: 3, y: 4 },
      { ortho: false, stepSnap: false, stepSceneUnits: 2 });

    expect(r.point).toEqual({ x: 3, y: 4 });
  });
});

describe('ΕΓΓΥΗΣΗ WYSIWYG — με ΟΡΘΟ ON, lineLength === |signedPerpDistance|', () => {
  const cases: ReadonlyArray<{ name: string; guide: Guide; anchor: Point2D }> = [
    { name: 'X', guide: makeGuide({ axis: 'X', offset: 100 }), anchor: { x: 100, y: 50 } },
    { name: 'Y', guide: makeGuide({ axis: 'Y', offset: 20 }), anchor: { x: 5, y: 20 } },
    { name: 'XZ', guide: DIAGONAL, anchor: DIAGONAL_ANCHOR },
  ];
  const cursors: ReadonlyArray<Point2D> = [
    { x: 130, y: 90 }, { x: -40, y: 12 }, { x: 0, y: 0 }, { x: 7.5, y: -3.25 },
  ];

  for (const { name, guide, anchor } of cases) {
    for (const cursor of cursors) {
      it(`άξονας ${name}, κέρσορας (${cursor.x}, ${cursor.y}) — χωρίς βήμα`, () => {
        const r = resolveParallelCursor(guide, anchor, cursor, ORTHO);
        expect(r.lineLength).toBeCloseTo(Math.abs(r.signedPerpDistance), 9);
      });

      it(`άξονας ${name}, κέρσορας (${cursor.x}, ${cursor.y}) — ΜΕ βήμα 2`, () => {
        const r = resolveParallelCursor(guide, anchor, cursor,
          { ortho: true, stepSnap: true, stepSceneUnits: 2 });
        expect(r.lineLength).toBeCloseTo(Math.abs(r.signedPerpDistance), 9);
      });
    }
  }
});

describe('sign — βγαίνει ΠΑΝΤΑ από το ΤΕΛΙΚΟ σημείο, ποτέ από τον ωμό κέρσορα', () => {
  it('συμφωνεί με το resolveParallelSide(refGuide, r.point) σε κάθε συνδυασμό', () => {
    const guide = makeGuide({ axis: 'X', offset: 0 });
    const anchor: Point2D = { x: 0, y: 0 };
    const cursors: ReadonlyArray<Point2D> = [
      { x: 0.4, y: 5 }, { x: -0.4, y: 5 }, { x: 12, y: -3 }, { x: -12, y: -3 },
    ];

    for (const cursor of cursors) {
      const r = resolveParallelCursor(guide, anchor, cursor,
        { ortho: true, stepSnap: true, stepSceneUnits: 2 });
      expect(r.sign).toBe(resolveParallelSide(guide, r.point));
    }
  });

  it('το βήμα μπορεί να ΑΛΛΑΞΕΙ πλευρά — το sign ακολουθεί το τελικό σημείο', () => {
    const guide = makeGuide({ axis: 'X', offset: 0 });
    // Ωμός κέρσορας στα −0.4 (πλευρά −1)· βήμα 2 ⇒ κβαντίζεται στο 0 (πλευρά +1).
    const r = resolveParallelCursor(guide, { x: 0, y: 0 }, { x: -0.4, y: 3 },
      { ortho: true, stepSnap: true, stepSceneUnits: 2 });

    expect(r.point.x).toBeCloseTo(0, 9);
    expect(resolveParallelSide(guide, { x: -0.4, y: 3 })).toBe(-1);
    expect(r.sign).toBe(1);
  });
});

describe('readParallelCursorToggles — event-time ανάγνωση διακοπτών', () => {
  afterEach(() => {
    cadToggleState.set(false, false);
    cadToggleState.setSnap(false, 0);
    immediateSceneScale.set(1);
  });

  it('διαβάζει ORTHO από το F8', () => {
    cadToggleState.set(true, false);
    expect(readParallelCursorToggles().ortho).toBe(true);

    cadToggleState.set(false, false);
    expect(readParallelCursorToggles().ortho).toBe(false);
  });

  it('η πύλη του βήματος είναι ΜΟΝΟ το F9 — ΔΕΝ απαιτείται το πλήκτρο Q', () => {
    cadToggleState.setSnap(true, 50);

    // Κανένα keydown του Q δεν έγινε· το βήμα πρέπει να είναι ενεργό.
    expect(readParallelCursorToggles().stepSnap).toBe(true);
    expect(readParallelCursorToggles().stepSceneUnits).toBe(50);
  });

  it('μετατρέπει το mm βήμα σε scene units με το ζωντανό mm→scene scale', () => {
    cadToggleState.setSnap(true, 50);
    immediateSceneScale.set(0.001); // σχέδιο σε μέτρα

    expect(readParallelCursorToggles().stepSceneUnits).toBeCloseTo(0.05, 12);
  });

  it('F9 OFF ⇒ stepSnap false και μηδενικό βήμα', () => {
    cadToggleState.setSnap(false, 50);

    expect(readParallelCursorToggles().stepSnap).toBe(false);
    expect(readParallelCursorToggles().stepSceneUnits).toBe(0);
  });
});
