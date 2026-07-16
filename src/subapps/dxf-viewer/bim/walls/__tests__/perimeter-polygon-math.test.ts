/**
 * ADR-363 / ADR-584 — direct unit tests για τους κοινούς polygon helpers.
 *
 * Ήταν private αντίγραφα σε `perimeter-polygon-math.ts` + `wall-footprint-decompose.ts`
 * (jscpd / N.18). Με την κεντρικοποίηση έγιναν δημόσιο API του canonical αρχείου, οπότε
 * θέλουν δικό τους δίχτυ — μέχρι τώρα καλύπτονταν μόνο έμμεσα μέσω `perimeter-from-faces`.
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  rotate,
  unit,
  allRightAngles,
  dominantEdgeAngle,
  uniqueSorted,
  rectCorners,
  toLocalFrame,
} from '../perimeter-polygon-math';

const TOL = 5;
const HALF_PI = Math.PI / 2;

/** Τετράγωνο 1000×1000 στην αρχή των αξόνων, CCW. */
const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

function expectPointClose(actual: Point2D, expected: Point2D): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('rotate', () => {
  it('στρέφει κατά +90° αριστερόστροφα', () => {
    expectPointClose(rotate({ x: 1, y: 0 }, HALF_PI), { x: 0, y: 1 });
  });

  it('γωνία 0 → ταυτοτική', () => {
    expectPointClose(rotate({ x: 3, y: -7 }, 0), { x: 3, y: -7 });
  });

  it('είναι αντιστρέψιμη (rotate(-ang) ∘ rotate(ang) = id)', () => {
    const p = { x: 123, y: -456 };
    expectPointClose(rotate(rotate(p, 0.7), -0.7), p);
  });

  it('διατηρεί το μέτρο', () => {
    const r = rotate({ x: 3, y: 4 }, 1.234);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(5, 6);
  });
});

describe('unit', () => {
  it('κανονικοποιεί σε μοναδιαίο μήκος', () => {
    expectPointClose(unit(3, 4), { x: 0.6, y: 0.8 });
  });

  it('μηδενικό διάνυσμα → {0,0} αντί για NaN (guard `|| 1`)', () => {
    expectPointClose(unit(0, 0), { x: 0, y: 0 });
  });
});

describe('allRightAngles', () => {
  it('τετράγωνο → true', () => {
    expect(allRightAngles(SQUARE)).toBe(true);
  });

  it('στραμμένο τετράγωνο → true (ανεξάρτητο προσανατολισμού)', () => {
    expect(allRightAngles(SQUARE.map((p) => rotate(p, 0.4)))).toBe(true);
  });

  it('τρίγωνο → false', () => {
    expect(allRightAngles([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(false);
  });

  it('ανοχή ~±4.6° — απόκλιση 2° περνά ακόμα ως ορθή', () => {
    const skewed: Point2D[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000 + 1000 * Math.tan((2 * Math.PI) / 180), y: 1000 },
      { x: 1000 * Math.tan((2 * Math.PI) / 180), y: 1000 },
    ];
    expect(allRightAngles(skewed)).toBe(true);
  });
});

describe('dominantEdgeAngle', () => {
  it('η μεγαλύτερη ακμή είναι οριζόντια → γωνία 0', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(dominantEdgeAngle(poly)).toBeCloseTo(0, 6);
  });

  it('η μεγαλύτερη ακμή είναι κατακόρυφη → γωνία 90°', () => {
    const poly: Point2D[] = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 2000 },
      { x: 0, y: 2000 },
    ];
    expect(Math.abs(dominantEdgeAngle(poly))).toBeCloseTo(HALF_PI, 6);
  });
});

describe('uniqueSorted', () => {
  it('ταξινομεί και πετά διπλότυπα', () => {
    expect(uniqueSorted([30, 10, 20, 10], 1)).toEqual([10, 20, 30]);
  });

  it('συγχωνεύει τιμές εντός tol', () => {
    expect(uniqueSorted([100, 102, 300], TOL)).toEqual([100, 300]);
  });

  it('δεν συγχωνεύει τιμές εκτός tol', () => {
    expect(uniqueSorted([100, 110, 300], TOL)).toEqual([100, 110, 300]);
  });

  it('κενή είσοδος → κενή έξοδος', () => {
    expect(uniqueSorted([], TOL)).toEqual([]);
  });

  it('δεν μεταλλάσσει την είσοδο', () => {
    const input = [30, 10, 20];
    uniqueSorted(input, 1);
    expect(input).toEqual([30, 10, 20]);
  });
});

describe('rectCorners', () => {
  it('axis-aligned rect → 4 κορυφές + long/short/area', () => {
    const r = rectCorners({ xa: 0, xb: 2000, y0: 0, y1: 300 }, 0);
    expect(r.longSide).toBeCloseTo(2000, 6);
    expect(r.shortSide).toBeCloseTo(300, 6);
    expect(r.area).toBeCloseTo(600000, 6);
    expect(r.polygon).toHaveLength(4);
    expectPointClose(r.polygon[0], { x: 0, y: 0 });
    expectPointClose(r.polygon[2], { x: 2000, y: 300 });
  });

  it('η γωνία στρέφει τις κορυφές αλλά ΟΧΙ τις διαστάσεις', () => {
    const r = rectCorners({ xa: 0, xb: 2000, y0: 0, y1: 300 }, HALF_PI);
    expect(r.longSide).toBeCloseTo(2000, 6);
    expect(r.shortSide).toBeCloseTo(300, 6);
    expect(r.area).toBeCloseTo(600000, 6);
    expectPointClose(r.polygon[1], { x: 0, y: 2000 });
  });
});

describe('toLocalFrame', () => {
  it('μη-ορθογωνικό πολύγωνο → null', () => {
    expect(toLocalFrame([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }], TOL)).toBeNull();
  });

  it('λιγότερες από 4 κορυφές → null', () => {
    expect(toLocalFrame([{ x: 0, y: 0 }, { x: 100, y: 0 }], TOL)).toBeNull();
  });

  it('ορθογώνιο → τοπικό πλαίσιο ευθυγραμμισμένο στον άξονα X', () => {
    const frame = toLocalFrame(SQUARE, TOL);
    expect(frame).not.toBeNull();
    expect(frame!.local).toHaveLength(4);
    // Στο τοπικό πλαίσιο η μεγαλύτερη ακμή πέφτει στον X → όλες οι ακμές axis-aligned.
    for (let i = 0; i < frame!.local.length; i++) {
      const a = frame!.local[i];
      const b = frame!.local[(i + 1) % frame!.local.length];
      const alignedX = Math.abs(a.y - b.y) < 1e-6;
      const alignedY = Math.abs(a.x - b.x) < 1e-6;
      expect(alignedX || alignedY).toBe(true);
    }
  });

  it('στραμμένο ορθογώνιο → ίδιο τοπικό σχήμα (η στροφή απορροφάται στο ang)', () => {
    const rotated = SQUARE.map((p) => rotate(p, 0.6));
    const frame = toLocalFrame(rotated, TOL);
    expect(frame).not.toBeNull();
    for (let i = 0; i < frame!.local.length; i++) {
      const a = frame!.local[i];
      const b = frame!.local[(i + 1) % frame!.local.length];
      const alignedX = Math.abs(a.y - b.y) < 1e-6;
      const alignedY = Math.abs(a.x - b.x) < 1e-6;
      expect(alignedX || alignedY).toBe(true);
    }
  });
});
