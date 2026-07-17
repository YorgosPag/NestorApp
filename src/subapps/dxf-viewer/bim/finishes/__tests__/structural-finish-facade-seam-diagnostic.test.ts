/**
 * ADR-449/534 Φ7 — DIAGNOSTIC (ground-truth ΠΡΙΝ κώδικα): πόσα strips/prisms + πόσες
 * ΕΣΩΤΕΡΙΚΕΣ coplanar ραφές βγάζει μια ΣΥΝΕΧΗΣ ομοεπίπεδη πρόσοψη, και ΓΙΑΤΙ (z-runs).
 *
 * ΔΕΝ είναι regression guard — είναι **μετρητικό**: τεκμηριώνει την ΤΡΕΧΟΥΣΑ συμπεριφορά
 * ώστε να αποφασιστεί Λ1 (merge strips) vs Λ2 (weld mesh) με νούμερα, όχι εικασία. Οι ραφές
 * που βλέπει ο Giorgio (3Δ + C4D OBJ) = τα πλευρικά side-faces δύο γειτονικών prisms.
 *
 * Μηχανισμός (grep-verified 2026-07-18):
 *   bands → mergeSilhouetteBandsToStrips → FinishStrip[] (ένα ΟΡΘΟΓΩΝΙΟ t×z ανά strip)
 *        → buildFinishSkinFromStrips → ΕΝΑ closed prism (THREE.Mesh) ΑΝΑ strip
 * Άρα: #meshes === #strips (loop structural-finish-3d.ts:148-156). Δύο coplanar γειτονικά
 * strips που μοιράζονται t-boundary + z-overlap → τα prisms τους ακουμπούν με εσωτερικά
 * κάθετα τοιχώματα = η ραφή. Τα μετράμε ΑΠΕΥΘΕΙΑΣ από τα strips (χωρίς THREE — ίδιο συμπέρασμα).
 */

import {
  mergeSilhouetteBandsToStrips,
  type FinishStrip,
} from '../structural-finish-vertical-merge';
import { computeStructuralSilhouetteBands, type SilhouetteBand } from '../structural-finish-silhouette';
import type { FinishFaceSegment, StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

// ─── fixtures (mirror του handoff: νότια πρόσοψη y=0, outward, ext plaster) ──────────

const mkSeg = (a: Pt2, b: Pt2, extra: Partial<FinishFaceSegment> = {}): FinishFaceSegment => ({
  a,
  b,
  classification: 'exterior',
  materialId: 'mat-plaster-ext',
  thickness: 25,
  lengthM: Math.hypot(b.x - a.x, b.y - a.y),
  ...extra,
});

const mkBand = (segments: FinishFaceSegment[], zBottomMm: number, zTopMm: number): SilhouetteBand => ({
  faces: { segments, heightM: (zTopMm - zBottomMm) * 0.001, interiorAreaM2: 0, exteriorAreaM2: 0 },
  zBottomMm,
  zTopMm,
});

/** seg κατά μήκος x στο y=0 (ίδια ευθεία-στήριξης → ομοεπίπεδα quads). */
const xSeg = (x0: number, x1: number, extra: Partial<FinishFaceSegment> = {}): FinishFaceSegment =>
  mkSeg({ x: x0, y: 0 }, { x: x1, y: 0 }, extra);

// ─── ανάλυση: εσωτερικές coplanar ραφές μεταξύ strips ────────────────────────────────

const TOL = 1e-3;
const stripX0 = (s: FinishStrip): number => Math.min(s.aCore.x, s.bCore.x);
const stripX1 = (s: FinishStrip): number => Math.max(s.aCore.x, s.bCore.x);
const zOverlap = (a: FinishStrip, b: FinishStrip): number =>
  Math.max(0, Math.min(a.zTopMm, b.zTopMm) - Math.max(a.zBottomMm, b.zBottomMm));

/**
 * Ζεύγη strips που (ίδιο υλικό/χρώμα, ίδια ευθεία y=0) μοιράζονται t-boundary ΚΑΙ έχουν
 * z-overlap > 0 → τα prisms τους ακουμπούν πλευρικά = ΕΣΩΤΕΡΙΚΗ κάθετη ραφή (θα έφευγε με weld).
 * ΔΕΝ μετρά τα άκρα παραθύρου (εκεί δεν υπάρχει γειτονικό strip = πραγματικό όριο).
 */
function countInternalVerticalSeams(strips: readonly FinishStrip[]): number {
  let seams = 0;
  for (let i = 0; i < strips.length; i++) {
    for (let j = i + 1; j < strips.length; j++) {
      const a = strips[i];
      const b = strips[j];
      if (a.seg.materialId !== b.seg.materialId) continue;
      if ((a.seg.colorOverride ?? '') !== (b.seg.colorOverride ?? '')) continue;
      const shareBoundary =
        Math.abs(stripX1(a) - stripX0(b)) < TOL || Math.abs(stripX1(b) - stripX0(a)) < TOL;
      if (shareBoundary && zOverlap(a, b) > TOL) seams++;
    }
  }
  return seams;
}

/** Readable dump ενός strip (t-range × z-range) για το diagnostic log. */
const fmt = (s: FinishStrip): string =>
  `t[${stripX0(s).toFixed(0)}→${stripX1(s).toFixed(0)}] × z[${s.zBottomMm.toFixed(0)}→${s.zTopMm.toFixed(0)}]`;

// ═══════════════════════════════════════════════════════════════════════════════════
// A. Μηχανισμός στα σκέτα bands (isolate mergeSilhouetteBandsToStrips + extrude)
// ═══════════════════════════════════════════════════════════════════════════════════

describe('Φ7 DIAGNOSTIC — πρόσοψη με ΕΝΑ παράθυρο + φάσα: πόσα strips/ραφές & ΓΙΑΤΙ', () => {
  // Νότια πρόσοψη πλάτους 300, ένα παράθυρο x[100,200] στη ζώνη z[1000,2200], φάσα πλάκας
  // z[3000,3150] ομοεπίπεδη (ίδιο ext plaster). Όλα coplanar (y=0), ίδιο spec.
  const bands: SilhouetteBand[] = [
    mkBand([xSeg(0, 300)], 0, 1000),                    // κάτω από ποδιά → πλήρες
    mkBand([xSeg(0, 100), xSeg(200, 300)], 1000, 2200), // ζώνη παραθύρου → 2 πεσσοί (stubs)
    mkBand([xSeg(0, 300)], 2200, 3000),                 // πάνω από πρέκι → πλήρες
    mkBand([xSeg(0, 300)], 3000, 3150),                 // φάσα πλάκας → πλήρες, ομοεπίπεδο
  ];

  it('ΜΕΤΡΗΣΗ: πόσα strips, ποια z-runs, πόσες εσωτερικές coplanar ραφές', () => {
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    const seams = countInternalVerticalSeams(strips);

    // eslint-disable-next-line no-console
    console.log(
      `\n[Φ7 DIAGNOSTIC] πρόσοψη 300mm + 1 παράθυρο + φάσα:\n` +
        `  strips (= prisms = C4D objects) : ${strips.length}\n` +
        `  εσωτερικές coplanar ραφές       : ${seams}\n` +
        strips
          .slice()
          .sort((p, q) => stripX0(p) - stripX0(q) || p.zBottomMm - q.zBottomMm)
          .map((s) => `    • ${fmt(s)}  [${s.seg.materialId}]`)
          .join('\n'),
    );

    // Τεκμηρίωση τρέχουσας συμπεριφοράς (predict-then-measure):
    // t-cells {0-100, 100-200, 200-300}. z-runs: [0-100]&[200-300]→[0,3150] (ένα)·
    // [100-200]→[0,1000]+[2200,3150] (το παράθυρο σπάει). → 1 + 2 + 1 = 4 strips.
    expect(strips.length).toBe(4);
    // Πλήρους ύψους πεσσοί εκατέρωθεν παραθύρου:
    expect(strips.filter((s) => s.zBottomMm === 0 && s.zTopMm === 3150)).toHaveLength(2);
    // Ζώνη παραθύρου: ποδιά (0→1000) + πρέκι/φάσα (2200→3150):
    expect(strips.some((s) => stripX0(s) === 100 && s.zBottomMm === 0 && s.zTopMm === 1000)).toBe(true);
    expect(strips.some((s) => stripX0(s) === 100 && s.zBottomMm === 2200 && s.zTopMm === 3150)).toBe(true);

    // ΤΟ ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ: 4 ΕΣΩΤΕΡΙΚΕΣ coplanar ραφές (2 ανά πλευρά παραθύρου × 2 πλευρές),
    // ΟΛΕΣ ίδιο υλικό/επίπεδο → ΚΑΜΙΑ δεν είναι πραγματικό όριο. Weld θα τις έσβηνε ΟΛΕΣ.
    expect(seams).toBe(4);
  });

  it('CONTROL: συνεχής πρόσοψη ΧΩΡΙΣ παράθυρο (ίδιο πλάτος+φάσα) → 1 strip, 0 ραφές', () => {
    const clean: SilhouetteBand[] = [
      mkBand([xSeg(0, 300)], 0, 1000),
      mkBand([xSeg(0, 300)], 1000, 2200),
      mkBand([xSeg(0, 300)], 2200, 3000),
      mkBand([xSeg(0, 300)], 3000, 3150),
    ];
    const strips = mergeSilhouetteBandsToStrips(clean, 'mm');
    expect(strips).toHaveLength(1);
    expect(countInternalVerticalSeams(strips)).toBe(0);
    // → Απόδειξη: όταν η επιφάνεια ΕΙΝΑΙ ορθογώνια, το υπάρχον merge ήδη δίνει 1 prism.
    //   Το πρόβλημα είναι ΜΟΝΟ όταν openings/steps την κάνουν ΜΗ-ορθογώνια (Λ1 όριο).
  });

  it('Λ1 ΟΡΙΟ: το ορθογώνιο strip ΔΕΝ μπορεί να καλύψει L-γύρω-από-παράθυρο', () => {
    // Οι 2 πεσσοί + ποδιά + πρέκι σχηματίζουν σχήμα «Π» γύρω από το παράθυρο. Κανένα merge
    // strips (Λ1) δεν το κάνει ΕΝΑ ορθογώνιο — άρα ≥3 prisms παραμένουν → ραφές παραμένουν.
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    // Ελάχιστο ορθογώνιο tiling ενός «Π» = 3 (2 πεσσοί + 1 δοκός) — ΠΟΤΕ 1.
    expect(strips.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// B. Ground-truth μέσω ΠΡΑΓΜΑΤΙΚΟΥ silhouette (κολόνα+τοίχος+κολόνα coplanar, z-drift)
// ═══════════════════════════════════════════════════════════════════════════════════

describe('Φ7 DIAGNOSTIC — z-drift μελών: coplanar πλευρά σπάει σε οριζόντια ραφή (Λ1-fixable)', () => {
  const SPEC: StructuralFinishSpec = {
    enabled: true,
    interiorMaterialId: 'mat-plaster-int',
    exteriorMaterialId: 'mat-plaster-ext',
    thickness: 25,
  };
  const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ];

  it('ΜΕΤΡΗΣΗ: κολόνα z[0,3000] + τοίχος z[0,2999.9] coplanar → οριζόντια ραφή στο ~3000;', () => {
    // Νότια όψη coplanar (y=0). Κολόνα x[0,400], τοίχος x[400,4000]: ΙΔΙΑ νότια παρειά.
    // Ο τοίχος 0.1mm κοντύτερος (z-extent drift: columnExtents vs wallFinishZExtent) → η πλευρά
    // κληρονομεί ΔΙΑΦΟΡΕΤΙΚΟ z-run εκατέρωθεν x=400 → decomposeGroup ΔΕΝ ενώνει → 2+ strips.
    const bands = computeStructuralSilhouetteBands({
      members: [
        { footprint: rect(0, 0, 400, 400), zBotMm: 0, zTopMm: 3000 },
        { footprint: rect(400, 0, 4000, 300), zBotMm: 0, zTopMm: 2999.9 },
      ],
      wallObstacles: [],
      spec: SPEC,
      classify: () => 'exterior',
      unitToMeters: 1,
    });
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    const south = strips.filter((s) => Math.abs(s.aCore.y) < 1 && Math.abs(s.bCore.y) < 1);
    // eslint-disable-next-line no-console
    console.log(
      `\n[Φ7 DIAGNOSTIC] z-drift 0.1mm — νότια όψη strips: ${south.length}\n` +
        south.map((s) => `    • ${fmt(s)}`).join('\n'),
    );
    // Τεκμηρίωση: ≥1 (αν το drift 0.1mm > Z_TOL_MM=1e-3 σπάει, θα δούμε >1 = SPURIOUS ραφή).
    expect(south.length).toBeGreaterThanOrEqual(1);
  });
});
