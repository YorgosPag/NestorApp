/**
 * ⚓ ADR-929 Δ20 · Σ1 — ανοίγματα διαστάσεων → `LinearDimensionEntity`. Χειροποίητο σενάριο με **γνωστή** γεωμετρία:
 * οριζόντια γραμμή διάστασης στο y = 100 με τέσσερις επεκτάσεις (x = 10, 60, 160, 210) ⇒ αλυσίδα τριών ανοιγμάτων. Το
 * αναμενόμενο σημείο σκηνής υπολογίζεται με το **ίδιο** SSoT (`rasterPixelToScene`), με άνισες κλίμακες X/Y, ώστε να
 * κλειδώνεται η προβολή και όχι η απεικόνιση.
 */

import { describe, expect, it } from '@jest/globals';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import { rasterPixelToScene, type RasterPlacement } from '../../../../floorplan-background/geometry/raster-scene-mapping';
import type { PlanSegmentRoleVerdict, PlanTerminatorKind, RasterSegment } from '../../plan-recognition-types';
import { planDimensionEntities, type DimensionEntityFusion, type DimensionEntityInput } from '../dimension-entities';
import type { DimensionSpan, FaceLine } from '../plan-fusion-types';

const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 300, height: 300 },
  transform: { translateX: 5, translateY: -7, scaleX: 2, scaleY: 3, rotation: 0 },
};
const CONFIDENCE = { score: 1, factors: {} };
const EXT_X = [10, 60, 160, 210] as const;
const RUN_Y = 100;
const FOOT_Y = 200;

const segment = (id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment => ({
  id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx: 1, confidence: CONFIDENCE,
});

/** Επεκτάσεις κατακόρυφες, από λίγο πάνω από τη γραμμή ως τον τοίχο από κάτω (το πόδι στο y = 200). */
const SEGMENTS: readonly RasterSegment[] = [
  segment('d0', 0, RUN_Y, 220, RUN_Y),
  ...EXT_X.map((x, i) => segment(`e${i}`, x, RUN_Y - 5, x, FOOT_Y)),
];

/** Οικογένεια 1 (π/2): n = (−1, 0) ⇒ μετατόπιση = −x. */
const offsetOfX = (x: number): number => -x;

function span(i: number, lineIds: readonly [string | null, string | null] = [null, null]): DimensionSpan {
  const [a, b] = [EXT_X[i + 1], EXT_X[i]];
  return {
    id: `ds${i}`, segmentIds: ['d0'], runFamilyId: 0, runOffsetPx: RUN_Y, familyId: 1,
    ends: [
      { extensionId: `e${i + 1}`, lineId: lineIds[0], offsetPx: offsetOfX(a) },
      { extensionId: `e${i}`, lineId: lineIds[1], offsetPx: offsetOfX(b) },
    ],
    gapPx: a - b,
  };
}

const FACE: FaceLine = { id: 'L1', familyId: 1, offsetPx: offsetOfX(10), extentMinPx: 150, extentMaxPx: 300, segmentIds: [] };

function fusion(spans: readonly DimensionSpan[], adjusted: ReadonlyMap<string, number> = new Map()): DimensionEntityFusion {
  return {
    families: [{ id: 0, angleRad: 0 }, { id: 1, angleRad: Math.PI / 2 }],
    faceLines: [FACE],
    adjustedOffsetPx: adjusted,
    dimensionSpans: spans,
  };
}

const verdict = (terminators: readonly [PlanTerminatorKind, PlanTerminatorKind]): PlanSegmentRoleVerdict => ({
  segmentId: 'd0', role: 'dimension-line', dimensionScore: 1, factors: {}, terminators,
});

function input(f: DimensionEntityFusion, verdicts: readonly PlanSegmentRoleVerdict[] = [], segments = SEGMENTS): DimensionEntityInput {
  return {
    fusion: f, segments, verdicts, placement: PLACEMENT,
    originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY,
  };
}

let seq = 0;
const CTX = { styleId: 'style-x', layerId: 'layer-dims', newId: () => `dim_${seq++}` };
const scene = (x: number, y: number) => rasterPixelToScene({ x, y }, PLACEMENT);

function expectPoint(actual: { x: number; y: number }, expected: { x: number; y: number }): void {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
}

describe('planDimensionEntities — αλυσίδα από τις επεκτάσεις', () => {
  const proposals = planDimensionEntities(input(fusion([span(0), span(1), span(2)])), CTX);

  it('μία γραμμική διάσταση ανά άνοιγμα, με τη σειρά των ανοιγμάτων', () => {
    expect(proposals.map((p) => p.spanId)).toEqual(['ds0', 'ds1', 'ds2']);
    for (const { entity } of proposals) {
      expect(entity.type).toBe('dimension');
      expect(entity.dimensionType).toBe('linear');
      expect(entity.styleId).toBe('style-x');
      expect(entity.layerId).toBe('layer-dims');
      expect(entity.userText).toBe('<>');
      expect(entity.defPoints).toHaveLength(3);
    }
  });

  it('οι αρχές των επεκτάσεων κάθονται στο ΠΟΔΙ (στον τοίχο), όχι στη γραμμή διάστασης', () => {
    const { defPoints } = proposals[0].entity;
    expectPoint(defPoints[0], scene(60, FOOT_Y));
    expectPoint(defPoints[1], scene(10, FOOT_Y));
  });

  it('αλυσίδα = ίδια γραμμή: κοινή περιστροφή και γραμμή αναφοράς στο y της γραμμής διάστασης', () => {
    const rotations = new Set(proposals.map((p) => p.entity.rotation));
    expect(rotations.size).toBe(1);
    expect([0, 180]).toContain(proposals[0].entity.rotation);
    for (const { entity } of proposals) expect(entity.defPoints[2].y).toBeCloseTo(scene(0, RUN_Y).y, 9);
  });

  it('τα ids έρχονται από την πηγή ids (N.6) και είναι μοναδικά', () => {
    expect(new Set(proposals.map((p) => p.entity.id)).size).toBe(3);
    for (const p of proposals) expect(p.entity.id).toMatch(/^dim_\d+$/);
  });
});

describe('planDimensionEntities — μετρά τις συνορθωμένες παρειές', () => {
  it('πόδι σε παρειά ⇒ η συνορθωμένη μετατόπιση (ίδια με τον τοίχο που θα γραφτεί)', () => {
    const [p] = planDimensionEntities(input(fusion([span(0, [null, 'L1'])], new Map([['L1', offsetOfX(12)]]))), CTX);
    expectPoint(p.entity.defPoints[1], scene(12, FOOT_Y));
    expectPoint(p.entity.defPoints[0], scene(60, FOOT_Y));
  });

  it('παρειά χωρίς συνόρθωση ⇒ η παρατηρημένη μετατόπιση της παρειάς', () => {
    const [p] = planDimensionEntities(input(fusion([span(0, [null, 'L1'])])), CTX);
    expectPoint(p.entity.defPoints[1], scene(10, FOOT_Y));
  });
});

describe('planDimensionEntities — το άκρο όπως σχεδιάστηκε', () => {
  const blockOf = (terminators: readonly [PlanTerminatorKind, PlanTerminatorKind]) =>
    planDimensionEntities(input(fusion([span(0)]), [verdict(terminators)]), CTX)[0].entity.overrides?.dimblk;

  it('λοξή ⇒ oblique · βέλος ⇒ closedFilled · κουκκίδα ⇒ dot', () => {
    expect(blockOf(['tick', 'tick'])).toBe('oblique');
    expect(blockOf(['arrow', 'arrow'])).toBe('closedFilled');
    expect(blockOf(['dot', 'none'])).toBe('dot');
  });

  it('ισοπαλία, σταυρός ή καμία ψήφος ⇒ καμία παράκαμψη: αποφασίζει το στυλ', () => {
    expect(blockOf(['arrow', 'dot'])).toBeUndefined();
    expect(blockOf(['cross', 'cross'])).toBeUndefined();
    expect(blockOf(['none', 'none'])).toBeUndefined();
  });
});

describe('planDimensionEntities — ποτέ μαντεψιά', () => {
  it('λείπει η επέκταση ⇒ το άνοιγμα παραλείπεται, τα άλλα μένουν', () => {
    const withoutE0 = SEGMENTS.filter((s) => s.id !== 'e0');
    const proposals = planDimensionEntities(input(fusion([span(0), span(1)]), [], withoutE0), CTX);
    expect(proposals.map((p) => p.spanId)).toEqual(['ds1']);
  });

  it('άγνωστη οικογένεια ⇒ το άνοιγμα παραλείπεται', () => {
    const broken = { ...span(0), runFamilyId: 7 };
    expect(planDimensionEntities(input(fusion([broken])), CTX)).toEqual([]);
  });

  it('κανένα άνοιγμα ⇒ καμία πρόταση', () => {
    expect(planDimensionEntities(input(fusion([])), CTX)).toEqual([]);
  });
});
