/**
 * ⚓ ADR-929 Φ4 — **από άκρη σε άκρη**: συνθετική σάρωση (στραβή, παλιό χαρτί) → ευθυγράμμιση (Φ1) → τμήματα (Φ2) →
 * σύντηξη με διαστάσεις γραμμένες στις γνωστές θέσεις. Η αλήθεια είναι η κλίμακα του δείγματος και οι τιμές των τοίχων.
 *
 * ⚠️ Οι χρόνοι εδώ δεν μετρούν (§6.2 #5).
 */

import { describe, expect, it } from '@jest/globals';
import { alignPlan } from '../../alignment/align-plan';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../../segments/plan-segments';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlan, type SyntheticPlanSpec } from '../../testing/synthetic-plan-raster';
import { sceneToRasterPixel } from '../../../../floorplan-background/geometry/raster-scene-mapping';
import { mmToSceneUnits } from '../../../../utils/scene-units';
import type { PlanDimension, PlanText } from '../../plan-recognition-types';
import type { RasterRectPx } from '../../../../types/coordinate-space';
import { fusePlan } from '../plan-fusion';
import { dimensionOf, reading } from './fusion-fixture';

const PX_PER_MM = 0.06;
const SPEC: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS,
  pxPerMm: PX_PER_MM,
  marginMm: 1200,
  wallStyle: 'outlined',
  strokePx: 2,
  rotationDeg: 1.3,
  degradation: { seed: 42, noiseAmplitude: 25, yellowing: 0.8 },
};

/** Οι διαστάσεις του σπιτιού σε mm κάτοψης (Y πάνω): κέντρο κειμένου, προσανατολισμός, τιμή. */
const DIMENSIONS = [
  { id: 't-overall', raw: '6.25', valueMm: 6250, x: 3000, y: -700, o: 'h' },
  { id: 't-west', raw: '3.325', valueMm: 3325, x: 1787.5, y: 2000, o: 'h' },
  { id: 't-east', raw: '2.325', valueMm: 2325, x: 4712.5, y: 2000, o: 'h' },
  { id: 't-depth', raw: '4.25', valueMm: 4250, x: -700, y: 2000, o: 'v' },
  { id: 't-depth-in', raw: '3.75', valueMm: 3750, x: 800, y: 2000, o: 'v' },
] as const;

function textRect(plan: SyntheticPlan, xMm: number, yMm: number, o: 'h' | 'v'): RasterRectPx {
  const c = sceneToRasterPixel({ x: xMm, y: yMm }, plan.placement);
  if (c === null) throw new Error('degenerate placement');
  const [w, h] = o === 'h' ? [40, 11] : [11, 40];
  return { minX: c.x - w / 2, minY: c.y - h / 2, maxX: c.x + w / 2, maxY: c.y + h / 2 };
}

function run(override?: { readonly id: string; readonly raw: string; readonly valueMm: number }) {
  const plan = renderSyntheticPlan(SPEC);
  const alignment = alignPlan(plan.image);
  const metres = mmToSceneUnits('m') / PX_PER_MM;
  const minFillPx = minFillPxFor(alignment, { metresPerPixelX: metres, metresPerPixelY: metres, source: 'gallery-scale' });
  const { segments } = extractPlanSegments(alignment, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const texts: PlanText[] = DIMENSIONS.map((d) => ({
    id: d.id,
    kind: 'dimension',
    raw: override?.id === d.id ? override.raw : d.raw,
    rect: textRect(plan, d.x, d.y, d.o),
    confidence: { score: 0.9, factors: { reading: 0.9 } },
  }));
  const dimensions: PlanDimension[] = DIMENSIONS.map((d) => dimensionOf(d.id, override?.id === d.id ? override.valueMm : d.valueMm));
  return fusePlan({
    kind: 'scan',
    alignment,
    segments,
    reading: { status: 'read', reading: reading({ texts, dimensions }) },
    knownScale: null,
    sourceDpi: null,
    roomAreaProbe: () => null,
  });
}

describe('ADR-929 Φ4 — σάρωση → Φ1 → Φ2 → σύντηξη', () => {
  it('η κλίμακα βγαίνει από τις διαστάσεις με σφάλμα < 0,5%, όλες συνεπείς, κάθε τιμή ≤ 10 mm από την αλήθεια', () => {
    const r = run();
    expect(r.scale?.chosen).toBe('dimension-consensus');
    const truth = 1 / (PX_PER_MM * 1000);
    expect(Math.abs((r.scale?.metresPerOriginalPx ?? 0) / truth - 1)).toBeLessThan(0.005);
    expect(r.dimensions.map((d) => d.status)).toEqual(['consistent', 'consistent', 'consistent', 'consistent', 'consistent']);
    for (const d of r.dimensions) expect(Math.abs((d.measuredMm ?? 0) - d.valueMm)).toBeLessThanOrEqual(10);
    expect(r.questions).toEqual([]);
  });

  it('η διπλή υπόθεση της Φ2 ανά πινελιά (1,8 px) ενώνεται: 10 ευθείες για 10 παρειές', () => {
    expect(run().faceLines).toHaveLength(10);
  });

  it('🔴 λάθος γραμμένη τιμή στη σάρωση ⇒ σύγκρουση γι’ αυτήν, με τη μετρημένη τιμή κοντά στην αλήθεια', () => {
    const r = run({ id: 't-west', raw: '2.90', valueMm: 2900 });
    const west = r.dimensions.find((d) => d.textId === 't-west');
    expect(west?.status).toBe('conflict');
    expect(Math.abs((west?.measuredMm ?? 0) - 3325)).toBeLessThan(60);
    expect(r.questions[0].kind).toBe('dimension-conflict');
  });
});
