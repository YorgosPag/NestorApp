/**
 * ADR-417 — Roof snap-point extraction (στέγη → έλξεις).
 *
 * Κλειδώνει ότι το SSoT `GeometricCalculations` παράγει, για μια στέγη, ENDPOINT +
 * MIDPOINT από ΤΡΕΙΣ πηγές — (α) footprint (γραμμή τοίχου/pivot), (β) εξωτερικό
 * mitered δαχτυλίδι **γείσου** (`roofEaveOuterRing` SSoT — ό,τι ζωγραφίζεται) και
 * (γ) κορφιάδες/hips (`geometry.ridges`) — και CENTER = κέντρο bbox footprint.
 *
 * Flat (overhang 0) → το γείσο ταυτίζεται με το footprint· overhang > 0 → το
 * δαχτυλίδι εκτείνεται ΕΞΩ από το footprint.
 */

import { GeometricCalculations } from '../GeometricCalculations';
import type { Entity } from '../../extended-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { RoofRidgeLine } from '../../../bim/types/roof-types';

// Τετράγωνο footprint CCW (canvas units).
const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const roof = (
  overhangMm: number,
  ridges: RoofRidgeLine[] = [],
  outline: Point2D[] = SQUARE,
): Entity =>
  ({
    id: 'r1',
    type: 'roof',
    visible: true,
    params: {
      outline: { vertices: outline.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
      edges: outline.map(() => ({ definesSlope: true, slope: 30, overhangMm })),
      slopeUnit: 'deg',
      basePivotZ: 3000,
      thickness: 200,
      sceneUnits: 'mm',
    },
    geometry: {
      footprint: { vertices: outline.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
      faces: [],
      ridges,
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 3000 } },
      projectedAreaM2: 0, grossAreaM2: 0, perimeterM: 0, volumeM3: 0,
      area: 0, volume: 0, shape: 'flat', ridgeHeightMm: 0,
    },
  } as unknown as Entity);

describe('GeometricCalculations — roof ENDPOINT snaps', () => {
  it('flat (overhang 0): footprint + γείσο (≡footprint) → 8 σημεία, όλες οι κορυφές', () => {
    const pts = GeometricCalculations.getEntityEndpoints(roof(0));
    expect(pts).toHaveLength(8); // 4 footprint + 4 eave ring (ταυτίζονται)
    // Τα πρώτα 4 = κορυφές footprint.
    expect(pts.slice(0, 4)).toEqual(SQUARE);
    // Το δαχτυλίδι γείσου (επόμενα 4) ταυτίζεται με το footprint όταν overhang 0.
    expect(pts.slice(4, 8)).toEqual(SQUARE);
  });

  it('overhang > 0: το δαχτυλίδι γείσου εκτείνεται ΕΞΩ από το footprint', () => {
    const pts = GeometricCalculations.getEntityEndpoints(roof(2000));
    // Footprint αναλλοίωτο (πρώτα 4), το γείσο (επόμενα 4) έξω από το [0,10]².
    expect(pts.slice(0, 4)).toEqual(SQUARE);
    const eave = pts.slice(4, 8);
    expect(eave.some((p) => p.x < 0 || p.y < 0)).toBe(true);
    expect(eave.some((p) => p.x > 10 || p.y > 10)).toBe(true);
  });

  it('προσθέτει τα άκρα κάθε κορφιά/hip (`geometry.ridges`)', () => {
    const ridge: RoofRidgeLine = {
      a: { x: 2, y: 5, z: 3500 },
      b: { x: 8, y: 5, z: 3500 },
      kind: 'ridge',
    };
    const pts = GeometricCalculations.getEntityEndpoints(roof(0, [ridge]));
    expect(pts).toHaveLength(10); // 4 footprint + 4 γείσο + 2 άκρα κορφιά
    expect(pts).toContainEqual({ x: 2, y: 5 });
    expect(pts).toContainEqual({ x: 8, y: 5 });
  });

  it('εκφυλισμένο footprint (< 3 κορυφές) → κανένα δαχτυλίδι γείσου', () => {
    const pts = GeometricCalculations.getEntityEndpoints(
      roof(400, [], [{ x: 0, y: 0 }, { x: 5, y: 0 }]),
    );
    expect(pts).toHaveLength(2); // μόνο οι 2 κορυφές footprint· roofEaveOuterRing → []
  });
});

describe('GeometricCalculations — roof MIDPOINT snaps', () => {
  it('flat: μέσα ακμών footprint + γείσου (κλειστός βρόχος)', () => {
    const mids = GeometricCalculations.getEntityMidpoints(roof(0));
    expect(mids).toHaveLength(8); // 4 footprint + 4 γείσο (ταυτίζονται)
    const expected = [
      { x: 5, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 5 }, // ακμή κλεισίματος
    ];
    expect(mids.slice(0, 4)).toEqual(expected);
    expect(mids.slice(4, 8)).toEqual(expected);
  });

  it('προσθέτει το μέσο κάθε κορφιά/hip', () => {
    const ridge: RoofRidgeLine = {
      a: { x: 2, y: 4, z: 3500 },
      b: { x: 8, y: 4, z: 3500 },
      kind: 'hip',
    };
    const mids = GeometricCalculations.getEntityMidpoints(roof(0, [ridge]));
    expect(mids).toContainEqual({ x: 5, y: 4 }); // μέσο του κορφιά
  });
});

describe('GeometricCalculations — roof CENTER snap', () => {
  it('κέντρο bbox footprint (derived `geometry.bbox`)', () => {
    expect(GeometricCalculations.getEntityCenter(roof(0))).toEqual({ x: 5, y: 5 });
  });

  it('χωρίς geometry.bbox → null', () => {
    const noGeo = { id: 'r2', type: 'roof', visible: true, params: { outline: { vertices: [] }, edges: [] } } as unknown as Entity;
    expect(GeometricCalculations.getEntityCenter(noGeo)).toBeNull();
  });
});
