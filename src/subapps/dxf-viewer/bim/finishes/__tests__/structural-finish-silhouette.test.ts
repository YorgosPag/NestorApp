/**
 * ADR-449 Slice 7 — structural-finish-silhouette tests.
 *
 * Καλύπτει το κρίσιμο: (Β) ένωση δομικών cores ανά ζώνη → ΕΝΑ outline (μηδέν internal
 * seam), (Α) τοίχος-obstacle αφαιρεί το καλυμμένο τμήμα (coplanarity), band decomposition,
 * regression μεμονωμένου μέλους.
 */

import {
  computeStructuralSilhouetteBands,
  type SilhouetteInput,
  type SilhouetteMember,
  type WallObstacle,
} from '../structural-finish-silhouette';
import type { FinishEdgeClassifier } from '../structural-finish-resolver';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const allInterior: FinishEdgeClassifier = () => 'interior';

/** Ορθογώνιο footprint [x0,x1]×[y0,y1] (CCW). */
const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

/**
 * **CW** ορθογώνιο (signed-area<0) — μιμείται το beam `buildOutlineRect` outline. ΚΡΙΣΙΜΟ
 * regression: η `polygon-clipping` είναι winding-sensitive (CW ring = τρύπα) → το `safeUnion`
 * δεν θα ένωνε το δοκάρι με την κολώνα αν δεν κανονικοποιούσαμε σε CCW (ο σοβάς έβγαινε
 * εντός σώματος — Giorgio 2026-06-13).
 */
const cwRect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
  { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }, { x: x0, y: y0 },
];

const member = (footprint: Pt2[], zBotMm: number, zTopMm: number): SilhouetteMember => ({ footprint, zBotMm, zTopMm });

/** Τοίχοι ως full-range z-extent (επικαλύπτουν όλες τις ζώνες — non-height-aware συμπεριφορά). */
const baseInput = (members: SilhouetteMember[], wallObstacles: Pt2[][] = []): SilhouetteInput => ({
  members,
  wallObstacles: wallObstacles.map((footprint) => ({ footprint, zBotMm: -1e9, zTopMm: 1e9 })),
  spec: SPEC,
  classify: allInterior,
  unitToMeters: 1, // lengthM = canvas length
});

/** Σ μηκών όλων των segments μιας ζώνης. */
const totalLength = (segments: readonly { lengthM: number }[]): number =>
  segments.reduce((s, seg) => s + seg.lengthM, 0);

describe('computeStructuralSilhouetteBands', () => {
  it('disabled spec → κενό', () => {
    const out = computeStructuralSilhouetteBands({
      ...baseInput([member(rect(0, 0, 50, 50), 0, 3000)]),
      spec: { ...SPEC, enabled: false },
    });
    expect(out).toHaveLength(0);
  });

  it('μεμονωμένο μέλος → 1 band, 4 segments, πλήρης περίμετρος (regression)', () => {
    const out = computeStructuralSilhouetteBands(baseInput([member(rect(0, 0, 50, 50), 0, 3000)]));
    expect(out).toHaveLength(1);
    expect(out[0].zBottomMm).toBe(0);
    expect(out[0].zTopMm).toBe(3000);
    expect(out[0].faces.segments).toHaveLength(4);
    expect(totalLength(out[0].faces.segments)).toBeCloseTo(200); // περίμετρος 50×4
  });

  it('Β: δύο επικαλυπτόμενα cores → ΕΝΑ outline (μηδέν internal seam στο x=50)', () => {
    // A=[0,50]² , B=[49,100]×[0,50] → union = ορθογώνιο [0,100]×[0,50], περίμετρος 300.
    const out = computeStructuralSilhouetteBands(baseInput([
      member(rect(0, 0, 50, 50), 0, 3000),
      member(rect(49, 0, 100, 50), 0, 3000),
    ]));
    expect(out).toHaveLength(1);
    const segs = out[0].faces.segments;
    // Ενιαία περίμετρος 300 < 400 (= 200+200 ξεχωριστά) → η internal ακμή x=50 εξαφανίστηκε.
    expect(totalLength(segs)).toBeCloseTo(300, 1);
    const internal = segs.filter((s) => Math.abs(s.a.x - 50) < 1e-6 && Math.abs(s.b.x - 50) < 1e-6);
    expect(internal).toHaveLength(0);
  });

  it('Α: τοίχος-obstacle αφαιρεί την καλυμμένη παρειά (coplanarity)', () => {
    // wall καλύπτει την κάτω-παρειά (y=0) → κανένα segment εκεί.
    const out = computeStructuralSilhouetteBands(baseInput(
      [member(rect(0, 0, 50, 50), 0, 3000)],
      [rect(-5, -5, 55, 5)],
    ));
    expect(out).toHaveLength(1);
    const bottom = out[0].faces.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    expect(bottom).toHaveLength(0);
  });

  it('band decomposition: κολόνα [0,3000] + δοκάρι [2500,3000] → 2 ζώνες', () => {
    const out = computeStructuralSilhouetteBands(baseInput([
      member(rect(0, 0, 50, 50), 0, 3000),         // κολόνα όλο το ύψος
      member(rect(0, 20, 200, 30), 2500, 3000),    // δοκάρι ζώνη κορυφής
    ]));
    expect(out).toHaveLength(2);
    expect(out[0].zBottomMm).toBe(0);
    expect(out[0].zTopMm).toBe(2500);
    expect(out[1].zBottomMm).toBe(2500);
    expect(out[1].zTopMm).toBe(3000);
    // Κάτω ζώνη = μόνο κολόνα (περίμετρος 200)· πάνω ζώνη = union (μεγαλύτερη).
    expect(totalLength(out[0].faces.segments)).toBeCloseTo(200);
    expect(totalLength(out[1].faces.segments)).toBeGreaterThan(200);
  });

  it('CW δοκάρι (buildOutlineRect winding) ενώνεται με CCW κολώνα — ΟΧΙ εντός σώματος', () => {
    // Κολώνα [-25,25]² (CCW) + CW δοκάρι x∈[0,200] y∈[-10,10] στη ζώνη κορυφής.
    // Χωρίς CCW-normalisation η polygon-clipping θεωρεί το CW δοκάρι τρύπα → δεν ενώνει.
    const out = computeStructuralSilhouetteBands(baseInput([
      member(rect(-25, -25, 25, 25), 0, 3000),
      member(cwRect(0, -10, 200, 10), 2500, 3000),
    ]));
    expect(out).toHaveLength(2);
    const junction = out[1].faces.segments; // z 2500..3000 = union κολώνα+δοκάρι
    // Το δοκάρι ΕΝΩΘΗΚΕ: η μακρινή άκρη του (x=200) εμφανίζεται στο ενιαίο outline.
    expect(junction.some((s) => Math.abs(s.a.x - 200) < 1e-6 || Math.abs(s.b.x - 200) < 1e-6)).toBe(true);
    // Η εσωτερική διεπαφή (δεξιά παρειά κολώνας x=25, y∈[-10,10]) ΔΕΝ παίρνει σοβά (internal).
    const internalJunction = junction.filter(
      (s) => Math.abs(s.a.x - 25) < 1e-6 && Math.abs(s.b.x - 25) < 1e-6 &&
        Math.max(s.a.y, s.b.y) <= 10 + 1e-6 && Math.min(s.a.y, s.b.y) >= -10 - 1e-6,
    );
    expect(internalJunction).toHaveLength(0);
  });

  it('frame δοκαριών/κολώνων (τρύπα=δωμάτιο) → σοβάς ΚΑΙ στις εσωτερικές όψεις, φορά προς το δωμάτιο', () => {
    // 4 δοκάρια → annulus [0,100]² μείον τρύπα [30,70]². Inner όψεις = όψη δωματίου.
    const frame = [
      member(rect(0, 0, 100, 30), 0, 500),   // bottom
      member(rect(0, 70, 100, 100), 0, 500), // top
      member(rect(0, 30, 30, 70), 0, 500),   // left
      member(rect(70, 30, 100, 70), 0, 500), // right
    ];
    const out = computeStructuralSilhouetteBands(baseInput(frame));
    expect(out).toHaveLength(1);
    const segs = out[0].faces.segments;
    // Υπάρχουν εσωτερικές όψεις (στο όριο της τρύπας x∈{30,70} ή y∈{30,70}).
    const innerSegs = segs.filter((s) => {
      const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
      return (Math.abs(mx - 30) < 1e-6 || Math.abs(mx - 70) < 1e-6 || Math.abs(my - 30) < 1e-6 || Math.abs(my - 70) < 1e-6)
        && mx > 25 && mx < 75 && my > 25 && my < 75;
    });
    expect(innerSegs.length).toBeGreaterThan(0);
    // Η outward normal (dy,−dx) κάθε inner όψης δείχνει ΠΡΟΣ το κέντρο της τρύπας (50,50).
    for (const s of innerSegs) {
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
      const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
      const dot = dy * (50 - mx) + (-dx) * (50 - my); // (dy,−dx)·(center−mid)
      expect(dot).toBeGreaterThan(0); // ο σοβάς πάει ΜΕΣΑ στο δωμάτιο, όχι στο σώμα
    }
  });

  it('κανένα μέλος → κενό', () => {
    expect(computeStructuralSilhouetteBands(baseInput([]))).toHaveLength(0);
  });
});

describe('big-player σύμβαση: additive-outward σοβάς (immutable core, ΟΧΙ recess/bury)', () => {
  /** Μέγιστη εξωτερική όψη σοβά των **οριζόντιων** όψεων (top/bottom) ως προς το y. */
  const maxOuterFaceY = (segs: readonly { a: Pt2; b: Pt2; thickness: number }[]): number => {
    let m = -Infinity;
    for (const seg of segs) {
      if (Math.abs(seg.a.y - seg.b.y) > 1e-6) continue; // μόνο οριζόντιες
      const dx = seg.b.x - seg.a.x;
      const ny = -dx / Math.abs(dx); // outward ±y
      const midY = (seg.a.y + seg.b.y) / 2;
      m = Math.max(m, Math.abs(midY + ny * seg.thickness)); // unitToMeters=1 → thickness=canvas
    }
    return m;
  };

  it('δοκάρι ίδιου πλάτους με τοίχο → σοβάς additive ΕΞΩ (core+thickness, ορατός — ΟΧΙ buried)', () => {
    // Δοκάρι [−15,15] flush με τοίχο ίδιου πλάτους· ο σοβάς ΠΑΡΑΜΕΝΕΙ έξω (15+15=30), ορατός.
    const beam = rect(0, -15, 200, 15);
    const wall = [rect(0, -15, 200, 15)];
    const out = computeStructuralSilhouetteBands(baseInput([member(beam, 0, 500)], wall));
    expect(out).toHaveLength(1);
    // additive-outward: εξωτερική όψη = core 15 + thickness 15 = 30 (ΟΧΙ θαμμένος <15).
    expect(maxOuterFaceY(out[0].faces.segments)).toBeCloseTo(30, 0);
  });

  it('χωρίς τοίχο → ίδιο additive-outward (core+thickness)', () => {
    const beam = rect(0, -15, 200, 15);
    const out = computeStructuralSilhouetteBands(baseInput([member(beam, 0, 500)]));
    expect(out).toHaveLength(1);
    expect(maxOuterFaceY(out[0].faces.segments)).toBeCloseTo(30, 0);
  });
});

describe('ADR-449 Slice X1 — height-aware walls (grid coincident support, Firestore-shaped)', () => {
  // Mirror της σκηνής (Firestore): κολόνα 400×400 + κάθετο δοκάρι 250 **center-justified**
  // (inset 75 κάθε πλευρά) που καρφώνεται από κάτω (z 2500..3000) + τοίχος-στήριγμα
  // **ΤΑΥΤΟΣΗΜΟΣ σε κάτοψη** με το δοκάρι (grid framing), `topBinding:'attached'` → resolved
  // top = κάτω παρειά δοκαριού (z=2500). Αυτή ήταν η αιτία του «μία όψη μόνο» (Slice 7-revert).
  const column = member(rect(0, 0, 400, 400), 0, 3000);
  const beamTab = member(rect(75, -2000, 325, 0), 2500, 3000); // κρέμεται κάτω από την κολόνα
  const beamBandOf = (out: ReturnType<typeof computeStructuralSilhouetteBands>) =>
    out.find((b) => b.zBottomMm === 2500 && b.zTopMm === 3000);
  const makeInput = (walls: WallObstacle[]): SilhouetteInput => ({
    members: [column, beamTab],
    wallObstacles: walls,
    spec: SPEC,
    classify: allInterior,
    unitToMeters: 1,
  });
  /** Πλάγια όψη δοκαριού στο x=`fx` υπάρχει στο κάτω τμήμα (y<0). */
  const hasSideFace = (segs: readonly { a: Pt2; b: Pt2 }[], fx: number): boolean =>
    segs.some((s) => Math.abs(s.a.x - fx) < 1e-6 && Math.abs(s.b.x - fx) < 1e-6 && Math.min(s.a.y, s.b.y) < -1e-6);

  const supportWall: WallObstacle = { footprint: rect(75, -2000, 325, 0), zBotMm: 0, zTopMm: 2500 };

  it('attached support wall (z ≤ beam underside) ΔΕΝ καλύπτει τις όψεις δοκαριού στη ζώνη του → 2 όψεις', () => {
    const band = beamBandOf(computeStructuralSilhouetteBands(makeInput([supportWall])));
    expect(band).toBeDefined();
    expect(hasSideFace(band!.faces.segments, 75)).toBe(true);  // αριστερή όψη
    expect(hasSideFace(band!.faces.segments, 325)).toBe(true); // δεξιά όψη
  });

  it('contrast: full-height coincident wall (height-unaware) ΚΟΒΕΙ → λιγότερος σοβάς (το παλιό bug)', () => {
    const fullWall: WallObstacle = { footprint: rect(75, -2000, 325, 0), zBotMm: 0, zTopMm: 3000 };
    const lenOf = (walls: WallObstacle[]): number =>
      totalLength(beamBandOf(computeStructuralSilhouetteBands(makeInput(walls)))!.faces.segments);
    // Height-aware (excluded) → ΠΕΡΙΣΣΟΤΕΡΟΣ σοβάς από full-height (active coincident → κόβει όψη).
    expect(lenOf([supportWall])).toBeGreaterThan(lenOf([fullWall]));
  });

  it('συμβολή: η εσωτερική διεπαφή (κάτω παρειά κολόνας κάτω από το δοκάρι) ΔΕΝ παίρνει σοβά', () => {
    const band = beamBandOf(computeStructuralSilhouetteBands(makeInput([supportWall])))!;
    // y=0, x∈(75,325) = internal (μέσα στο ενιαίο union) → κανένα segment (μηδέν διπλο-σοβάτισμα).
    const internal = band.faces.segments.filter((s) =>
      Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6 &&
      Math.min(s.a.x, s.b.x) >= 75 - 1e-6 && Math.max(s.a.x, s.b.x) <= 325 + 1e-6);
    expect(internal).toHaveLength(0);
  });

  it('κάτω ζώνη κολόνας (χωρίς δοκάρι): ο support wall ΕΙΝΑΙ ενεργός (καλύπτει όπου είναι μπροστά)', () => {
    // Στη ζώνη [0,2500] μόνο η κολόνα υπάρχει· ο attached wall (z[0,2500]) επικαλύπτεται →
    // παραμένει obstacle (height-aware = σωστό ΚΑΙ για το κάτω τμήμα, όχι μόνο εξαίρεση).
    const out = computeStructuralSilhouetteBands(makeInput([supportWall]));
    const lower = out.find((b) => b.zBottomMm === 0 && b.zTopMm === 2500);
    expect(lower).toBeDefined();
    expect(lower!.faces.segments.length).toBeGreaterThan(0);
  });
});

describe('ADR-449 PART B Slice B — faceOverrideEdges (blanket per-face attribution)', () => {
  it('override στη μισή κάτω παρειά → split: χρωματισμένο κομμάτι + default (colorOverride φτάνει στο band)', () => {
    // Μέλος [0,100]×[0,50]· βάφουμε τη μισή κάτω παρειά (0,0)-(50,0) με χρώμα.
    const out = computeStructuralSilhouetteBands({
      ...baseInput([member(rect(0, 0, 100, 50), 0, 3000)]),
      faceOverrideEdges: [
        { a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, override: { colorOverride: '#c0d8b0' } },
      ],
    });
    expect(out).toHaveLength(1);
    const segs = out[0].faces.segments;
    // Χρωματισμένο κομμάτι στην κάτω παρειά (y=0, x∈[0,50]).
    const painted = segs.filter((s) => s.colorOverride === '#c0d8b0');
    expect(painted).toHaveLength(1);
    expect(Math.abs(painted[0].a.y)).toBeLessThan(1e-6);
    expect(Math.abs(painted[0].b.y)).toBeLessThan(1e-6);
    expect(painted[0].lengthM).toBeCloseTo(50);
    // Το υπόλοιπο κάτω κομμάτι (x∈[50,100]) μένει χωρίς χρώμα (default).
    const bottomUnpainted = segs.filter(
      (s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6 && !s.colorOverride,
    );
    expect(bottomUnpainted).toHaveLength(1);
    // BOQ ταυτότητα: περίμετρος αμετάβλητη (300).
    expect(totalLength(segs)).toBeCloseTo(300);
  });

  it('override materialId σε ΟΛΗ παρειά → ξεχωριστό segment (δεν ενώνεται με τις γειτονικές default)', () => {
    const out = computeStructuralSilhouetteBands({
      ...baseInput([member(rect(0, 0, 100, 50), 0, 3000)]),
      faceOverrideEdges: [
        { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
      ],
    });
    const gypsum = out[0].faces.segments.filter((s) => s.materialId === 'mat-gypsum-board');
    expect(gypsum).toHaveLength(1);
    expect(gypsum[0].lengthM).toBeCloseTo(100);
  });

  it('κενά faceOverrideEdges → byte-for-byte (μηδέν regression)', () => {
    const withEmpty = computeStructuralSilhouetteBands({
      ...baseInput([member(rect(0, 0, 50, 50), 0, 3000)]),
      faceOverrideEdges: [],
    });
    const without = computeStructuralSilhouetteBands(baseInput([member(rect(0, 0, 50, 50), 0, 3000)]));
    expect(withEmpty).toEqual(without);
  });
});

describe('ADR-449 — flush column↔column union (Firestore-shaped, float-drift weld)', () => {
  // Οι ΑΚΡΙΒΕΙΣ footprints των δύο κολόνων σε σχήμα L (Firestore, mm). Οι παρειές επαφής
  // διαφέρουν κατά ~9e-13mm (float noise «από κάναβο») → χωρίς weld η polygon-clipping ΔΕΝ
  // τις ενώνει → ορατή ραφή σοβά στη θαμμένη διεπαφή (Giorgio 2026-06-23, screenshots).
  const colA: Pt2[] = [
    { x: 901.3878188660065, y: 250.00000000004593 },
    { x: 901.3878188660065, y: 1250.0000000000605 },
    { x: 651.3878188660065, y: 1250.0000000000605 },
    { x: 651.3878188660065, y: 250.00000000004593 },
  ];
  const colB: Pt2[] = [
    { x: 1651.387818866, y: 500.0000000000454 },
    { x: 901.3878188660074, y: 500.00000000004553 },
    { x: 901.3878188660074, y: 250.00000000004553 },
    { x: 1651.387818866, y: 250.00000000004542 },
  ];
  const IFACE_X = 901.3878188660065;

  it('οι δύο flush κολόνες ΕΝΩΝΟΝΤΑΙ σε ΕΝΑ L-outline (μηδέν internal seam)', () => {
    const out = computeStructuralSilhouetteBands(baseInput([
      member(colA, 0, 3000),
      member(colB, 0, 3000),
    ]));
    expect(out).toHaveLength(1);
    const segs = out[0].faces.segments;
    // Ενιαία περίμετρος L = 4000· δύο ξεχωριστά = 4500 (η ραφή 250 μετριέται 2×). Το 4000 ⇒ ένωση.
    expect(totalLength(segs)).toBeCloseTo(4000, 0);
    // Καμία όψη πάνω στη θαμμένη διεπαφή (x≈901.39, y∈[250,500]).
    const seam = segs.filter((s) =>
      Math.abs(s.a.x - IFACE_X) < 1e-3 && Math.abs(s.b.x - IFACE_X) < 1e-3 &&
      Math.min(s.a.y, s.b.y) >= 250 - 1 && Math.max(s.a.y, s.b.y) <= 500 + 1);
    expect(seam).toHaveLength(0);
  });

  it('η μακρινή ακμή της Β (x≈1651) ΠΑΡΑΜΕΝΕΙ στο ενιαίο outline (η ένωση δεν έφαγε γεωμετρία)', () => {
    const out = computeStructuralSilhouetteBands(baseInput([member(colA, 0, 3000), member(colB, 0, 3000)]));
    const segs = out[0].faces.segments;
    expect(segs.some((s) => Math.abs(s.a.x - 1651.387818866) < 1e-3 || Math.abs(s.b.x - 1651.387818866) < 1e-3)).toBe(true);
  });
});
