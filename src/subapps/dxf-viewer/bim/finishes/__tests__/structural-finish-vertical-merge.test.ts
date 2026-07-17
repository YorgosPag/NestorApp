/**
 * ADR-449 Slice X6 — κάθετος band-merge (ενιαία περιμετρική κουβέρτα σοβά) tests.
 *
 * Καλύπτει: (1) ελεύθερη παρειά → 2 ταυτόσημες z-γειτονικές bands ενώνονται σε ΕΝΑ strip
 * δάπεδο→κορυφή (μηδέν οριζόντια ραφή)· (2) παρειά που κόβει δοκάρι → καθαρό τέλος στο soffit
 * (δεν ενώνεται)· (3) per-face χρώμα/υλικό → σύνορο διατηρείται (δεν ενώνεται)· (4) non-contiguous
 * z (κενό) → χωριστά strips· (5) BOQ-οπτική ταυτότητα: Σ(coreLen×height) διατηρείται από τον merge·
 * (6) integration μέσω `computeStructuralSilhouetteBands` (κολόνα+δοκάρι).
 */

import {
  mergeSilhouetteBandsToStrips,
  type FinishStrip,
} from '../structural-finish-vertical-merge';
import { computeStructuralSilhouetteBands, type SilhouetteBand } from '../structural-finish-silhouette';
import { computeBandFinishQuads } from '../structural-finish-outline-geometry';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { FinishEdgeClassifier } from '../structural-finish-resolver';
import type { FinishFaceSegment, StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const mkSeg = (
  a: Pt2,
  b: Pt2,
  extra: Partial<FinishFaceSegment> = {},
): FinishFaceSegment => ({
  a,
  b,
  classification: 'interior',
  materialId: 'mat-plaster-int',
  thickness: 15,
  lengthM: Math.hypot(b.x - a.x, b.y - a.y),
  ...extra,
});

const mkBand = (segments: FinishFaceSegment[], zBottomMm: number, zTopMm: number): SilhouetteBand => ({
  faces: { segments, heightM: (zTopMm - zBottomMm) * 0.001, interiorAreaM2: 0, exteriorAreaM2: 0 },
  zBottomMm,
  zTopMm,
});

const coreLen = (s: FinishStrip): number => Math.hypot(s.bCore.x - s.aCore.x, s.bCore.y - s.aCore.y);

/** Σ(coreLen × ύψος) των strips — η οπτική «επιφάνεια» που πρέπει να διατηρεί ο merge. */
const stripsSurface = (strips: readonly FinishStrip[]): number =>
  strips.reduce((acc, s) => acc + coreLen(s) * (s.zTopMm - s.zBottomMm), 0);

/** Ίδιο μέγεθος υπολογισμένο από τις αρχικές bands (κάθε band → τα quads της, με το ύψος της). */
const bandsSurface = (bands: readonly SilhouetteBand[]): number => {
  const s = mmToSceneUnits('mm');
  return bands.reduce((acc, b) => {
    const quads = computeBandFinishQuads(b.faces.segments, s);
    const perBand = quads.reduce((a, q) => a + Math.hypot(q.bCore.x - q.aCore.x, q.bCore.y - q.aCore.y), 0);
    return acc + perBand * (b.zTopMm - b.zBottomMm);
  }, 0);
};

// ─── unit: κάθετος merge σε hand-built bands ────────────────────────────────────

describe('mergeSilhouetteBandsToStrips', () => {
  it('ελεύθερη παρειά: 2 ταυτόσημες z-γειτονικές bands → 1 strip δάπεδο→κορυφή (μηδέν ραφή)', () => {
    const seg = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([seg], 0, 2500), mkBand([seg], 2500, 3000)],
      'mm',
    );
    expect(strips).toHaveLength(1);
    expect(strips[0].zBottomMm).toBe(0);
    expect(strips[0].zTopMm).toBe(3000); // η ραφή στο 2500 εξαφανίστηκε
  });

  it('δοκάρι κόβει ΜΕΡΟΣ της παρειάς (surface decomposition): overlap συνεχές δάπεδο→κορυφή, μη-overlap τελειώνει στο soffit', () => {
    // Κάτω band: όλη η παρειά x[0,100] εκτεθειμένη (z 0→2500)· πάνω band: μόνο x[0,40] εκτεθειμένο
    // (το δοκάρι καλύπτει x[40,100] πάνω από το soffit).
    const low = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const high = mkSeg({ x: 0, y: 0 }, { x: 40, y: 0 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([low], 0, 2500), mkBand([high], 2500, 3000)],
      'mm',
    );
    expect(strips).toHaveLength(2);
    // Το επικαλυπτόμενο x[0,40] = ΕΝΑ συνεχές strip δάπεδο→κορυφή (μηδέν οριζόντια ραφή).
    const full = strips.find((s) => s.zBottomMm === 0 && s.zTopMm === 3000)!;
    expect(full).toBeDefined();
    expect(Math.hypot(full.bCore.x - full.aCore.x, full.bCore.y - full.aCore.y)).toBeCloseTo(40);
    // Το μη-επικαλυπτόμενο x[40,100] → τελειώνει ΚΑΘΑΡΑ στο soffit (2500).
    const soffit = strips.find((s) => s.zBottomMm === 0 && s.zTopMm === 2500)!;
    expect(soffit).toBeDefined();
    expect(Math.hypot(soffit.bCore.x - soffit.aCore.x, soffit.bCore.y - soffit.aCore.y)).toBeCloseTo(60);
  });

  it('per-face χρώμα: ίδια γεωμετρία αλλά διαφορετικό colorOverride → ΔΕΝ ενώνονται (σύνορο χρώματος)', () => {
    const plain = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const painted = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 }, { colorOverride: '#c0d8b0' });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([plain], 0, 2500), mkBand([painted], 2500, 3000)],
      'mm',
    );
    expect(strips).toHaveLength(2);
  });

  it('per-face υλικό: διαφορετικό materialId → ΔΕΝ ενώνονται', () => {
    const a = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const b = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 }, { materialId: 'mat-gypsum-board' });
    expect(mergeSilhouetteBandsToStrips([mkBand([a], 0, 2500), mkBand([b], 2500, 3000)], 'mm')).toHaveLength(2);
  });

  it('non-contiguous z (κενό ανάμεσα) → χωριστά strips (δεν γεφυρώνει το κενό)', () => {
    const seg = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([seg], 0, 1000), mkBand([seg], 2000, 3000)],
      'mm',
    );
    expect(strips).toHaveLength(2);
  });

  it('3 z-γειτονικές ταυτόσημες bands → 1 strip (accumulator run, όχι μόνο ζεύγη)', () => {
    const seg = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([seg], 0, 1000), mkBand([seg], 1000, 2000), mkBand([seg], 2000, 3000)],
      'mm',
    );
    expect(strips).toHaveLength(1);
    expect(strips[0].zBottomMm).toBe(0);
    expect(strips[0].zTopMm).toBe(3000);
  });

  it('πολλαπλές όψεις: κάθε ελεύθερη παρειά ενώνεται ανεξάρτητα (one-to-one claim)', () => {
    const north = mkSeg({ x: 0, y: 50 }, { x: 50, y: 50 });
    const west = mkSeg({ x: 0, y: 0 }, { x: 0, y: 50 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([north, west], 0, 2500), mkBand([north, west], 2500, 3000)],
      'mm',
    );
    expect(strips).toHaveLength(2); // 2 όψεις × 1 (merged) = 2, ΟΧΙ 4
    expect(strips.every((s) => s.zBottomMm === 0 && s.zTopMm === 3000)).toBe(true);
  });

  it('κενό input → κενό', () => {
    expect(mergeSilhouetteBandsToStrips([], 'mm')).toHaveLength(0);
  });

  it('BOQ-οπτική ταυτότητα: Σ(coreLen×height) αμετάβλητο (ελεύθερη + κομμένη παρειά)', () => {
    const bands = [
      mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 })], 0, 2500),
      mkBand([mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 })], 2500, 3000),
    ];
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    expect(stripsSurface(strips)).toBeCloseTo(bandsSurface(bands), 6);
  });
});

// ─── ADR-534 Φ6a: near-coplanar tolerance (drift → seamless· πραγματικό σκαλί → ραφή) ─────

describe('mergeSilhouetteBandsToStrips — Φ6a near-coplanar tolerance (COPLANAR_MERGE_TOL_MM=5)', () => {
  it('(a) drift < ανοχή (2mm) z-stacked → 1 seamless strip δάπεδο→κορυφή (φάσα↔τοίχος)', () => {
    const wall = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });     // z 0→2500 (σοβάς τοίχου)
    const fascia = mkSeg({ x: 0, y: 2 }, { x: 100, y: 2 });   // z 2500→3000, 2mm drift (φάσα πλάκας)
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([wall], 0, 2500), mkBand([fascia], 2500, 3000)], 'mm');
    expect(strips).toHaveLength(1);
    expect(strips[0].zBottomMm).toBe(0);
    expect(strips[0].zTopMm).toBe(3000);
  });

  it('(b) πραγματικό σκαλί > ανοχή (20mm — π.χ. δοκάρι από κολόνα) → 2 strips (ραφή διατηρείται)', () => {
    const lower = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const upper = mkSeg({ x: 0, y: 20 }, { x: 100, y: 20 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([lower], 0, 2500), mkBand([upper], 2500, 3000)], 'mm');
    expect(strips).toHaveLength(2);
    expect(strips.some((s) => s.zBottomMm === 0 && s.zTopMm === 3000)).toBe(false);
  });

  it('(c) αλλαγή υλικού εντός ανοχής (2mm) → 2 strips (attribute seam νικά τη γεωμετρία — paint survives)', () => {
    const a = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const b = mkSeg({ x: 0, y: 2 }, { x: 100, y: 2 }, { materialId: 'mat-gypsum-board' });
    expect(mergeSilhouetteBandsToStrips(
      [mkBand([a], 0, 2500), mkBand([b], 2500, 3000)], 'mm')).toHaveLength(2);
  });

  it('(d) anchor clustering (όχι chaining): y=0/4/8mm z-stacked → {0,4} ενώνεται, {8} σπάει → 2 strips', () => {
    const s0 = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const s1 = mkSeg({ x: 0, y: 4 }, { x: 100, y: 4 });
    const s2 = mkSeg({ x: 0, y: 8 }, { x: 100, y: 8 });
    const strips = mergeSilhouetteBandsToStrips(
      [mkBand([s0], 0, 1000), mkBand([s1], 1000, 2000), mkBand([s2], 2000, 3000)], 'mm');
    expect(strips).toHaveLength(2); // ΟΧΙ 1 — neighbour-chaining (0→4→8) θα έδινε 1 λανθασμένα
    expect(strips.some((s) => s.zBottomMm === 0 && s.zTopMm === 2000)).toBe(true);    // cluster {0,4}
    expect(strips.some((s) => s.zBottomMm === 2000 && s.zTopMm === 3000)).toBe(true); // cluster {8}
  });
});

// ─── integration: μέσω του πραγματικού silhouette (κολόνα + δοκάρι) ─────────────

describe('ADR-449 Slice X6 — integration: κολόνα + δοκάρι → ελεύθερες παρειές ενιαίες, beam-side καθαρό soffit', () => {
  const SPEC: StructuralFinishSpec = {
    enabled: true,
    interiorMaterialId: 'mat-plaster-int',
    exteriorMaterialId: 'mat-plaster-ext',
    thickness: 15,
  };
  const allInterior: FinishEdgeClassifier = () => 'interior';
  const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ];

  const bands = computeStructuralSilhouetteBands({
    members: [
      { footprint: rect(0, 0, 50, 50), zBotMm: 0, zTopMm: 3000 },        // κολόνα όλο το ύψος
      { footprint: rect(50, 20, 200, 30), zBotMm: 2500, zTopMm: 3000 },  // δοκάρι στην ΑΝΑΤΟΛΙΚΗ παρειά
    ],
    wallObstacles: [],
    spec: SPEC,
    classify: allInterior,
    unitToMeters: 1,
  });

  it('προϋπόθεση: 2 z-bands (0→2500, 2500→3000)', () => {
    expect(bands).toHaveLength(2);
  });

  it('ελεύθερες παρειές (Β/Ν/Δ) → strips δάπεδο→κορυφή (μηδέν ραφή στο soffit)', () => {
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    const fullHeight = strips.filter((s) => s.zBottomMm === 0 && s.zTopMm === 3000);
    expect(fullHeight.length).toBeGreaterThanOrEqual(3); // north, south, west
  });

  it('beam-side (ανατολική) παρειά → κάτω strip τελειώνει στο soffit (2500), όχι 3000', () => {
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    expect(strips.some((s) => s.zBottomMm === 0 && s.zTopMm === 2500)).toBe(true);
  });

  it('BOQ-οπτική ταυτότητα (integration): Σ(coreLen×height) διατηρείται', () => {
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    expect(stripsSurface(strips)).toBeCloseTo(bandsSurface(bands), 3);
  });
});

// ─── regression: δοκάρι ΠΕΡΝΑ ΠΑΝΩ από κολόνα (screenshot 135020) → μηδέν οριζόντια ραφή ──────

describe('ADR-449 Slice X6 — regression: δοκάρι πάνω από κολόνα → καμία ελεύθερη παρειά δεν σπάει στο soffit', () => {
  const SPEC: StructuralFinishSpec = {
    enabled: true, interiorMaterialId: 'mat-plaster-int', exteriorMaterialId: 'mat-plaster-ext', thickness: 15,
  };
  const allInterior: FinishEdgeClassifier = () => 'interior';
  const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ];
  // Κολόνα 400×400 z[0,3000]· δοκάρι ανατολικοδυτικό που ΠΕΡΝΑ ΠΑΝΩ (y[150,250], εκτείνεται
  // δυτικά+ανατολικά πέρα από την κολόνα), soffit=2500. Κόβει Α+Δ παρειές σε stubs· Β+Ν ελεύθερες.
  const bands = computeStructuralSilhouetteBands({
    members: [
      { footprint: rect(0, 0, 400, 400), zBotMm: 0, zTopMm: 3000 },
      { footprint: rect(-1000, 150, 1400, 250), zBotMm: 2500, zTopMm: 3000 },
    ],
    wallObstacles: [], spec: SPEC, classify: allInterior, unitToMeters: 1,
  });

  const samePt = (p: { x: number; y: number }, q: { x: number; y: number }): boolean =>
    Math.hypot(p.x - q.x, p.y - q.y) < 1e-3;

  it('προϋπόθεση: 2 z-bands', () => {
    expect(bands).toHaveLength(2);
  });

  it('ΚΑΜΙΑ όψη δεν σπάει σε στοιβαγμένο ζεύγος (0→soffit)+(soffit→top) με ΙΔΙΟ core edge = μηδέν ραφή', () => {
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    const seamPairs = strips.filter((lo) =>
      lo.zBottomMm === 0 && Math.abs(lo.zTopMm - 2500) < 1 &&
      strips.some((hi) =>
        Math.abs(hi.zBottomMm - 2500) < 1 && samePt(hi.aCore, lo.aCore) && samePt(hi.bCore, lo.bCore)),
    );
    expect(seamPairs).toHaveLength(0);
  });

  it('υπάρχουν στριφτά strips δάπεδο→κορυφή (ελεύθερα κομμάτια) + strips που τελειώνουν στο soffit (κάτω από δοκάρι)', () => {
    const strips = mergeSilhouetteBandsToStrips(bands, 'mm');
    expect(strips.some((s) => s.zBottomMm === 0 && s.zTopMm === 3000)).toBe(true); // ελεύθερα → ενιαία
    expect(strips.some((s) => s.zBottomMm === 0 && Math.abs(s.zTopMm - 2500) < 1)).toBe(true); // κάτω από δοκάρι → soffit end
  });
});
