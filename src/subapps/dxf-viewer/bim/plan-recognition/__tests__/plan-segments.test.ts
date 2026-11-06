/**
 * ADR-929 Φ2 — από την εικόνα στους τοίχους, από άκρη σε άκρη: συνθετικό σχέδιο → ευθυγράμμιση (Φ1) → τμήματα →
 * σκηνή (μόνο μέσω `rasterPixelToScene`) → το **αμετάβλητο** `computeWallProposal` με τη στρατηγική ζευγών.
 * Η αλήθεια είναι οι `SyntheticWall` σε mm. Τα όρια είναι τα **μετρημένα** της Φ2 (§6.3), σε px της εικόνας.
 *
 * ⚠️ Οι χρόνοι εδώ δεν μετρούν (§6.2 #5). Μετρήθηκαν σε Node + SWC.
 */

import { describe, expect, it } from '@jest/globals';
import type { Point2D } from '../../../rendering/types/Types';
import { proposeConfirmed } from '../../model-from-drawing/__tests__/confirmed-proposal';
import { alignPlan } from '../alignment/align-plan';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import { rasterParallelPairStrategy, withRasterSegments } from '../segments/raster-segments-to-scene';
import {
  renderSyntheticPlan,
  SAMPLE_HOUSE_OPENING_OBLIQUE_WALLS,
  SAMPLE_HOUSE_WALLS,
  type SyntheticPlanSpec,
  type SyntheticWall,
} from '../testing/synthetic-plan-raster';

const PX_PER_MM = 0.06; // ~1:100 σε 150 dpi: τοίχος 25 cm = 15 px, πινελιά 2 px
const OLD_SCAN = { seed: 42, noiseAmplitude: 25, yellowing: 0.8 };
const BASE: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX_PER_MM, marginMm: 600, wallStyle: 'outlined', strokePx: 2, rotationDeg: 0, degradation: null,
};

interface Measured {
  readonly found: number;
  readonly matched: number;
  readonly maxAxisPx: number;
  readonly maxThicknessPx: number;
}

/** Μέσο σφάλμα των δύο άκρων, στην καλύτερη φορά. */
function axisError(a: Point2D, b: Point2D, t: SyntheticWall): number {
  const d = (p: Point2D, q: Point2D) => Math.hypot(p.x - q.x, p.y - q.y);
  return Math.min(d(a, t.start) + d(b, t.end), d(a, t.end) + d(b, t.start)) / 2;
}

function measure(spec: SyntheticPlanSpec): Measured {
  const plan = renderSyntheticPlan(spec);
  const aligned = alignPlan(plan.image);
  const metresPerPixel = mmToSceneUnits('m') / spec.pxPerMm;
  const minFillPx = minFillPxFor(aligned, { metresPerPixelX: metresPerPixel, metresPerPixelY: metresPerPixel, source: 'gallery-scale' });
  const { segments } = extractPlanSegments(aligned, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const lines = withRasterSegments([], () => null, segments, plan.placement);
  const strategy = rasterParallelPairStrategy(plan.placement, 'mm');
  // Οι τοίχοι μετά την επιβεβαίωση των ομάδων πάχους (ADR-929 Φ5.2ε): εδώ κρίνεται η γεωμετρία που χτίζεται.
  const walls = proposeConfirmed({ ...lines, sceneUnits: 'mm', levelId: 'lvl', strategy }).walls;
  let maxAxis = 0;
  let maxThickness = 0;
  let matched = 0;
  for (const truth of spec.walls) {
    const best = walls
      .map((w) => ({ w, e: axisError(w.params.start, w.params.end, truth) }))
      .sort((p, q) => p.e - q.e)[0];
    if (!best || best.e > 2 * truth.thicknessMm) continue;
    matched += 1;
    maxAxis = Math.max(maxAxis, best.e);
    maxThickness = Math.max(maxThickness, Math.abs(best.w.params.thickness - truth.thicknessMm));
  }
  return { found: walls.length, matched, maxAxisPx: maxAxis * spec.pxPerMm, maxThicknessPx: maxThickness * spec.pxPerMm };
}

describe('ADR-929 Φ2 — εικόνα → τοίχοι (μετρημένα όρια)', () => {
  it.each([
    ['περίγραμμα, ίσιο, παλιά σάρωση', { ...BASE, degradation: OLD_SCAN }],
    ['περίγραμμα, στραβό 1,3°', { ...BASE, rotationDeg: 1.3 }],
    ['poché, στραβό 1,3°, παλιά σάρωση', { ...BASE, wallStyle: 'filled', rotationDeg: 1.3, degradation: OLD_SCAN }],
    ['poché, στραβό −11°', { ...BASE, wallStyle: 'filled', rotationDeg: -11 }],
  ] as const)('%s: όλοι οι τοίχοι, κανένας ψευδής, άξονας ≤ 1 px, πάχος ≤ 1 px', (_name, spec) => {
    const m = measure(spec);
    expect({ found: m.found, matched: m.matched }).toEqual({ found: 5, matched: 5 });
    expect(m.maxAxisPx).toBeLessThanOrEqual(1);
    expect(m.maxThicknessPx).toBeLessThanOrEqual(1.05); // 1 px = η κβάντωση της ίδιας της αλήθειας (§6.3)
  });

  it('λοξός γεμάτος τοίχος 45° + άνοιγμα 900 mm: 7/7, ο λοξός κρατά τη γωνία του', () => {
    const m = measure({ ...BASE, walls: SAMPLE_HOUSE_OPENING_OBLIQUE_WALLS, wallStyle: 'filled' });
    expect({ found: m.found, matched: m.matched }).toEqual({ found: 7, matched: 7 });
    expect(m.maxAxisPx).toBeLessThanOrEqual(1);
  });

  // §6.3 #6: οι τέσσερις περιπτώσεις άκρων που έμεναν ανοιχτές (5,4–8,7 px πριν). Ρίζα: τα άκρα της πινελιάς —
  // διάμεσος 2 γραμμών = μέσος όρος, λοξή πινελιά από το υπόλοιπο μελάνι, κρόσσι της κάθετης.
  it.each([
    ['σπίτι, περίγραμμα, −11°, παλιά σάρωση', { ...BASE, rotationDeg: -11, degradation: OLD_SCAN }, 5],
    ['λοξός 45°, περίγραμμα, ίσιο', { ...BASE, walls: SAMPLE_HOUSE_OPENING_OBLIQUE_WALLS }, 7],
    ['λοξός 45°, περίγραμμα, 1,3°', { ...BASE, walls: SAMPLE_HOUSE_OPENING_OBLIQUE_WALLS, rotationDeg: 1.3 }, 7],
    ['λοξός 45°, περίγραμμα, −11°, παλιά σάρωση', {
      ...BASE, walls: SAMPLE_HOUSE_OPENING_OBLIQUE_WALLS, rotationDeg: -11, degradation: OLD_SCAN,
    }, 7],
  ] as const)('%s: όλοι οι τοίχοι, κανένας ψευδής, άξονας ≤ 1 px', (_name, spec, count) => {
    const m = measure(spec);
    expect({ found: m.found, matched: m.matched }).toEqual({ found: count, matched: count });
    expect(m.maxAxisPx).toBeLessThanOrEqual(1);
  });

  it('περιγραμμένο σπίτι χωρίς πλαίσιο, ίσιο: ο εξωτερικός τοίχος ΔΕΝ διαβάζεται ως πλαίσιο φύλλου', () => {
    const aligned = alignPlan(renderSyntheticPlan(BASE).image);
    expect(aligned.sheet?.frame).toBeNull();
  });
});
