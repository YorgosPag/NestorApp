/**
 * ADR-417 Φ2b — Unit tests για το γείσο (overhang/fascia/soffit).
 *
 * Επικυρώνει: (1) μετωπίδα σε ΚΑΘΕ περιμετρική ακμή (eaves + αετώματα), (2)
 * overhang strip + soffit μόνο όταν υπάρχει προεξοχή, (3) η προεξοχή σε eave
 * πέφτει κάτω από τη στάθμη γείσου (συνεχίζει την κλίση), (4) η μετωπίδα καλύπτει
 * όλο το πάχος της στοίβας, (5) horizontal vs sloped soffit, (6) flat δώμα.
 */

import { buildRoofEaveDetail, type RoofEaveDetailInput } from '../roof-eave-detail';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { Point3D } from '../../types/bim-base';
import type { RoofEdgeSlope, RoofRidgeLine, RoofSoffitMode } from '../../types/roof-types';

const RECT: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4000, y: 0, z: 0 },
  { x: 4000, y: 3000, z: 0 },
  { x: 0, y: 3000, z: 0 },
];
const S = mmToSceneUnits('mm');
const BASE = 3000;
const THICK = 250;

const edge = (defines: boolean, overhangMm: number): RoofEdgeSlope => ({
  definesSlope: defines,
  slope: 30,
  overhangMm,
});

function cfg(
  edges: readonly RoofEdgeSlope[],
  over: { fasciaHeightMm?: number; soffitMode?: RoofSoffitMode } = {},
): RoofEaveDetailInput {
  return {
    outline: RECT,
    edges,
    slopeUnit: 'deg',
    basePivotZ: BASE,
    thicknessMm: THICK,
    s: S,
    fasciaHeightMm: over.fasciaHeightMm ?? 200,
    soffitMode: over.soffitMode ?? 'horizontal',
    overhangMaterialId: 'mat-roof-tile',
    fasciaMaterialId: 'mat-wood',
    soffitMaterialId: 'mat-wood',
  };
}

/** gable: north+south eaves slope-defining, east+west rakes — all with overhang. */
const GABLE = [edge(true, 400), edge(false, 400), edge(true, 400), edge(false, 400)];

describe('buildRoofEaveDetail — coverage', () => {
  it('μετωπίδα σε ΚΑΘΕ περιμετρική ακμή (eaves + αετώματα)', () => {
    const { quads } = buildRoofEaveDetail(cfg(GABLE));
    expect(quads.filter((q) => q.role === 'fascia').length).toBe(4);
  });

  it('με προεξοχή → overhang strip + soffit ανά ακμή (4×3 = 12 quads)', () => {
    const { quads } = buildRoofEaveDetail(cfg(GABLE));
    expect(quads.filter((q) => q.role === 'overhang').length).toBe(4);
    expect(quads.filter((q) => q.role === 'soffit').length).toBe(4);
    expect(quads.length).toBe(12);
  });

  it('degenerate (edges ≠ outline length) → κενό', () => {
    const { quads } = buildRoofEaveDetail(cfg([edge(true, 400)]));
    expect(quads.length).toBe(0);
  });
});

describe('buildRoofEaveDetail — geometry', () => {
  it('η προεξοχή σε eave πέφτει κάτω από τη στάθμη γείσου (συνεχίζει την κλίση)', () => {
    const { quads } = buildRoofEaveDetail(cfg(GABLE));
    // Edge 0 = north eave (definesSlope). Το overhang strip του έχει εξωτερικά
    // άκρα (outline[2],[3]) με z < basePivot.
    const strip = quads.find((q) => q.role === 'overhang');
    expect(strip).toBeDefined();
    const outerZ = strip!.outline[2].z ?? 0;
    expect(outerZ).toBeLessThan(BASE);
  });

  it('τα εξωτερικά plan-σημεία βγαίνουν ΕΞΩ από το footprint', () => {
    const { overhangEdges } = buildRoofEaveDetail(cfg(GABLE));
    // Edge 0 (north, y=0) → outward = -y → o0.y < 0.
    expect(overhangEdges[0].o0.y).toBeLessThan(0);
  });

  it('η μετωπίδα καλύπτει ΤΟΥΛΑΧΙΣΤΟΝ όλο το πάχος της στοίβας', () => {
    // fasciaHeight 100 < thickness 250 → cover = 250.
    const { quads } = buildRoofEaveDetail(cfg(GABLE, { fasciaHeightMm: 100 }));
    const fascia = quads.find((q) => q.role === 'fascia')!;
    const top = fascia.outline[0].z ?? 0;
    const bot = fascia.outline[3].z ?? 0;
    expect(top - bot).toBeCloseTo(THICK, 3);
  });

  it('horizontal soffit = επίπεδο· sloped soffit = ακολουθεί την κάτω επιφάνεια', () => {
    const h = buildRoofEaveDetail(cfg(GABLE, { soffitMode: 'horizontal' }));
    const hSoffit = h.quads.find((q) => q.role === 'soffit')!;
    // Horizontal: τα 4 z ίσα (επίπεδο).
    const hz = hSoffit.outline.map((p) => p.z ?? 0);
    expect(Math.max(...hz) - Math.min(...hz)).toBeCloseTo(0, 3);

    const sl = buildRoofEaveDetail(cfg(GABLE, { soffitMode: 'sloped' }));
    const sSoffit = sl.quads.find((q) => q.role === 'soffit')!;
    const sz = sSoffit.outline.map((p) => p.z ?? 0);
    expect(Math.max(...sz) - Math.min(...sz)).toBeGreaterThan(0); // κεκλιμένο
  });
});

describe('buildRoofEaveDetail — mitered γωνίες (τετράρριχτη/hip)', () => {
  // Τετράγωνο footprint· και οι 4 ακμές eaves ίσης κλίσης → συμμετρική πυραμίδα.
  const SQUARE: Point3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 4000, z: 0 },
    { x: 0, y: 4000, z: 0 },
  ];
  const HIP = [edge(true, 400), edge(true, 400), edge(true, 400), edge(true, 400)];
  const hipCfg: RoofEaveDetailInput = { ...cfg(HIP), outline: SQUARE };

  it('γειτονικές ακμές μοιράζονται το ΙΔΙΟ εξωτερικό γωνιακό σημείο (καμία τρύπα)', () => {
    const { overhangEdges } = buildRoofEaveDetail(hipCfg);
    for (let i = 0; i < overhangEdges.length; i++) {
      const next = overhangEdges[(i + 1) % overhangEdges.length];
      expect(overhangEdges[i].o1.x).toBeCloseTo(next.o0.x, 6);
      expect(overhangEdges[i].o1.y).toBeCloseTo(next.o0.y, 6);
    }
  });

  it('το mitered σημείο εκτείνεται διαγώνια έξω από τη γωνία του footprint', () => {
    const { overhangEdges } = buildRoofEaveDetail(hipCfg);
    // Γωνία v1=(4000,0): edge0 (κάτω, outward −y) ∩ edge1 (δεξιά, outward +x) → (4400,−400).
    const corner = overhangEdges[0].o1;
    expect(corner.x).toBeCloseTo(4400, 3);
    expect(corner.y).toBeCloseTo(-400, 3);
  });

  it('στο κοινό σημείο οι 2 γειτονικές προεξοχές έχουν ίδιο z (watertight κατά μήκος του hip)', () => {
    const { quads } = buildRoofEaveDetail(hipCfg);
    const strips = quads.filter((q) => q.role === 'overhang');
    // Edge0 strip outline[2] = εξωτερικό @ v1· edge1 strip outline[3] = εξωτερικό @ v1 (ίδιο M).
    const e0 = strips[0].outline[2];
    const e1 = strips[1].outline[3];
    expect(e0.x).toBeCloseTo(e1.x, 6);
    expect(e0.y).toBeCloseTo(e1.y, 6);
    expect(e0.z ?? 0).toBeCloseTo(e1.z ?? 0, 6); // ίσες κλίσεις → μηδέν z-seam
  });

  it('το mitered σημείο πέφτει κάτω από τη στάθμη γείσου (συνεχίζει την κλίση στο hip)', () => {
    const { overhangEdges } = buildRoofEaveDetail(hipCfg);
    expect(overhangEdges[0].o1.z ?? 0).toBeLessThan(BASE);
  });
});

describe('buildRoofEaveDetail — rake split στον κορφιά (δίρριχτη)', () => {
  // Δίρριχτη: ο κορφιάς τρέχει E-W στο μέσο (y=1500)· τα endpoints του πέφτουν
  // πάνω στα rake edges (east x=4000, west x=0) → εκεί σπάει η περίμετρος.
  const RIDGE: RoofRidgeLine[] = [
    { a: { x: 0, y: 1500, z: BASE }, b: { x: 4000, y: 1500, z: BASE }, kind: 'ridge' },
  ];
  const withRidge = (): RoofEaveDetailInput => ({ ...cfg(GABLE), ridges: RIDGE });

  it('σπάει κάθε rake edge στον κορφιά → 6 ακμές αντί 4', () => {
    expect(buildRoofEaveDetail(withRidge()).overhangEdges.length).toBe(6);
  });

  it('χωρίς ridges → καμία αλλαγή (4 ακμές, back-compat)', () => {
    expect(buildRoofEaveDetail(cfg(GABLE)).overhangEdges.length).toBe(4);
  });

  it('η rake προεξοχή σχηματίζει κορυφή (/\\): σημείο στον κορφιά πιο ψηλά από τα γείσα', () => {
    const { overhangEdges } = buildRoofEaveDetail(withRidge());
    // Εξωτερική πλευρά του east rake → x≈4400 (4000 + overhang 400).
    const eastOuter = overhangEdges
      .flatMap((e) => [e.o0, e.o1])
      .filter((p) => Math.abs(p.x - 4400) < 1);
    const atRidge = eastOuter.find((p) => Math.abs(p.y - 1500) < 1)!;
    const atEave = eastOuter.find((p) => Math.abs(p.y + 400) < 1)!; // (4400,−400)
    expect(atRidge).toBeDefined();
    expect(atEave).toBeDefined();
    expect(atRidge.z ?? 0).toBeGreaterThan(BASE); // κορφιάς πάνω από στάθμη γείσου
    expect(atEave.z ?? 0).toBeLessThan(BASE); // γείσο πέφτει κάτω
    expect(atRidge.z ?? 0).toBeGreaterThan(atEave.z ?? 0); // κορυφή > άκρο
  });
});

describe('buildRoofEaveDetail — flat δώμα (χωρίς προεξοχή)', () => {
  const FLAT = RECT.map(() => edge(false, 0));

  it('μόνο μετωπίδες (καμία overhang strip / soffit)', () => {
    const { quads } = buildRoofEaveDetail(cfg(FLAT));
    expect(quads.every((q) => q.role === 'fascia')).toBe(true);
    expect(quads.length).toBe(4);
  });

  it('τα εξωτερικά σημεία ταυτίζονται με το footprint (overhang 0)', () => {
    const { overhangEdges } = buildRoofEaveDetail(cfg(FLAT));
    expect(overhangEdges[0].o0.x).toBeCloseTo(RECT[0].x, 6);
    expect(overhangEdges[0].o0.y).toBeCloseTo(RECT[0].y, 6);
  });

  it('επίπεδη μετωπίδα στη στάθμη γείσου (top == basePivot)', () => {
    const { quads } = buildRoofEaveDetail(cfg(FLAT));
    expect(quads[0].outline[0].z ?? 0).toBeCloseTo(BASE, 3);
  });
});
