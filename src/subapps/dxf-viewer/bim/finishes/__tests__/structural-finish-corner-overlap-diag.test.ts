/**
 * ADR-534 Φ7b — Corner miter regression (πρώην diagnostic double-coverage).
 *
 * ΠΡΙΝ (Φ7 corner-join): το welded body κάθε όψης επεκτεινόταν κατά το πάχος στη γωνία → τα δύο
 * plan footprints επικαλύπτονταν ~πάχος×πάχος → σοβάς 2× (μετρήθηκε ~312mm²).
 * ΤΩΡΑ (Φ7b true 45° miter): το body τελειώνει στο core-length (μηδέν overlap) και η γωνία γεμίζει
 * με δύο miter wedges (ένα ανά όψη) που συναντιούνται στην κοινή mitered κορυφή → μονή κάλυψη.
 */

import { mergeSilhouetteBandsToStripGroups } from '../structural-finish-vertical-merge';
import { buildFaceProfiles, collectMiterWedges, type FaceProfile } from '../structural-finish-face-profile';
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

/**
 * Plan footprint (m) του welded body: t-range (outer bbox) × perp[0,thickness]. Το perp παράγεται
 * από το `dir` (καθαρό axis normal, στην πλευρά του outer) — ΟΧΙ το `p.perp` (που σε πολύ κοντές
 * όψεις είναι διαγώνιο λόγω `outwardPerpOf` mid-points → bbox artifact). Απομονώνει το t-extension,
 * που ήταν η αιτία του double-coverage (Φ7b: αφαιρέθηκε).
 */
function planFootprint(p: FaceProfile): { x0: number; x1: number; y0: number; y1: number } {
  const xs = p.polygons.flatMap((poly) => poly.outer.map((pt) => pt.x));
  const t0 = Math.min(...xs);
  const t1 = Math.max(...xs);
  const oM = { x: p.originCoreScene.x * SCENE_TO_M, y: p.originCoreScene.y * SCENE_TO_M };
  const nRaw = { x: -p.dir.y, y: p.dir.x };
  const side = p.perp.x * nRaw.x + p.perp.y * nRaw.y >= 0 ? 1 : -1;
  const perp = { x: nRaw.x * side, y: nRaw.y * side };
  const corners: Pt2[] = [];
  for (const t of [t0, t1]) {
    for (const u of [0, p.thicknessM]) {
      corners.push({ x: oM.x + t * p.dir.x + u * perp.x, y: oM.y + t * p.dir.y + u * perp.y });
    }
  }
  const cxs = corners.map((c) => c.x);
  const cys = corners.map((c) => c.y);
  return { x0: Math.min(...cxs), x1: Math.max(...cxs), y0: Math.min(...cys), y1: Math.max(...cys) };
}

function overlapArea(
  a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number },
): number {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return w * h;
}

describe('ADR-534 Φ7b — corner miter (μηδέν double-coverage, κοινή mitered κορυφή)', () => {
  const groups = () =>
    mergeSilhouetteBandsToStripGroups(
      [mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 }), mkSeg({ x: 100, y: 0 }, { x: 100, y: 100 })], 0, 3000)],
      'mm',
    );

  it('τα welded bodies ΔΕΝ επικαλύπτονται πλέον στη γωνία (overlap ≈ 0)', () => {
    const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
    expect(profiles).toHaveLength(2);
    const ov = overlapArea(planFootprint(profiles[0]), planFootprint(profiles[1]));
    expect(ov).toBeLessThan(1e-9); // ήταν ~3.1e-4 m² (312mm²) πριν τον fix
  });

  it('η γωνία γεμίζει με 2 miter wedges που δείχνουν στην κοινή mitered κορυφή (125,-25)', () => {
    const wedges = collectMiterWedges(groups());
    expect(wedges).toHaveLength(2); // ένα ανά όψη (Ν + Α)
    for (const w of wedges) {
      expect(w.tip.x).toBeCloseTo(125, 6);
      expect(w.tip.y).toBeCloseTo(-25, 6);
      expect(w.core.x).toBeCloseTo(100, 6); // κοινή γωνιακή κορυφή πυρήνα
      expect(w.core.y).toBeCloseTo(0, 6);
      expect(w.zBottomMm).toBe(0);
      expect(w.zTopMm).toBe(3000);
    }
    // Τα δύο wedges = εκατέρωθεν της διαγωνίου (core→tip): διαφορετικά mid (το ένα (100,-25), το άλλο (125,0)).
    const mids = wedges.map((w) => `${Math.round(w.mid.x)},${Math.round(w.mid.y)}`).sort();
    expect(mids).toEqual(['100,-25', '125,0']);
  });

  it('FREE END (κανένας γείτονας) → ΚΑΝΕΝΑ wedge (η γωνία δεν υπάρχει)', () => {
    const g = mergeSilhouetteBandsToStripGroups([mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 })], 0, 3000)], 'mm');
    expect(collectMiterWedges(g)).toHaveLength(0);
  });
});
