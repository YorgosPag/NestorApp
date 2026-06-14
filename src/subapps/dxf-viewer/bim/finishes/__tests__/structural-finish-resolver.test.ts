/**
 * ADR-449 — structural-finish-resolver tests.
 *
 * Καλύπτει το κρίσιμο: partial coverage (παρειά 50→25+25 με τοίχο στη μέση),
 * interior/exterior split μέσω injected classifier, fully-covered=0, disabled=empty.
 */

import {
  resolveStructuralFinishFaces,
  type FinishEdgeClassifier,
} from '../structural-finish-resolver';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

// 50×50 τετράγωνο footprint, CCW. unitToMeters=1 ώστε lengthM = canvas length.
const SQUARE: readonly Pt2[] = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 50, y: 50 },
  { x: 0, y: 50 },
];

const allInterior: FinishEdgeClassifier = () => 'interior';

// Helper: ορθογώνιο obstacle [x0,x1]×[y0,y1] (CCW).
const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

describe('resolveStructuralFinishFaces', () => {
  it('disabled spec → empty', () => {
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 3000, spec: { ...SPEC, enabled: false },
      obstacles: [], classify: allInterior, unitToMeters: 1,
    });
    expect(out.segments).toHaveLength(0);
    expect(out.interiorAreaM2).toBe(0);
    expect(out.exteriorAreaM2).toBe(0);
  });

  it('no obstacles, all interior → full perimeter (4 segments)', () => {
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [], classify: allInterior, unitToMeters: 1,
    });
    expect(out.segments).toHaveLength(4);
    expect(out.heightM).toBeCloseTo(1);
    // perimeter 200 × height 1m
    expect(out.interiorAreaM2).toBeCloseTo(200);
    expect(out.exteriorAreaM2).toBe(0);
  });

  it('partial coverage: τοίχος στη μέση κάτω-παρειάς → 2 εκτεθειμένα κομμάτια', () => {
    // obstacle καλύπτει x∈[20,30] της κάτω-παρειάς (y=0) → exposed [0,20]+[30,50].
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [rect(20, -5, 30, 5)], classify: allInterior, unitToMeters: 1,
    });
    // 3 ακέραιες ακμές + 2 partial = 5 segments
    expect(out.segments).toHaveLength(5);
    // perimeter 200 − 10 καλυμμένα = 190
    expect(out.interiorAreaM2).toBeCloseTo(190);
    // οι 2 partial υπο-ακμές της κάτω-παρειάς = μήκος 20 η καθεμία
    const bottom = out.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    expect(bottom).toHaveLength(2);
    expect(bottom.map((s) => s.lengthM).sort()).toEqual([20, 20]);
  });

  it('Giorgio 50→25+25: δύο τοίχοι αφήνουν μόνο το μεσαίο εκτεθειμένο', () => {
    // τοίχοι καλύπτουν [0,12.5] και [37.5,50] → exposed μεσαίο [12.5,37.5] = 25.
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [rect(-5, -5, 12.5, 5), rect(37.5, -5, 55, 5)],
      classify: allInterior, unitToMeters: 1,
    });
    const bottom = out.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    expect(bottom).toHaveLength(1);
    expect(bottom[0].lengthM).toBeCloseTo(25);
  });

  it('fully covered edge → δεν παράγει segment (κάτω-παρειά μηδέν)', () => {
    // obstacle flush που καλύπτει ΟΛΗ την κάτω-παρειά (+ τις γωνίες των πλαϊνών
    // ακμών για y∈[0,5]) → covered 50 (κάτω) + 5 + 5 (γωνίες) = 60.
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [rect(-5, -5, 55, 5)], classify: allInterior, unitToMeters: 1,
    });
    // κάτω-παρειά πλήρως καλυμμένη → 0 segments εκεί· left/right τμηματικά (45 η καθεμία)· top 50
    expect(out.segments).toHaveLength(3);
    const bottom = out.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    expect(bottom).toHaveLength(0);
    expect(out.interiorAreaM2).toBeCloseTo(140); // 200 − 60
  });

  it('interior/exterior split: κάτω-παρειά (outward −y) = exterior', () => {
    // CCW square → η κάτω-παρειά (0,0)->(50,0) έχει outward normal (dy,−dx)=(0,−50) → −y.
    const classify: FinishEdgeClassifier = (_mid, n) => (n.y < 0 ? 'exterior' : 'interior');
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [], classify, unitToMeters: 1,
    });
    expect(out.exteriorAreaM2).toBeCloseTo(50);  // μία ακμή 50 × 1m
    expect(out.interiorAreaM2).toBeCloseTo(150); // οι άλλες 3
    const ext = out.segments.filter((s) => s.classification === 'exterior');
    expect(ext).toHaveLength(1);
    expect(ext[0].materialId).toBe('mat-plaster-ext');
  });

  it('unitToMeters: μετατροπή canvas→m εφαρμόζεται στα εμβαδά', () => {
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 3000, spec: SPEC,
      obstacles: [], classify: allInterior, unitToMeters: 0.001, // canvas=mm
    });
    // perimeter 200mm = 0.2m, height 3m → 0.6 m²
    expect(out.interiorAreaM2).toBeCloseTo(0.6);
  });
});

describe('resolveStructuralFinishFaces — junction/square annotation (ADR-449 Slice 10 + Δρόμος Β)', () => {
  it('χωρίς obstacles → κανένα άκρο junction ΟΥΤΕ square (όλα ελεύθερα)', () => {
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [], classify: allInterior, unitToMeters: 1,
    });
    for (const s of out.segments) {
      expect(s.aJunction).toBe(false);
      expect(s.bJunction).toBe(false);
      expect(s.aSquareEnd).toBe(false);
      expect(s.bSquareEnd).toBe(false);
    }
  });

  it('Δρόμος Β — cut endpoint πάνω σε ΤΟΙΧΟ (obstacle, ΟΧΙ junctionObstacle) → square butt, ΟΧΙ junction', () => {
    // obstacle (τοίχος) καλύπτει x∈[20,30] της κάτω-παρειάς → exposed [0,20]+[30,50].
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [rect(20, -5, 30, 5)], classify: allInterior, unitToMeters: 1,
    });
    const bottom = out.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    expect(bottom).toHaveLength(2);
    const left = bottom.find((s) => s.a.x < 10)!; // (0,0)→(20,0)
    const right = bottom.find((s) => s.a.x > 25)!; // (30,0)→(50,0)
    // Cut άκρα (x=20, x=30) ακουμπούν ΤΟΙΧΟ → square butt (ΟΧΙ junction extend, #A fix).
    expect(left.bSquareEnd).toBe(true);
    expect(right.aSquareEnd).toBe(true);
    expect(left.bJunction).toBe(false);
    expect(right.aJunction).toBe(false);
    // Corner άκρα (x=0, x=50) μακριά → ούτε junction ούτε square.
    expect(left.aSquareEnd).toBe(false);
    expect(right.bSquareEnd).toBe(false);
  });

  it('Slice 10 — cut endpoint πάνω σε ΔΟΜΙΚΟ γείτονα (junctionObstacle) → junction, ΟΧΙ square', () => {
    // ίδιο obstacle αλλά περασμένο ΚΑΙ ως junctionObstacle (δομικό: κολόνα/δοκάρι).
    const structural = rect(20, -5, 30, 5);
    const out = resolveStructuralFinishFaces({
      coreFootprint: SQUARE, heightMm: 1000, spec: SPEC,
      obstacles: [structural], junctionObstacles: [structural],
      classify: allInterior, unitToMeters: 1,
    });
    const bottom = out.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    const left = bottom.find((s) => s.a.x < 10)!;
    const right = bottom.find((s) => s.a.x > 25)!;
    // Cut άκρα → junction (corner-fill extend)· junction υπερισχύει → ΟΧΙ square.
    expect(left.bJunction).toBe(true);
    expect(right.aJunction).toBe(true);
    expect(left.bSquareEnd).toBe(false);
    expect(right.aSquareEnd).toBe(false);
  });
});
