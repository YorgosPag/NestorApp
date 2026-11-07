/**
 * ADR-929 Φ5.4 — **διαστάσεις ≠ τοίχοι**, από άκρη σε άκρη: συνθετικό σχέδιο με διαστάσεις → ευθυγράμμιση (Φ1) →
 * τμήματα + ρόλοι (Φ2/Φ5.4) → τοίχοι μόνο από τις υποψήφιες παρειές.
 *
 * Η αλήθεια είναι οι `SyntheticWall` και οι γραμμές διάστασης του δείγματος, σε mm, μέσω του **ίδιου** SSoT σκηνής
 * (`rasterPixelToScene`). Κάθε τύπος απόληξης δοκιμάζεται, και η διάσταση **χωρίς** απόληξη (μόνο κείμενο).
 */

import { describe, expect, it } from '@jest/globals';
import type { Point2D } from '../../../rendering/types/Types';
import { rasterPixelToScene } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { proposeConfirmed } from '../../model-from-drawing/__tests__/confirmed-proposal';
import { alignPlan } from '../alignment/align-plan';
import { isWallCandidateRole } from '../classify/segment-roles';
import type { PlanSegmentRole, RasterSegment } from '../plan-recognition-types';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import { rasterParallelPairStrategy, withRasterSegments } from '../segments/raster-segments-to-scene';
import type { SyntheticDimension, SyntheticTerminator, TruthSegment } from '../testing/synthetic-dimensions';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlan, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const PX_PER_MM = 0.06;
const BASE: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX_PER_MM, marginMm: 600, wallStyle: 'outlined', strokePx: 2, rotationDeg: 0, degradation: null,
};
/** Ένα τμήμα «κάθεται» σε τμήμα αλήθειας όταν και τα δύο άκρα του απέχουν ≤ 3 px. */
const ON_TRUTH_MM = 3 / PX_PER_MM;

/** Η εξωτερική παρειά των τοίχων 25 cm του δείγματος (άξονας ± 125 mm). */
const OUT = 125;

/**
 * Νότια διάσταση όλου του μήκους και ανατολική όλου του πλάτους, έξω από το σπίτι, από **παρειά σε παρειά** (όπως
 * σχεδιάζεται): έτσι το κενό της γραμμής επέκτασης μετρά από το μελάνι του τοίχου, όχι από τον άξονά του.
 */
function outerDimensions(terminator: SyntheticTerminator, text: SyntheticDimension['text']): SyntheticDimension[] {
  return [
    { from: { x: -OUT, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, offsetMm: -875, terminator, label: '6.25', text },
    { from: { x: 6000 + OUT, y: -OUT }, to: { x: 6000 + OUT, y: 4000 + OUT }, offsetMm: -875, terminator, label: '4.25', text },
  ];
}

interface Recognised {
  readonly plan: SyntheticPlan;
  readonly segments: readonly RasterSegment[];
  readonly roleOf: ReadonlyMap<string, PlanSegmentRole>;
}

function recognise(spec: SyntheticPlanSpec): Recognised {
  const plan = renderSyntheticPlan(spec);
  const aligned = alignPlan(plan.image);
  const metresPerPixel = mmToSceneUnits('m') / spec.pxPerMm;
  const minFillPx = minFillPxFor(aligned, { metresPerPixelX: metresPerPixel, metresPerPixelY: metresPerPixel, source: 'gallery-scale' });
  const extraction = extractPlanSegments(aligned, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const roleOf = new Map(extraction.classification.verdicts.map((v) => [v.segmentId, v.role]));
  return { plan, segments: extraction.segments, roleOf };
}

function distToSegment(p: Point2D, s: TruthSegment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l2));
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy));
}

/**
 * Τα τμήματα που κάθονται πάνω στην αλήθεια: άκρα **και** μέσο, το καθένα πάνω σε κάποιο τμήμα αλήθειας. Η συνεχής γραμμή
 * μιας αλυσίδας είναι ένα τμήμα πάνω σε δύο κομμάτια· μια γραμμή που γεφυρώνει το κενό του κειμένου δεν μετρά (μέσο στο κενό).
 */
function onTruth(r: Recognised, truth: readonly TruthSegment[]): RasterSegment[] {
  const near = (p: Point2D) => truth.some((t) => distToSegment(p, t) <= ON_TRUTH_MM);
  return r.segments.filter((s) => {
    const a = rasterPixelToScene(s.start, r.plan.placement);
    const b = rasterPixelToScene(s.end, r.plan.placement);
    return near(a) && near(b) && near({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  });
}

/** Οι τοίχοι από τις υποψήφιες παρειές μόνο: [πόσοι αληθινοί βρέθηκαν, πόσοι κάθονται πάνω σε διάσταση]. */
function wallsFromCandidates(r: Recognised): { readonly found: number; readonly onDimensions: number } {
  const candidates = r.segments.filter((s) => isWallCandidateRole(r.roleOf.get(s.id)));
  const lines = withRasterSegments([], () => null, candidates, r.plan.placement);
  const strategy = rasterParallelPairStrategy(r.plan.placement, 'mm');
  const walls = proposeConfirmed({ ...lines, sceneUnits: 'mm', levelId: 'lvl', strategy }).walls;
  const found = SAMPLE_HOUSE_WALLS.filter((t) => walls.some((w) => (
    distToSegment(w.params.start, { a: t.start, b: t.end }) <= t.thicknessMm
    && distToSegment(w.params.end, { a: t.start, b: t.end }) <= t.thicknessMm
  ))).length;
  const nearDim = (p: Point2D) => r.plan.dimensions.dimensionLines.some((d) => distToSegment(p, d) <= 2 * ON_TRUTH_MM);
  const onDimensions = walls.filter((w) => nearDim(w.params.start) && nearDim(w.params.end)).length;
  return { found, onDimensions };
}

describe('ADR-929 Φ5.4 — ρόλοι τμημάτων: διαστάσεις ≠ τοίχοι', () => {
  it.each<[SyntheticTerminator, SyntheticDimension['text']]>([
    ['arrow', 'interrupt'], ['tick', 'interrupt'], ['dot', 'interrupt'], ['none', 'interrupt'],
    ['arrow', 'above'], ['tick', 'above'], ['dot', 'above'], ['none', 'above'],
  ])('απόληξη %s, κείμενο %s ⇒ κάθε γραμμή διάστασης είναι διάσταση, και κανένας τοίχος πάνω της', (terminator, text) => {
    const r = recognise({ ...BASE, marginMm: 400, dimensions: outerDimensions(terminator, text) });
    const dimSegments = onTruth(r, r.plan.dimensions.dimensionLines);
    expect(dimSegments.length).toBeGreaterThan(0);
    for (const s of dimSegments) expect(r.roleOf.get(s.id)).toBe('dimension-line');
    const walls = wallsFromCandidates(r);
    expect(walls.found).toBe(SAMPLE_HOUSE_WALLS.length);
    expect(walls.onDimensions).toBe(0);
  });

  it.each<SyntheticTerminator>(['arrow', 'tick', 'dot'])(
    'χωρίς αριθμό (μόνο απόληξη %s + γραμμές επέκτασης) ⇒ διάσταση: η απόληξη είναι τεκμήριο από μόνη της',
    (terminator) => {
      const unlabeled = outerDimensions(terminator, 'above').map((d) => ({ ...d, label: '' }));
      const r = recognise({ ...BASE, marginMm: 400, dimensions: unlabeled });
      const dimSegments = onTruth(r, r.plan.dimensions.dimensionLines);
      expect(dimSegments.length).toBeGreaterThan(0);
      for (const s of dimSegments) expect(r.roleOf.get(s.id)).toBe('dimension-line');
    },
  );

  it('καμία γραμμή διάστασης έξω από τις διαστάσεις: οι παρειές τοίχων δεν γίνονται ποτέ διάσταση', () => {
    const r = recognise({ ...BASE, marginMm: 400, dimensions: outerDimensions('tick', 'interrupt') });
    const truth = [...r.plan.dimensions.dimensionLines, ...r.plan.dimensions.extensionLines];
    const onAnnotation = new Set(onTruth(r, truth).map((s) => s.id));
    const stray = r.segments.filter((s) => r.roleOf.get(s.id) === 'dimension-line' && !onAnnotation.has(s.id));
    expect(stray).toEqual([]);
  });

  it('αλυσίδα διαστάσεων (δύο κομμάτια με κοινή απόληξη): και τα δύο διάσταση', () => {
    const chain: SyntheticDimension[] = [
      { from: { x: -OUT, y: -OUT }, to: { x: 3500, y: -OUT }, offsetMm: -875, terminator: 'tick', label: '3.62', text: 'above' },
      { from: { x: 3500, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, offsetMm: -875, terminator: 'tick', label: '2.62', text: 'above' },
    ];
    const r = recognise({ ...BASE, marginMm: 400, dimensions: chain });
    const dimSegments = onTruth(r, r.plan.dimensions.dimensionLines);
    expect(dimSegments.length).toBeGreaterThan(0);
    for (const s of dimSegments) expect(r.roleOf.get(s.id)).toBe('dimension-line');
  });

  it.each<[string, Partial<SyntheticPlanSpec>]>([
    ['περίγραμμα', {}],
    ['poché', { wallStyle: 'filled' }],
    ['περίγραμμα, στραβή σάρωση 1,3°', { rotationDeg: 1.3 }],
    ['παλιά σάρωση', { degradation: { seed: 42, noiseAmplitude: 25, yellowing: 0.8 } }],
  ])('χωρίς διαστάσεις (%s): καμία γραμμή διάστασης, όλοι οι τοίχοι', (_name, patch) => {
    const r = recognise({ ...BASE, ...patch });
    expect(r.segments.filter((s) => r.roleOf.get(s.id) === 'dimension-line')).toEqual([]);
    expect(wallsFromCandidates(r).found).toBe(SAMPLE_HOUSE_WALLS.length);
  });

  it('κάθε τμήμα έχει ακριβώς μία κρίση, με τις απολήξεις των δύο άκρων', () => {
    const r = recognise({ ...BASE, marginMm: 400, dimensions: outerDimensions('arrow', 'above') });
    expect(r.roleOf.size).toBe(r.segments.length);
    for (const s of r.segments) expect(r.roleOf.has(s.id)).toBe(true);
  });
});
