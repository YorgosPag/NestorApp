/**
 * ⚓ ADR-929 Φ5.3β — η επεξεργασία της όψης: 8 λαβές, αναποδογύρισμα, όρια εικόνας/crop, ακέραια pixel (ασφάλεια προς
 * τα έξω), κόψιμο/σβήσιμο περιοχών όταν μικραίνει το crop, όριο του συμβολαίου.
 */

import type { AlignedRectPx } from '../alignment/plan-alignment-types';
import { PLAN_READING_MAX_REDACTIONS, planReadingRequestSchema } from '../reading/plan-reading-contract';
import { assertReadingView, type PlanReadingView } from '../reading/plan-reading-view';
import {
  addRedaction,
  moveRect,
  READING_VIEW_MIN_SIDE_PX,
  readingViewKey,
  RECT_HANDLES,
  removeRedaction,
  resizeRect,
  setCrop,
  setRedaction,
} from '../reading/plan-reading-view-edit';

const SIZE = { width: 1000, height: 800 };
const IMAGE: AlignedRectPx = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
const R: AlignedRectPx = { minX: 100, minY: 100, maxX: 300, maxY: 200 };
const VIEW: PlanReadingView = { crop: { minX: 50, minY: 50, maxX: 950, maxY: 750 }, redacted: [{ minX: 700, minY: 600, maxX: 900, maxY: 700 }] };

describe('resizeRect — 8 λαβές', () => {
  it.each([
    ['nw', { minX: 80, minY: 90, maxX: 300, maxY: 200 }],
    ['n', { minX: 100, minY: 90, maxX: 300, maxY: 200 }],
    ['ne', { minX: 100, minY: 90, maxX: 80, maxY: 200 }],
    ['e', { minX: 100, minY: 100, maxX: 80, maxY: 200 }],
    ['se', { minX: 100, minY: 100, maxX: 80, maxY: 90 }],
    ['s', { minX: 100, minY: 100, maxX: 300, maxY: 90 }],
    ['sw', { minX: 80, minY: 100, maxX: 300, maxY: 90 }],
    ['w', { minX: 80, minY: 100, maxX: 300, maxY: 200 }],
  ] as const)('λαβή %s: κινείται ΜΟΝΟ ό,τι ανήκει στη λαβή, με αναποδογύρισμα', (handle, raw) => {
    const out = resizeRect(R, handle, { x: 80, y: 90 }, IMAGE);
    const expected = {
      minX: Math.min(raw.minX, raw.maxX), maxX: Math.max(raw.minX, raw.maxX),
      minY: Math.min(raw.minY, raw.maxY), maxY: Math.max(raw.minY, raw.maxY),
    };
    expect(out).toEqual(expected);
  });

  it('μένει μέσα στα όρια και κρατά ελάχιστη πλευρά', () => {
    expect(resizeRect(R, 'se', { x: 5000, y: -50 }, IMAGE)).toEqual({ minX: 100, minY: 0, maxX: 1000, maxY: 100 });
    const tiny = resizeRect(R, 'e', { x: 100.5, y: 0 }, IMAGE);
    expect(tiny.maxX - tiny.minX).toBe(READING_VIEW_MIN_SIDE_PX);
  });

  it('οι 8 λαβές είναι ακριβώς οι 8 θέσεις', () => {
    expect(new Set(RECT_HANDLES).size).toBe(8);
  });
});

describe('moveRect', () => {
  it('σπρώχνεται πίσω μέσα στα όρια, χωρίς να αλλάξει μέγεθος', () => {
    expect(moveRect(R, 900, 900, IMAGE)).toEqual({ minX: 800, minY: 700, maxX: 1000, maxY: 800 });
    expect(moveRect(R, -500, 0, IMAGE)).toEqual({ minX: 0, minY: 100, maxX: 200, maxY: 200 });
  });
});

describe('setCrop', () => {
  it('ακέραια pixel μέσα στην εικόνα — έγκυρη όψη για το `assertReadingView`', () => {
    const next = setCrop(VIEW, { minX: 10.4, minY: -3, maxX: 999.6, maxY: 900 }, SIZE);
    expect(next.crop).toEqual({ minX: 10, minY: 0, maxX: 1000, maxY: 800 });
    expect(() => assertReadingView(next)).not.toThrow();
  });

  it('μικραίνει: η περιοχή κόβεται στο νέο crop· όση μείνει ολόκληρη έξω σβήνεται', () => {
    const cut = setCrop(VIEW, { minX: 50, minY: 50, maxX: 800, maxY: 750 }, SIZE);
    expect(cut.redacted).toEqual([{ minX: 700, minY: 600, maxX: 800, maxY: 700 }]);
    const gone = setCrop(VIEW, { minX: 50, minY: 50, maxX: 600, maxY: 750 }, SIZE);
    expect(gone.redacted).toEqual([]);
  });
});

describe('περιοχές απόκρυψης', () => {
  it('ακέραια pixel ΠΡΟΣ ΤΑ ΕΞΩ (καλύτερα ένα pixel χαρτί παραπάνω)', () => {
    const next = addRedaction(VIEW, { minX: 100.2, minY: 100.7, maxX: 199.1, maxY: 150.9 });
    expect(next?.redacted[1]).toEqual({ minX: 100, minY: 100, maxX: 200, maxY: 151 });
  });

  it('κόβονται στο crop· ολόκληρη έξω ⇒ δεν προστίθεται / σβήνεται', () => {
    expect(addRedaction(VIEW, { minX: 0, minY: 0, maxX: 40, maxY: 40 })).toBeNull();
    expect(setRedaction(VIEW, 0, { minX: 960, minY: 760, maxX: 990, maxY: 790 }).redacted).toEqual([]);
    expect(setRedaction(VIEW, 0, { minX: 900, minY: 700, maxX: 990, maxY: 790 }).redacted)
      .toEqual([{ minX: 900, minY: 700, maxX: 950, maxY: 750 }]);
  });

  it('όριο του συμβολαίου: η 65η δεν μπαίνει, και κάθε όψη του επεξεργαστή περνά το σχήμα', () => {
    let view: PlanReadingView = { crop: VIEW.crop, redacted: [] };
    for (let i = 0; i < PLAN_READING_MAX_REDACTIONS; i++) {
      view = addRedaction(view, { minX: 60 + i * 10, minY: 60, maxX: 66 + i * 10, maxY: 70 }) ?? view;
    }
    expect(view.redacted).toHaveLength(PLAN_READING_MAX_REDACTIONS);
    expect(addRedaction(view, { minX: 100, minY: 300, maxX: 200, maxY: 400 })).toBeNull();
    expect(planReadingRequestSchema.safeParse({ view, segments: [] }).success).toBe(true);
  });

  it('σβήσιμο: μόνο η συγκεκριμένη· εκτός ορίων ⇒ ίδια όψη', () => {
    expect(removeRedaction(VIEW, 0).redacted).toEqual([]);
    expect(removeRedaction(VIEW, 5)).toBe(VIEW);
  });
});

describe('readingViewKey', () => {
  it('ίδια όψη ⇒ ίδιο κλειδί· οποιαδήποτε αλλαγή ⇒ άλλο', () => {
    expect(readingViewKey({ ...VIEW })).toBe(readingViewKey(VIEW));
    expect(readingViewKey(removeRedaction(VIEW, 0))).not.toBe(readingViewKey(VIEW));
  });
});
