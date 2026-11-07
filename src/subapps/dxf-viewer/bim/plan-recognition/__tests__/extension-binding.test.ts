/**
 * ⚓ ADR-929 Φ5.5 — **δέσιμο από τις γραμμές επέκτασης, από άκρη σε άκρη**: συνθετική εικόνα με αλυσίδα διαστάσεων →
 * ευθυγράμμιση (Φ1) → τμήματα + ρόλοι + άγκυρες (Φ2/Φ5.4/Φ5.5) → σύντηξη **χωρίς ανάγνωση** ⇒ ποιες παρειές μετρά κάθε
 * κομμάτι της αλυσίδας.
 *
 * Η συνεχής γραμμή μιας αλυσίδας είναι **ένα** τμήμα της Φ2 (ADR §6.7): η ενδιάμεση επέκταση την **τέμνει**. Πριν τη Φ5.5
 * δεν βρισκόταν καθόλου (έλεγχος μόνο στα άκρα). Η αλήθεια είναι σε mm και ανεξάρτητη κλίμακας: ο **λόγος** των δύο
 * ανοιγμάτων (3575 / 2675), ώστε το test να μην υποθέτει τίποτα για την κλίμακα της ευθυγράμμισης.
 */

import { describe, expect, it } from '@jest/globals';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { alignPlan } from '../alignment/align-plan';
import { extensionAnchorMap, segmentRoleMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import type { SyntheticDimension } from '../testing/synthetic-dimensions';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const PX_PER_MM = 0.06;
const OUT = 125;
/** Η δυτική παρειά του εσωτερικού τοίχου (άξονας 3500, πάχος 100). */
const INNER_WEST = 3450;

const SPEC: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX_PER_MM, marginMm: 400, wallStyle: 'outlined', strokePx: 2, rotationDeg: 0, degradation: null,
  dimensions: [
    { from: { x: -OUT, y: -OUT }, to: { x: INNER_WEST, y: -OUT }, offsetMm: -875, terminator: 'tick', label: '3.575', text: 'above' },
    { from: { x: INNER_WEST, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, offsetMm: -875, terminator: 'tick', label: '2.675', text: 'above' },
  ] satisfies SyntheticDimension[],
};

function recogniseAndFuse() {
  const plan = renderSyntheticPlan(SPEC);
  const aligned = alignPlan(plan.image);
  const metresPerPixel = mmToSceneUnits('m') / SPEC.pxPerMm;
  const minFillPx = minFillPxFor(aligned, { metresPerPixelX: metresPerPixel, metresPerPixelY: metresPerPixel, source: 'gallery-scale' });
  const extraction = extractPlanSegments(aligned, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const verdicts = extraction.classification.verdicts;
  const fusion = fusePlan({
    kind: 'scan',
    alignment: aligned,
    segments: extraction.segments,
    reading: null,
    knownScale: null,
    sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts),
    extensionAnchors: extensionAnchorMap(verdicts),
    roomAreaProbe: () => null,
  });
  return { verdicts, fusion };
}

describe('ADR-929 Φ5.5 — αλυσίδα από την εικόνα: οι επεκτάσεις λένε ποιες παρειές μετρά κάθε κομμάτι', () => {
  it('οι γραμμές διάστασης φέρουν άγκυρες, και τουλάχιστον τρεις επεκτάσεις (δύο άκρα + μία ενδιάμεση)', () => {
    const { verdicts } = recogniseAndFuse();
    const anchored = new Set(verdicts.flatMap((v) => (v.extensionAnchors ?? []).map((a) => a.extensionId)));
    expect(anchored.size).toBeGreaterThanOrEqual(3);
    for (const id of anchored) expect(verdicts.find((v) => v.segmentId === id)?.role).toBe('extension-line');
  });

  it('δύο ανοίγματα με πλήρεις παρειές, σε λόγο 3575 : 2675, με κοινή την παρειά του εσωτερικού τοίχου', () => {
    const { fusion } = recogniseAndFuse();
    const full = fusion.dimensionSpans.filter((s) => s.ends.every((e) => e.lineId !== null));
    expect(full).toHaveLength(2);
    const [a, b] = [...full].sort((p, q) => q.gapPx - p.gapPx);
    expect(a.gapPx / b.gapPx).toBeCloseTo(3575 / 2675, 1);
    const shared = a.ends.map((e) => e.lineId).filter((id) => b.ends.some((f) => f.lineId === id));
    expect(shared).toHaveLength(1);
  });
});
