/**
 * ADR-929 §6.9 — βαθμολογητής ρόλων: πίνακας σύγχυσης με μήκος, ανάκληση, ουρά αταίριαστων, έλεγχος ανοιγμάτων διάστασης.
 * Χειροποίητη είσοδος (όχι raster): ο βαθμολογητής είναι καθαρή γεωμετρία, άρα κάθε αναμενόμενο μήκος υπολογίζεται με το χέρι.
 */

import { describe, it, expect } from '@jest/globals';
import type { Affine2x3 } from '@/lib/geometry/affine-2x3';
import { scoreRoles } from '../testing/role-scoring/role-confusion';
import { checkSpans } from '../testing/role-scoring/span-check';
import type { CadTruth, CadTruthRole } from '../testing/cad-truth/cad-truth-types';
import type { PlanSegmentRole, PlanSegmentRoleVerdict, RasterSegment } from '../plan-recognition-types';
import type { DimensionSpan } from '../fusion/plan-fusion-types';

/** Σχέδιο → px: 1 μονάδα = 10 px, μετάθεση (5, 5). */
const T: Affine2x3 = { a: 10, b: 0, c: 0, d: 10, e: 5, f: 5 };

const cad = (ax: number, ay: number, bx: number, by: number, role: CadTruthRole) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, role });

/** Δύο παρειές τοίχου, γραμμή διάστασης με τρεις επεκτάσεις (αλυσίδα 0–10–20), ένα έπιπλο (`other`). */
const TRUTH: CadTruth = {
  segments: [
    cad(0, 0, 20, 0, 'wall-face'),
    cad(0, 3, 20, 3, 'wall-face'),
    cad(0, -2, 20, -2, 'dimension-line'),
    cad(0, -3, 0, -0.5, 'extension-line'),
    cad(10, -3, 10, -0.5, 'extension-line'),
    cad(20, -3, 20, -0.5, 'extension-line'),
    cad(5, 10, 10, 10, 'other'),
  ],
  dimensions: [
    { text: '10', measured: [{ x: 0, y: 0 }, { x: 10, y: 0 }], line: [{ x: 0, y: -2 }, { x: 10, y: -2 }] },
    { text: '10', measured: [{ x: 10, y: 0 }, { x: 20, y: 0 }], line: [{ x: 10, y: -2 }, { x: 20, y: -2 }] },
  ],
  texts: [],
  skipped: {},
};

const seg = (id: string, sx: number, sy: number, ex: number, ey: number): RasterSegment => ({
  id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, style: 'stroke', strokeWidthPx: 1, confidence: { score: 1, factors: {} },
});

const verdict = (segmentId: string, role: PlanSegmentRole, dimensionScore: number): PlanSegmentRoleVerdict => ({
  segmentId, role, dimensionScore, factors: {}, terminators: ['none', 'none'],
});

/** Ο «αναγνωριστής»: σωστή η πρώτη παρειά, λάθος η δεύτερη, διάσταση σε δύο κομμάτια, επεκτάσεις, ένα ψεύτικο τμήμα. */
const SEGMENTS: RasterSegment[] = [
  seg('w1', 5, 6, 205, 6),
  seg('w2', 5, 36, 205, 36),
  seg('d1a', 5, -15, 105, -15),
  seg('d1b', 105, -15, 205, -15),
  seg('x1', 5, -25, 5, 0),
  seg('x2', 105, -25, 105, 0),
  seg('x3', 205, -25, 205, 0),
  seg('n1', 300, 300, 400, 300),
];

const VERDICTS: PlanSegmentRoleVerdict[] = [
  verdict('w1', 'wall-face', 0.05),
  verdict('w2', 'dimension-line', 0.55),
  verdict('d1a', 'dimension-line', 0.9),
  verdict('d1b', 'dimension-line', 0.9),
  verdict('x1', 'extension-line', 0.2),
  verdict('x2', 'extension-line', 0.2),
  verdict('x3', 'extension-line', 0.2),
  verdict('n1', 'wall-face', 0.1),
];

const score = () => scoreRoles({ segments: SEGMENTS, verdicts: VERDICTS, truth: TRUTH, drawingToPx: T });

describe('scoreRoles', () => {
  it('πίνακας σύγχυσης σε px μήκους: σωστή παρειά + ψεύτικο τμήμα ⇒ no-truth', () => {
    const { confusion } = score();
    expect(confusion['wall-face']['wall-face']).toBeCloseTo(200);
    expect(confusion['wall-face']['no-truth']).toBeCloseTo(100);
    expect(confusion['dimension-line']['dimension-line']).toBeCloseTo(200);
    expect(confusion['dimension-line']['wall-face']).toBeCloseTo(200);
  });

  it('precision και recall ανά ρόλο, με το ίδιο κριτήριο και στις δύο κατευθύνσεις', () => {
    const byRole = new Map(score().metrics.map((m) => [m.role, m]));
    expect(byRole.get('wall-face')?.precision).toBeCloseTo(200 / 300);
    expect(byRole.get('wall-face')?.recall).toBeCloseTo(0.5);
    expect(byRole.get('dimension-line')?.precision).toBeCloseTo(0.5);
    expect(byRole.get('dimension-line')?.recall).toBeCloseTo(1);
    expect(byRole.get('extension-line')?.precision).toBeCloseTo(1);
    expect(byRole.get('annotation')).toEqual({ role: 'annotation', precision: null, recall: null });
  });

  it('γραμμή του CAD που δεν βρέθηκε μετρά ως missed', () => {
    const { recallMatrix } = score();
    expect(recallMatrix.other.missed).toBeCloseTo(50);
    expect(recallMatrix['wall-face']['dimension-line']).toBeCloseTo(200);
  });

  it('η ουρά έχει μόνο τα αταίριαστα, πρώτα το πιο αβέβαιο', () => {
    expect(score().mismatches.map((s) => [s.segmentId, s.truth])).toEqual([
      ['w2', 'wall-face'],
      ['n1', 'no-truth'],
    ]);
  });

  it('κάθετη πινελιά πάνω σε παρειά δεν ταιριάζει, αν και όλα τα δείγματά της είναι μέσα σε 1 px (ανοχή γωνίας)', () => {
    const r = scoreRoles({ segments: [seg('t1', 100, 3, 100, 7)], verdicts: [], truth: TRUTH, drawingToPx: T });
    expect(r.segments[0]).toMatchObject({ segmentId: 't1', predicted: 'unknown', truth: 'no-truth', dimensionScore: null });
  });
});

const span = (id: string, segmentIds: string[], e0: string, e1: string): DimensionSpan => ({
  id, segmentIds, runFamilyId: 0, runOffsetPx: 0, familyId: 1, gapPx: 0,
  ends: [{ extensionId: e0, lineId: null, offsetPx: 0 }, { extensionId: e1, lineId: null, offsetPx: 1 }],
});

describe('checkSpans', () => {
  const check = (spans: DimensionSpan[]) =>
    checkSpans({ spans, segments: SEGMENTS, dimensions: TRUTH.dimensions, drawingToPx: T });

  it('σωστό ζεύγος παρειών ⇒ matched με σφάλμα 0, και η άλλη διάσταση μένει missed', () => {
    const r = check([span('s1', ['d1a'], 'x1', 'x2')]);
    expect(r.verdicts).toEqual([{ kind: 'matched', spanId: 's1', dimensionIndex: 0, errorPx: 0 }]);
    expect(r.missedDimensions).toEqual([1]);
  });

  it('η σειρά των επεκτάσεων δεν μετρά', () => {
    expect(check([span('s1', ['d1b'], 'x3', 'x2')]).verdicts[0]).toMatchObject({ kind: 'matched', dimensionIndex: 1 });
  });

  it('άνοιγμα που πιάνει όλη την αλυσίδα ⇒ wrong-pair, όχι matched', () => {
    expect(check([span('s1', ['d1a'], 'x1', 'x3')]).verdicts[0]).toMatchObject({ kind: 'wrong-pair', errorPx: 100 });
  });

  it('γραμμή που δεν είναι διάσταση του CAD ⇒ no-truth · άγνωστο τμήμα ⇒ unresolved', () => {
    const r = check([span('s1', ['w2'], 'x1', 'x2'), span('s2', ['nope'], 'x1', 'x2')]);
    expect(r.verdicts.map((v) => v.kind)).toEqual(['no-truth', 'unresolved']);
    expect(r.missedDimensions).toEqual([0, 1]);
  });
});
