/**
 * ADR-441 — Tests για το shared linear justification offset (beam/wall).
 * @see ../grid-segment-justification.ts
 */

import { justifyGridSegment } from '../grid-segment-justification';
import type { GuideBinding } from '../../hosting/guide-binding-types';

/** Κατακόρυφο segment (x σταθερό): normal = (-1, 0). */
const V_START = { x: 0, y: 0 };
const V_END = { x: 0, y: 10 };
const V_BINDINGS: GuideBinding[] = [
  { guideId: 'X0', slot: 'start-x' },
  { guideId: 'X0', slot: 'end-x' },
  { guideId: 'Y0', slot: 'start-y' },
  { guideId: 'Y1', slot: 'end-y' },
];

/** Οριζόντιο segment (y σταθερό): normal = (0, 1). */
const H_START = { x: 0, y: 0 };
const H_END = { x: 10, y: 0 };
const H_BINDINGS: GuideBinding[] = [
  { guideId: 'Y0', slot: 'start-y' },
  { guideId: 'Y0', slot: 'end-y' },
  { guideId: 'X0', slot: 'start-x' },
  { guideId: 'X1', slot: 'end-x' },
];

function extendOf(bindings: readonly GuideBinding[], slot: string): number | undefined {
  return bindings.find((b) => b.slot === slot)?.extend;
}

describe('justifyGridSegment', () => {
  describe('center → no-op (identity)', () => {
    it('επιστρέφει ίδια coords + bindings χωρίς extend', () => {
      const r = justifyGridSegment(V_START, V_END, V_BINDINGS, 200, 'center', 'mm');
      expect(r.start).toEqual({ x: 0, y: 0 });
      expect(r.end).toEqual({ x: 0, y: 10 });
      expect(r.bindings.every((b) => b.extend === undefined)).toBe(true);
    });
  });

  describe('κατακόρυφο segment — offset κατά X', () => {
    it("'right' (sign −1): body +X κατά width/2· extend +100 στα x-slots", () => {
      const r = justifyGridSegment(V_START, V_END, V_BINDINGS, 200, 'right', 'mm');
      expect(r.start.x).toBeCloseTo(100);
      expect(r.end.x).toBeCloseTo(100);
      expect(r.start.y).toBeCloseTo(0);
      expect(extendOf(r.bindings, 'start-x')).toBeCloseTo(100);
      expect(extendOf(r.bindings, 'end-x')).toBeCloseTo(100);
      // longitudinal (y) slots ΑΘΙΚΤΑ
      expect(extendOf(r.bindings, 'start-y')).toBeUndefined();
      expect(extendOf(r.bindings, 'end-y')).toBeUndefined();
    });

    it("'left' (sign +1): body −X· extend −100 στα x-slots", () => {
      const r = justifyGridSegment(V_START, V_END, V_BINDINGS, 200, 'left', 'mm');
      expect(r.start.x).toBeCloseTo(-100);
      expect(extendOf(r.bindings, 'start-x')).toBeCloseTo(-100);
    });
  });

  describe('οριζόντιο segment — offset κατά Y', () => {
    it("'left' (sign +1): body +Y· extend +100 στα y-slots, x-slots άθικτα", () => {
      const r = justifyGridSegment(H_START, H_END, H_BINDINGS, 200, 'left', 'mm');
      expect(r.start.y).toBeCloseTo(100);
      expect(r.end.y).toBeCloseTo(100);
      expect(extendOf(r.bindings, 'start-y')).toBeCloseTo(100);
      expect(extendOf(r.bindings, 'end-y')).toBeCloseTo(100);
      expect(extendOf(r.bindings, 'start-x')).toBeUndefined();
    });
  });

  describe('orientation-invariance (αντεστραμμένη φορά)', () => {
    it('αντεστραμμένο κατακόρυφο → ίδια κατεύθυνση offset', () => {
      const r = justifyGridSegment(V_END, V_START, V_BINDINGS, 200, 'right', 'mm');
      // canonicalAxisNormal κανονικοποιεί σε +Y → ίδιο normal (-1,0) → ίδιο +X offset.
      expect(r.start.x).toBeCloseTo(100);
      expect(r.end.x).toBeCloseTo(100);
    });
  });

  describe('scene units — extend πάντα σε mm', () => {
    it("'m' scene: coords σε m αλλά extend = 100 mm", () => {
      const r = justifyGridSegment(V_START, V_END, V_BINDINGS, 200, 'right', 'm');
      expect(r.start.x).toBeCloseTo(0.1); // 100mm = 0.1m σε scene units
      expect(extendOf(r.bindings, 'start-x')).toBeCloseTo(100); // extend πάντα mm
    });
  });

  describe('υπάρχον extend (column-trim longitudinal) — διατηρείται', () => {
    it('προσθέτει justification στα x-slots, αφήνει y-trim extend ανέπαφο', () => {
      const trimmed: GuideBinding[] = [
        { guideId: 'X0', slot: 'start-x' },
        { guideId: 'X0', slot: 'end-x' },
        { guideId: 'Y0', slot: 'start-y', extend: 200 }, // column trim (longitudinal)
        { guideId: 'Y1', slot: 'end-y', extend: -200 },
      ];
      const r = justifyGridSegment(V_START, V_END, trimmed, 200, 'right', 'mm');
      expect(extendOf(r.bindings, 'start-x')).toBeCloseTo(100); // justification
      expect(extendOf(r.bindings, 'start-y')).toBeCloseTo(200); // trim ανέπαφο
      expect(extendOf(r.bindings, 'end-y')).toBeCloseTo(-200);
    });
  });

  describe('degenerate (μηδενικού μήκους) → identity', () => {
    it('start == end → ίδια coords, μηδέν extend', () => {
      const r = justifyGridSegment(V_START, V_START, V_BINDINGS, 200, 'right', 'mm');
      expect(r.start).toEqual({ x: 0, y: 0 });
      expect(r.bindings.every((b) => b.extend === undefined)).toBe(true);
    });
  });
});
