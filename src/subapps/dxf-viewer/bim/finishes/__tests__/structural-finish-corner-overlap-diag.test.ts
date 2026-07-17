/**
 * DIAGNOSTIC (Φ7b, 2026-07-18) — ΜΕΤΡΑ τη διπλή κάλυψη στη γωνία, μη μαντεύεις.
 *
 * Στόχος: ποσοτικοποίηση του corner double-coverage bug. Το `buildFaceProfiles` corner-join
 * επεκτείνει **ΚΑΙ ΤΙΣ ΔΥΟ** γειτονικές όψεις κατά το πάχος στο junction → τα δύο plan
 * footprints επικαλύπτονται σε ένα τετράγωνο ~πάχος×πάχος στη γωνία → ο σοβάς μπαίνει 2×.
 *
 * ΔΕΝ είναι fix — είναι μέτρηση. Μετά τον fix (single-owner / miter) το overlap → 0.
 */

import { mergeSilhouetteBandsToStripGroups } from '../structural-finish-vertical-merge';
import { buildFaceProfiles, type FaceProfile } from '../structural-finish-face-profile';
import type { SilhouetteBand } from '../structural-finish-silhouette';
import type { FinishFaceSegment } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const mkSeg = (a: Pt2, b: Pt2, extra: Partial<FinishFaceSegment> = {}): FinishFaceSegment => ({
  a, b, classification: 'exterior', materialId: 'mat-plaster-ext', thickness: 25,
  lengthM: Math.hypot(b.x - a.x, b.y - a.y), ...extra,
});
const mkBand = (segments: FinishFaceSegment[], zBottomMm: number, zTopMm: number): SilhouetteBand => ({
  faces: { segments, heightM: (zTopMm - zBottomMm) * 0.001, interiorAreaM2: 0, exteriorAreaM2: 0 },
  zBottomMm, zTopMm,
});

const SCENE_TO_M = 0.001;

/** Plan footprint (m) της εξωθημένης όψης: t-range (outer bbox) × perp[0,thickness], mapped σε world. */
function planFootprint(p: FaceProfile): { x0: number; x1: number; y0: number; y1: number } {
  const xs = p.polygons.flatMap((poly) => poly.outer.map((pt) => pt.x));
  const t0 = Math.min(...xs);
  const t1 = Math.max(...xs);
  const oM = { x: p.originCoreScene.x * SCENE_TO_M, y: p.originCoreScene.y * SCENE_TO_M };
  const corners: Pt2[] = [];
  for (const t of [t0, t1]) {
    for (const u of [0, p.thicknessM]) {
      corners.push({ x: oM.x + t * p.dir.x + u * p.perp.x, y: oM.y + t * p.dir.y + u * p.perp.y });
    }
  }
  const cxs = corners.map((c) => c.x);
  const cys = corners.map((c) => c.y);
  return { x0: Math.min(...cxs), x1: Math.max(...cxs), y0: Math.min(...cys), y1: Math.max(...cys) };
}

/** Επιφάνεια τομής δύο axis-aligned ορθογωνίων (m²). */
function overlapArea(
  a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number },
): number {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return w * h;
}

describe('DIAGNOSTIC Φ7b — corner double-coverage (μέτρηση overlap)', () => {
  it('L-γωνία (Ν+Α όψεις, πάχος 25mm) → overlap ≈ πάχος² (διπλή κάλυψη)', () => {
    const south = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const east = mkSeg({ x: 100, y: 0 }, { x: 100, y: 100 });
    const bands: SilhouetteBand[] = [mkBand([south, east], 0, 3000)];
    const profiles = buildFaceProfiles(mergeSilhouetteBandsToStripGroups(bands, 'mm'), SCENE_TO_M);

    expect(profiles).toHaveLength(2);
    const fpA = planFootprint(profiles[0]);
    const fpB = planFootprint(profiles[1]);
    const ov = overlapArea(fpA, fpB);

    const th = 0.025;
    // eslint-disable-next-line no-console
    console.log('[DIAG corner] footprintA=', fpA, 'footprintB=', fpB, 'overlap m²=', ov, 'thickness²=', th * th);

    // Η διπλή κάλυψη = ένα τετράγωνο ~πάχος×πάχος στη γωνία (μετρημένο ~312mm², της τάξης του πάχος²).
    // Μετά τον fix (single-owner / miter) το overlap ΠΡΕΠΕΙ να πέσει στο 0.
    expect(ov).toBeGreaterThan(0);
    expect(ov).toBeGreaterThan(0.5 * th * th * 0.9); // >~281mm² → σαφής διπλή κάλυψη, όχι numerical noise
  });
});
