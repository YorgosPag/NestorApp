/**
 * ADR-534 Φ7c — Γνήσιο 45° miter ΕΝΣΩΜΑΤΩΜΕΝΟ στο ενιαίο welded mesh (πρώην: ξεχωριστά wedges).
 *
 * ΠΡΙΝ (Φ7 corner-join): το welded body κάθε όψης επεκτεινόταν κατά το πάχος στη γωνία → double-coverage.
 * ΕΝΔΙΑΜΕΣΑ (Φ7b wedges): body στο core-length + ξεχωριστά τριγωνικά prisms → coincident face με το
 * square end-cap του body → z-fighting/artifact στην όψη.
 * ΤΩΡΑ (Φ7c): κανένα wedge. Το **back-cap** (outer παρειά, u=thicknessM) κάθε όψης σπρώχνεται στο t-άκρο
 * ώστε το outer corner να φτάσει τη **κοινή** mitered κορυφή (125,-25), ενώ το front (core) μένει στο
 * (100,0) → η πλευρική έδρα γίνεται διαγώνια = 45° miter ΜΕΣΑ στο ίδιο extrude. Μηδέν coincident face.
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

/**
 * Plan point (scene units) της γωνιακής κορυφής **του back-cap** (outer παρειά, u=πάχος) ή του
 * **front-cap** (core, u=0) ενός profile, στο δοθέν t-άκρο ('lo'|'hi'), ΜΕΤΑ το miter shift. Αναπαράγει
 * ακριβώς τη χαρτογράφηση του extrude: p = originCore + (t+δ)·dir + u·perp (το `perp` είναι πλέον
 * καθαρό axis-normal → μηδέν skew· ADR-534 Φ7c fix στο `outwardPerpOf`).
 */
function capCorner(p: FaceProfile, end: 'lo' | 'hi', face: 'core' | 'outer'): Pt2 {
  const tM = end === 'hi' ? p.miter.tHiM : p.miter.tLoM;
  const dM = face === 'outer' ? (end === 'hi' ? p.miter.deltaHiM : p.miter.deltaLoM) : 0;
  const tScene = (tM + dM) / SCENE_TO_M;
  const uScene = face === 'outer' ? p.thicknessM / SCENE_TO_M : 0;
  return {
    x: p.originCoreScene.x + tScene * p.dir.x + uScene * p.perp.x,
    y: p.originCoreScene.y + tScene * p.dir.y + uScene * p.perp.y,
  };
}

/** Το profile της όψης με τον δοθέντα κύριο άξονα ('x' = οριζόντια / 'y' = κατακόρυφη στο plan). */
const byAxis = (profiles: FaceProfile[], axis: 'x' | 'y'): FaceProfile =>
  profiles.find((p) => (axis === 'x' ? Math.abs(p.dir.x) : Math.abs(p.dir.y)) > 0.99)!;

describe('ADR-534 Φ7c — ενσωματωμένο 45° miter (back-cap shift, κοινή mitered κορυφή, μηδέν wedge)', () => {
  // Ν όψη x[0,100] (dir +x)· Α όψη y[0,100] στο x=100 (dir +y)· μοιράζονται τη γωνία (100,0).
  const groups = () =>
    mergeSilhouetteBandsToStripGroups(
      [mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 }), mkSeg({ x: 100, y: 0 }, { x: 100, y: 100 })], 0, 3000)],
      'mm',
    );

  it('ΚΑΙ οι δύο όψεις: το outer γωνιακό corner φτάνει τη ΚΟΙΝΗ mitered κορυφή (125,-25)', () => {
    const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
    expect(profiles).toHaveLength(2);
    const south = byAxis(profiles, 'x'); // dir +x, γωνία στο hi-άκρο (t=100)
    const east = byAxis(profiles, 'y');  // dir +y, γωνία στο lo-άκρο (t=0 τοπικό)

    const southTip = capCorner(south, 'hi', 'outer');
    const eastTip = capCorner(east, 'lo', 'outer');
    for (const tip of [southTip, eastTip]) {
      expect(tip.x).toBeCloseTo(125, 6);
      expect(tip.y).toBeCloseTo(-25, 6);
    }
  });

  it('το front (core) γωνιακό corner ΜΕΝΕΙ στο (100,0) — δεν επεκτείνεται (μόνο το back-cap κινείται)', () => {
    const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
    const southCore = capCorner(byAxis(profiles, 'x'), 'hi', 'core');
    const eastCore = capCorner(byAxis(profiles, 'y'), 'lo', 'core');
    for (const core of [southCore, eastCore]) {
      expect(core.x).toBeCloseTo(100, 6);
      expect(core.y).toBeCloseTo(0, 6);
    }
  });

  it('τα miter deltas: γωνία = μη-μηδενικό (έξω)· ελεύθερο άκρο = 0 (square)', () => {
    const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
    const south = byAxis(profiles, 'x');
    const east = byAxis(profiles, 'y');
    expect(south.miter.deltaHiM).toBeCloseTo(0.025, 6); // γωνία (t=100) → +25mm έξω
    expect(south.miter.deltaLoM).toBeCloseTo(0, 9);     // ελεύθερο a-άκρο → 0
    expect(east.miter.deltaLoM).toBeCloseTo(-0.025, 6); // γωνία (t=0) → −25mm έξω
    expect(east.miter.deltaHiM).toBeCloseTo(0, 9);      // ελεύθερο άνω άκρο → 0
  });

  it('το perp είναι πλέον καθαρό axis-normal (μηδέν skew) και για τις δύο όψεις', () => {
    const profiles = buildFaceProfiles(groups(), SCENE_TO_M);
    const south = byAxis(profiles, 'x');
    const east = byAxis(profiles, 'y');
    expect(Math.abs(south.perp.x)).toBeCloseTo(0, 9); // ⊥ στο dir +x → (0,±1)
    expect(Math.abs(south.perp.y)).toBeCloseTo(1, 9);
    expect(Math.abs(east.perp.x)).toBeCloseTo(1, 9);  // ⊥ στο dir +y → (±1,0)
    expect(Math.abs(east.perp.y)).toBeCloseTo(0, 9);
  });

  it('FREE END (κανένας γείτονας) → ΚΑΝΕΝΑ miter (deltas = 0, square)', () => {
    const profiles = buildFaceProfiles(
      mergeSilhouetteBandsToStripGroups([mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 })], 0, 3000)], 'mm'),
      SCENE_TO_M,
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0].miter.deltaLoM).toBeCloseTo(0, 9);
    expect(profiles[0].miter.deltaHiM).toBeCloseTo(0, 9);
  });
});
