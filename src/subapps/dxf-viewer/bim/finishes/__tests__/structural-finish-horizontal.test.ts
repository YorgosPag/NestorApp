/**
 * ADR-449 Slice 11 — structural-finish-horizontal tests (pure SSoT).
 *
 * Καλύπτει το adjacency-driven «εκτεθειμένη οριζόντια όψη»: εκτεθειμένο (full),
 * πλήρως καλυμμένο → null, **partial coverage** (μισή πλάκα → μισό καπάκι, διπλό
 * εμβαδό-check), abutting cover (δεν αφαιρεί), disabled/degenerate → null, υλικό
 * interior/exterior, direction up/down pass-through.
 */

import {
  computeHorizontalFinishFace,
  horizontalFaceVolumeM3,
  type HorizontalFaceInput,
} from '../structural-finish-horizontal';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

// 0.5×0.5 footprint (m-scene, unitToMeters=1 → εμβαδό σε canvas units² = m²).
const SQUARE: readonly Pt2[] = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0.5, y: 0.5 },
  { x: 0, y: 0.5 },
];

const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

const baseInput = (over: Partial<HorizontalFaceInput> = {}): HorizontalFaceInput => ({
  coreFootprint: SQUARE,
  coverFootprints: [],
  zMm: 3000,
  direction: 'up',
  spec: SPEC,
  classification: 'interior',
  unitToMeters: 1,
  ...over,
});

describe('computeHorizontalFinishFace', () => {
  it('εκτεθειμένο (καμία κάλυψη) → πλήρες καπάκι, εμβαδό 0.25 m²', () => {
    const face = computeHorizontalFinishFace(baseInput());
    expect(face).not.toBeNull();
    expect(face!.polygons).toHaveLength(1);
    expect(face!.areaM2).toBeCloseTo(0.25, 6);
    expect(face!.zMm).toBe(3000);
    expect(face!.thicknessMm).toBe(15);
    expect(face!.direction).toBe('up');
    expect(face!.materialId).toBe('mat-plaster-int');
  });

  it('πλήρως καλυμμένο (πλάκα ίδιου footprint) → null', () => {
    const face = computeHorizontalFinishFace(baseInput({ coverFootprints: [rect(-1, -1, 1.5, 1.5)] }));
    expect(face).toBeNull();
  });

  it('partial coverage (μισή πλάκα) → μισό καπάκι, εμβαδό 0.125 m²', () => {
    // Πλάκα καλύπτει το δεξί μισό x∈[0.25,0.5].
    const face = computeHorizontalFinishFace(baseInput({ coverFootprints: [rect(0.25, -1, 1.5, 1.5)] }));
    expect(face).not.toBeNull();
    expect(face!.areaM2).toBeCloseTo(0.125, 6);
  });

  it('abutting cover (ακουμπά την παρειά, μηδέν overlap) → πλήρες καπάκι', () => {
    // Δοκάρι δίπλα στο x=0.5 (flush) — δεν επικαλύπτει → καμία αφαίρεση.
    const face = computeHorizontalFinishFace(baseInput({ coverFootprints: [rect(0.5, 0, 1.0, 0.5)] }));
    expect(face).not.toBeNull();
    expect(face!.areaM2).toBeCloseTo(0.25, 5);
  });

  it('disabled spec → null', () => {
    expect(computeHorizontalFinishFace(baseInput({ spec: { ...SPEC, enabled: false } }))).toBeNull();
  });

  it('εκφυλισμένο footprint (<3 σημεία) → null', () => {
    expect(computeHorizontalFinishFace(baseInput({ coreFootprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }))).toBeNull();
  });

  it('exterior classification → exterior υλικό', () => {
    const face = computeHorizontalFinishFace(baseInput({ classification: 'exterior' }));
    expect(face!.materialId).toBe('mat-plaster-ext');
  });

  it('direction down (soffit/βάση) → pass-through', () => {
    const face = computeHorizontalFinishFace(baseInput({ direction: 'down', zMm: 2500 }));
    expect(face!.direction).toBe('down');
    expect(face!.zMm).toBe(2500);
  });

  it('horizontalFaceVolumeM3 = area × thickness', () => {
    const face = computeHorizontalFinishFace(baseInput())!;
    expect(horizontalFaceVolumeM3(face)).toBeCloseTo(0.25 * 0.015, 6);
  });
});
