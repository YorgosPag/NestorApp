/**
 * ADR-449 PART B — per-face override (element-owned Revit «Paint») + `finishFaceRef` σταθερότητα.
 *
 * Καλύπτει: (1) `finishFaceRef` φορά-agnostic + quantized + μοναδικό ανά όψη· (2) ο resolver
 * εφαρμόζει το override (materialId/colorOverride/thickness) ΜΟΝΟ στην όψη-στόχο· (3) partial
 * override (μόνο πάχος) κρατά default υλικό.
 */

import { resolveStructuralFinishFaces, type FinishEdgeClassifier } from '../structural-finish-resolver';
import { finishFaceRef } from '../structural-finish-face-ref';
import type { StructuralFinishSpec, FinishFaceOverride } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const allInterior: FinishEdgeClassifier = () => 'interior';

/** Τετράγωνο 100×100 (CCW). Ακμές: κάτω mid(50,0), δεξιά (100,50), πάνω (50,100), αριστ. (0,50). */
const SQUARE: Pt2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

/** Βρες το segment με το δοσμένο midpoint (±0.5). */
const atMid = (segs: readonly { a: Pt2; b: Pt2 }[], mx: number, my: number) =>
  segs.find((s) => Math.abs((s.a.x + s.b.x) / 2 - mx) < 0.5 && Math.abs((s.a.y + s.b.y) / 2 - my) < 0.5);

describe('finishFaceRef (ADR-449 PART B)', () => {
  it('φορά-agnostic: a→b === b→a', () => {
    expect(finishFaceRef({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(finishFaceRef({ x: 100, y: 0 }, { x: 0, y: 0 }));
  });

  it('μοναδικό ανά όψη (διαφορετικά midpoints → διαφορετικά keys)', () => {
    expect(finishFaceRef({ x: 0, y: 0 }, { x: 100, y: 0 })).not.toBe(finishFaceRef({ x: 100, y: 0 }, { x: 100, y: 100 }));
  });

  it('quantized: sub-unit drift «από κάναβο» → ίδιο key', () => {
    expect(finishFaceRef({ x: 0, y: 0 }, { x: 100.0000003, y: 0 })).toBe(finishFaceRef({ x: 0, y: 0 }, { x: 100, y: 0 }));
  });
});

describe('resolver faceOverride (element-owned per-face)', () => {
  const overrides: Record<string, FinishFaceOverride> = {
    [finishFaceRef({ x: 0, y: 0 }, { x: 100, y: 0 })]: { materialId: 'mat-gypsum-board', colorOverride: '#c0d8b0', thickness: 12.5 },
  };
  const faces = resolveStructuralFinishFaces({
    coreFootprint: SQUARE,
    heightMm: 1000,
    spec: SPEC,
    obstacles: [],
    classify: allInterior,
    unitToMeters: 1,
    faceOverride: (a, b) => overrides[finishFaceRef(a, b)],
  });

  it('η όψη-στόχος παίρνει το override υλικό/χρώμα/πάχος', () => {
    const bottom = atMid(faces.segments, 50, 0)!;
    expect(bottom.materialId).toBe('mat-gypsum-board');
    expect(bottom.colorOverride).toBe('#c0d8b0');
    expect(bottom.thickness).toBe(12.5);
  });

  it('οι υπόλοιπες όψεις μένουν default (μηδέν διαρροή override)', () => {
    const right = atMid(faces.segments, 100, 50)!;
    expect(right.materialId).toBe('mat-plaster-int');
    expect(right.colorOverride).toBeUndefined();
    expect(right.thickness).toBe(15);
  });

  it('χωρίς faceOverride callback → byte-for-byte default (μηδέν colorOverride)', () => {
    const plain = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC, obstacles: [], classify: allInterior, unitToMeters: 1,
    });
    expect(plain.segments.every((s) => s.materialId === 'mat-plaster-int' && s.colorOverride === undefined)).toBe(true);
  });

  it('partial override (μόνο πάχος) → κρατά default υλικό', () => {
    const only: Record<string, FinishFaceOverride> = {
      [finishFaceRef({ x: 100, y: 0 }, { x: 100, y: 100 })]: { thickness: 30 },
    };
    const f = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC, obstacles: [], classify: allInterior, unitToMeters: 1,
      faceOverride: (a, b) => only[finishFaceRef(a, b)],
    });
    const right = atMid(f.segments, 100, 50)!;
    expect(right.thickness).toBe(30);
    expect(right.materialId).toBe('mat-plaster-int'); // default (δεν δηλώθηκε υλικό)
    expect(right.colorOverride).toBeUndefined();
  });
});
