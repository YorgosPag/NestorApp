/**
 * ADR-608 — regression lock for Tekton «Βέλος 2» leader-arrow helpers (Giorgio 2026-07-09).
 * Pure functions → no DOM/firebase. Guards the calibrated behaviour while we keep tuning the dim.
 */

import {
  hasLeaderArrows,
  resolveDimLineInsets,
  insetDimLineSegments,
  resolveLeaderArrowDir,
} from '../dim-leader-arrow';
import { paperHeightToModel } from '../../../../utils/annotation-scale';

/** Minimal DIMSTYLE slice naming the same block on both sides (dimblk1/2 empty → fall back). */
const blockStyle = (dimblk: string) => ({ dimblk, dimblk1: '', dimblk2: '' });

describe('hasLeaderArrows (ADR-608)', () => {
  it('true όταν το βέλος έχει leader (tektonArrow2 → dimLineInset > 0)', () => {
    expect(hasLeaderArrows(blockStyle('tektonArrow2'))).toBe(true);
  });

  it('false για standard arrowheads (closedFilled, χωρίς dimLineInset)', () => {
    expect(hasLeaderArrows(blockStyle('closedFilled'))).toBe(false);
    expect(hasLeaderArrows(blockStyle('oblique'))).toBe(false);
  });
});

describe('resolveDimLineInsets (ADR-608)', () => {
  it('inset = dimLineInset × paperHeightToModel(dimasz, dimscale) και για τις 2 πλευρές', () => {
    const style = { dimblk: 'tektonArrow2', dimblk1: '', dimblk2: '', dimasz: 1.2, dimscale: 300 };
    const worldUnit = paperHeightToModel(1.2, 300, 'mm');
    const expected = (0.3 / 0.12) * worldUnit; // LEADER_LEN (2.5) × worldUnit
    const { inset1, inset2 } = resolveDimLineInsets(style, 'mm');
    expect(inset1).toBeCloseTo(expected, 3);
    expect(inset2).toBeCloseTo(expected, 3);
  });

  it('standard arrowhead → inset 0 (καμία μεταβολή στη γραμμή)', () => {
    const style = { dimblk: 'closedFilled', dimblk1: '', dimblk2: '', dimasz: 2.5, dimscale: 100 };
    expect(resolveDimLineInsets(style, 'mm')).toEqual({ inset1: 0, inset2: 0 });
  });
});

describe('insetDimLineSegments (ADR-608 — leader pull-back)', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 100, y: 0 }; // οριζόντια dim line μήκους 100

  it('inset 0 και στις 2 πλευρές → segments αμετάβλητα (standard arrowheads)', () => {
    const segs = [{ start, end }];
    expect(insetDimLineSegments(segs, start, end, 0, 0)).toEqual(segs);
  });

  it('τραβάει τη γραμμή προς μέσα κατά inset1/inset2 (ξεκινά/τελειώνει στα leader ends)', () => {
    const [seg] = insetDimLineSegments([{ start, end }], start, end, 30, 30);
    expect(seg.start.x).toBeCloseTo(30, 6);
    expect(seg.end.x).toBeCloseTo(70, 6);
  });

  it('διατηρεί το κενό κειμένου (2 segments) — inset μόνο στα εξωτερικά άκρα', () => {
    const segs = [
      { start, end: { x: 40, y: 0 } }, // αριστερά του κειμένου
      { start: { x: 60, y: 0 }, end }, // δεξιά του κειμένου
    ];
    const out = insetDimLineSegments(segs, start, end, 30, 30);
    expect(out).toHaveLength(2);
    expect(out[0].start.x).toBeCloseTo(30, 6); // εξωτερικό άκρο μέσα
    expect(out[0].end.x).toBeCloseTo(40, 6); // κενό κειμένου ανέπαφο
    expect(out[1].start.x).toBeCloseTo(60, 6);
    expect(out[1].end.x).toBeCloseTo(70, 6);
  });

  it('leaders καλύπτουν όλο το μήκος → καμία κεντρική γραμμή', () => {
    expect(insetDimLineSegments([{ start, end }], start, end, 60, 60)).toEqual([]);
  });
});

describe('resolveLeaderArrowDir (ADR-608)', () => {
  const outward = { x: 2, y: 4 };
  const fit = { x: 0.5, y: 0.5 };

  it('leader arrow → ντετερμινιστική inward φορά (negated outward, immune στο fit-flip)', () => {
    expect(resolveLeaderArrowDir(true, outward, fit)).toEqual({ x: -2, y: -4 });
  });

  it('standard arrow → κρατά τη fit/geometry φορά (fallback)', () => {
    expect(resolveLeaderArrowDir(false, outward, fit)).toBe(fit);
  });
});
