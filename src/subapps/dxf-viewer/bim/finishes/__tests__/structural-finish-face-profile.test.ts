/**
 * ADR-449/534 Φ7 — `buildFaceProfile` tests: τα strips μιας ομοεπίπεδης όψης ενώνονται σε ΕΝΑ
 * (t,z) πολύγωνο· τα ανοίγματα γίνονται **τρύπες** (όχι ξεχωριστά prisms) → μηδέν εσωτερική ραφή.
 */

import {
  mergeSilhouetteBandsToStripGroups,
} from '../structural-finish-vertical-merge';
import { buildFaceProfiles, type FaceProfilePolygon } from '../structural-finish-face-profile';
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
const xSeg = (x0: number, x1: number): FinishFaceSegment => mkSeg({ x: x0, y: 0 }, { x: x1, y: 0 });

const SCENE_TO_M = 0.001; // 'mm' scene units → μέτρα

const bbox = (ring: readonly { x: number; y: number }[]) => {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

describe('ADR-449/534 Φ7 — buildFaceProfile: unified όψη με τρύπα στο άνοιγμα', () => {
  it('πρόσοψη 300mm + 1 παράθυρο + φάσα → 1 profile, 1 πολύγωνο, 1 τρύπα (το παράθυρο)', () => {
    const bands: SilhouetteBand[] = [
      mkBand([xSeg(0, 300)], 0, 1000),
      mkBand([xSeg(0, 100), xSeg(200, 300)], 1000, 2200), // παράθυρο x[100,200] z[1000,2200]
      mkBand([xSeg(0, 300)], 2200, 3000),
      mkBand([xSeg(0, 300)], 3000, 3150),
    ];
    const groups = mergeSilhouetteBandsToStripGroups(bands, 'mm');
    const profiles = buildFaceProfiles(groups, SCENE_TO_M);

    expect(profiles).toHaveLength(1);            // ΜΙΑ ομοεπίπεδη όψη
    expect(profiles[0].polygons).toHaveLength(1); // ΕΝΑ συνεχές δέρμα (όχι 4 prisms)
    const poly: FaceProfilePolygon = profiles[0].polygons[0];
    expect(poly.holes).toHaveLength(1);          // το παράθυρο = πραγματική τρύπα

    // outer bbox = όλη η όψη 0.3m × 3.15m
    const ob = bbox(poly.outer);
    expect(ob.x0).toBeCloseTo(0, 6);
    expect(ob.x1).toBeCloseTo(0.3, 6);
    expect(ob.y0).toBeCloseTo(0, 6);
    expect(ob.y1).toBeCloseTo(3.15, 6);

    // hole bbox = το παράθυρο t[0.1,0.2] × z[1.0,2.2]
    const hb = bbox(poly.holes[0]);
    expect(hb.x0).toBeCloseTo(0.1, 6);
    expect(hb.x1).toBeCloseTo(0.2, 6);
    expect(hb.y0).toBeCloseTo(1.0, 6);
    expect(hb.y1).toBeCloseTo(2.2, 6);

    expect(profiles[0].thicknessM).toBeCloseTo(0.025, 9); // 25mm
  });

  it('CONTROL: συνεχής όψη χωρίς άνοιγμα → 1 profile, 1 πολύγωνο, 0 τρύπες', () => {
    const bands: SilhouetteBand[] = [
      mkBand([xSeg(0, 300)], 0, 1500),
      mkBand([xSeg(0, 300)], 1500, 3000),
    ];
    const profiles = buildFaceProfiles(mergeSilhouetteBandsToStripGroups(bands, 'mm'), SCENE_TO_M);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].polygons).toHaveLength(1);
    expect(profiles[0].polygons[0].holes).toHaveLength(0);
  });

  it('δύο διαφορετικές όψεις (Β + Δ γωνία) → 2 profiles (γωνία = πραγματική ραφή, όχι εσωτερική)', () => {
    const north = mkSeg({ x: 0, y: 50 }, { x: 50, y: 50 });
    const west = mkSeg({ x: 0, y: 0 }, { x: 0, y: 50 });
    const bands: SilhouetteBand[] = [
      mkBand([north, west], 0, 1500),
      mkBand([north, west], 1500, 3000),
    ];
    const profiles = buildFaceProfiles(mergeSilhouetteBandsToStripGroups(bands, 'mm'), SCENE_TO_M);
    expect(profiles).toHaveLength(2); // κάθε όψη = δικό της welded δέρμα
    expect(profiles.every((p) => p.polygons.length === 1 && p.polygons[0].holes.length === 0)).toBe(true);
  });

  const tSpan = (ring: readonly { x: number; y: number }[]): number => {
    const xs = ring.map((p) => p.x);
    return Math.max(...xs) - Math.min(...xs);
  };

  it('CORNER-MITER (Φ7b): L-γωνία (Ν+Α όψεις) → body στο core-length (καμία επέκταση· η γωνία = wedges)', () => {
    // Ν όψη x[0,100] (dir +x)· Α όψη y[0,100] στο x=100 (dir +y)· μοιράζονται τη γωνία (100,0).
    const south = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const east = mkSeg({ x: 100, y: 0 }, { x: 100, y: 100 });
    const bands: SilhouetteBand[] = [mkBand([south, east], 0, 3000)];
    const profiles = buildFaceProfiles(mergeSilhouetteBandsToStripGroups(bands, 'mm'), SCENE_TO_M);
    expect(profiles).toHaveLength(2);
    // Φ7b: το welded body ΔΕΝ επεκτείνεται πλέον (ήταν 0.125 με το παλιό overlap corner-join) → 0.1m
    // core-length· τη γωνία τη γεμίζει το miter wedge (βλ. structural-finish-corner-overlap-diag).
    for (const p of profiles) {
      expect(tSpan(p.polygons[0].outer)).toBeCloseTo(0.1, 6);
    }
  });

  it('FREE END: μεμονωμένη όψη (κανένας γείτονας) → ΚΑΜΙΑ επέκταση (μηδέν nub)', () => {
    const bands: SilhouetteBand[] = [mkBand([xSeg(0, 100)], 0, 3000)];
    const profiles = buildFaceProfiles(mergeSilhouetteBandsToStripGroups(bands, 'mm'), SCENE_TO_M);
    expect(profiles).toHaveLength(1);
    expect(tSpan(profiles[0].polygons[0].outer)).toBeCloseTo(0.1, 6); // 100mm, αμετάβλητο
  });

  it('COLLINEAR (αλλαγή υλικού στην ίδια ευθεία) → ΚΑΜΙΑ επέκταση (η ραφή υλικού μένει)', () => {
    const a = xSeg(0, 100); // mat-plaster-ext
    const b = mkSeg({ x: 100, y: 0 }, { x: 200, y: 0 }, { materialId: 'mat-gypsum-board' });
    const bands: SilhouetteBand[] = [mkBand([a, b], 0, 3000)];
    const profiles = buildFaceProfiles(mergeSilhouetteBandsToStripGroups(bands, 'mm'), SCENE_TO_M);
    expect(profiles).toHaveLength(2); // δύο υλικά = δύο groups (collinear, ίδιος άξονας)
    // Κανένα δεν επεκτείνεται στο κοινό σημείο (100,0) — παράλληλοι άξονες → όχι γωνία.
    for (const p of profiles) {
      expect(tSpan(p.polygons[0].outer)).toBeCloseTo(0.1, 6);
    }
  });
});
