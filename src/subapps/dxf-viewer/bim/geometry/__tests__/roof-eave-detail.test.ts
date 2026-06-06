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
import type { RoofEdgeSlope, RoofSoffitMode } from '../../types/roof-types';

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
