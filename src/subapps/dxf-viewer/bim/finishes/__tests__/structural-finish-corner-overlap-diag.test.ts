/**
 * ADR-534 Φ7c — Γνήσια 45° miters ΕΝΣΩΜΑΤΩΜΕΝΑ στο ενιαίο welded mesh (γωνίες κτιρίου ΚΑΙ λαμπάδες).
 *
 * ΠΡΙΝ (Φ7b wedges): body στο core-length + ξεχωριστά τριγωνικά prisms → coincident face → artifacts.
 * ΤΩΡΑ (Φ7c): κανένα wedge. Το **back-cap** (outer παρειά) κάθε όψης σπρώχνεται σε **κάθε κάθετη γωνία**
 * (t-άκρο Ή χείλος τρύπας) ώστε το outer να φτάσει την κοινή mitered κορυφή, ενώ το front (core) μένει →
 * 45° miter ΜΕΣΑ στο ίδιο extrude. Καλύπτει ΚΑΙ τις γωνίες κτιρίου ΚΑΙ τα **χείλη ανοιγμάτων** (λαμπάδες).
 */

import { mergeSilhouetteBandsToStripGroups, type FinishStrip, type FinishStripGroup } from '../structural-finish-vertical-merge';
import { buildFaceProfiles, computeFaceMiterShifts, type FaceProfile } from '../structural-finish-face-profile';
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
 * Plan point (scene units) της γωνιακής κορυφής **του back-cap** (outer, u=πάχος) ή **front-cap** (core,
 * u=0) ενός profile, στο δοθέν miter shift, ΜΕΤΑ το shift. Αναπαράγει τη χαρτογράφηση του extrude:
 * p = originCore + (tM + δ)·dir + u·perp (το `perp` = καθαρό axis-normal → μηδέν skew).
 */
function capCorner(p: FaceProfile, shiftIdx: number, face: 'core' | 'outer'): Pt2 {
  const sh = p.miter[shiftIdx];
  const dM = face === 'outer' ? sh.deltaM : 0;
  const tScene = (sh.tM + dM) / SCENE_TO_M;
  const uScene = face === 'outer' ? p.thicknessM / SCENE_TO_M : 0;
  return {
    x: p.originCoreScene.x + tScene * p.dir.x + uScene * p.perp.x,
    y: p.originCoreScene.y + tScene * p.dir.y + uScene * p.perp.y,
  };
}

const byAxis = (profiles: FaceProfile[], axis: 'x' | 'y'): FaceProfile =>
  profiles.find((p) => (axis === 'x' ? Math.abs(p.dir.x) : Math.abs(p.dir.y)) > 0.99)!;

describe('ADR-534 Φ7c — ενσωματωμένα 45° miters (back-cap shift, μηδέν wedge)', () => {
  describe('γωνία κτιρίου (L: Ν x[0,100] + Α y[0,100], κοινή γωνία (100,0))', () => {
    const groups = () =>
      mergeSilhouetteBandsToStripGroups(
        [mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 }), mkSeg({ x: 100, y: 0 }, { x: 100, y: 100 })], 0, 3000)],
        'mm',
      );

    it('κάθε όψη έχει ΕΝΑ miter (γωνία) — το ελεύθερο άκρο μένει square', () => {
      const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
      expect(profiles).toHaveLength(2);
      for (const p of profiles) expect(p.miter).toHaveLength(1);
    });

    it('το outer γωνιακό corner ΚΑΙ των δύο όψεων φτάνει τη ΚΟΙΝΗ mitered κορυφή (125,-25)', () => {
      const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
      for (const p of profiles) {
        const tip = capCorner(p, 0, 'outer');
        expect(tip.x).toBeCloseTo(125, 6);
        expect(tip.y).toBeCloseTo(-25, 6);
      }
    });

    it('το front (core) corner ΜΕΝΕΙ στο (100,0) — μόνο το back-cap κινείται', () => {
      const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
      for (const p of profiles) {
        const core = capCorner(p, 0, 'core');
        expect(core.x).toBeCloseTo(100, 6);
        expect(core.y).toBeCloseTo(0, 6);
      }
    });

    it('το perp είναι καθαρό axis-normal (μηδέν skew)', () => {
      const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
      const south = byAxis(profiles, 'x');
      const east = byAxis(profiles, 'y');
      expect(Math.abs(south.perp.y)).toBeCloseTo(1, 9);
      expect(Math.abs(east.perp.x)).toBeCloseTo(1, 9);
    });

    it('FREE END (μεμονωμένη όψη) → ΚΑΝΕΝΑ miter', () => {
      const profiles = buildFaceProfiles(
        mergeSilhouetteBandsToStripGroups([mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 })], 0, 3000)], 'mm'),
        SCENE_TO_M,
      );
      expect(profiles[0].miter).toHaveLength(0);
    });
  });

  describe('ΧΕΙΛΟΣ ΑΝΟΙΓΜΑΤΟΣ (openings fix): πρόσοψη-με-τρύπα ↔ λαμπάδα κλείνουν 45° συμπληρωματικά', () => {
    const seg: FinishFaceSegment = mkSeg({ x: 0, y: 0 }, { x: 1000, y: 0 });
    // Πρόσοψη (dir +x, outward −y) με το χείλος αριστερής λαμπάδας στο (1000,0)· η τρύπα είναι στο t>1000.
    const facade: FinishStripGroup = {
      seg, dir: { x: 1, y: 0 }, perp: { x: 0, y: -1 },
      strips: [{
        aCore: { x: 0, y: 0 }, bCore: { x: 1000, y: 0 },
        aOuter: { x: 0, y: -25 }, bOuter: { x: 1025, y: -25 }, // bOuter = mitered (χείλος τρύπας)
        seg, zBottomMm: 900, zTopMm: 2100,
      } satisfies FinishStrip],
    };
    // Λαμπάδα (dir +y, outward +x, full wall depth) — το facade-end της στο (1000,0) μοιράζεται τη κορυφή.
    const jamb: FinishStripGroup = {
      seg, dir: { x: 0, y: 1 }, perp: { x: 1, y: 0 },
      strips: [{
        aCore: { x: 1000, y: 0 }, bCore: { x: 1000, y: 250 },
        aOuter: { x: 1025, y: -25 }, bOuter: { x: 1025, y: 250 }, // aOuter = ΙΔΙΑ mitered κορυφή
        seg, zBottomMm: 900, zTopMm: 2100,
      } satisfies FinishStrip],
    };

    it('ΚΑΙ η πρόσοψη ΚΑΙ η λαμπάδα παίρνουν miter στη γωνία του ανοίγματος (όχι μόνο η μία)', () => {
      const shifts = computeFaceMiterShifts([facade, jamb], SCENE_TO_M);
      expect(shifts.get(facade)).toHaveLength(1); // χείλος τρύπας πρόσοψης
      expect(shifts.get(jamb)).toHaveLength(1);   // facade-end λαμπάδας
    });

    it('τα δύο back-cap corners φτάνουν την ΙΔΙΑ mitered κορυφή (1025,-25) → η γωνία κλείνει', () => {
      const [facadeProfile] = buildFaceProfiles([facade], SCENE_TO_M);
      // Ξαναϋπολογισμός με ΚΑΙ τα δύο groups (perp gate χρειάζεται το ένα να «δει» το άλλο):
      const profiles = buildFaceProfiles([facade, jamb], SCENE_TO_M);
      const fp = byAxis(profiles, 'x');
      const jp = byAxis(profiles, 'y');
      expect(fp.miter).toHaveLength(1);
      expect(jp.miter).toHaveLength(1);
      const facadeTip = capCorner(fp, 0, 'outer');
      const jambTip = capCorner(jp, 0, 'outer');
      for (const tip of [facadeTip, jambTip]) {
        expect(tip.x).toBeCloseTo(1025, 5);
        expect(tip.y).toBeCloseTo(-25, 5);
      }
      // Guard: μεμονωμένη η πρόσοψη (χωρίς τη λαμπάδα να τη «δει») → ΚΑΝΕΝΑ miter (perp gate).
      expect(facadeProfile.miter).toHaveLength(0);
    });

    it('τα front (core) corners μένουν στο (1000,0) — μόνο το back-cap κινείται', () => {
      const profiles = buildFaceProfiles([facade, jamb], SCENE_TO_M);
      for (const p of profiles) {
        const core = capCorner(p, 0, 'core');
        expect(core.x).toBeCloseTo(1000, 5);
        expect(core.y).toBeCloseTo(0, 5);
      }
    });
  });
});
