/**
 * ADR-417 Φ2a — Unit tests για τον rounded εφαπτόμενο κορφιά.
 *
 * Επικυρώνει ότι ο κορφιάς (α) βρίσκει τα 2 γειτονικά νερά, (β) ΚΑΘΕΤΑΙ πάνω στη
 * ridge (όχι βυθισμένος/«πετάει» — regression του παλιού dome) με τα κάτω άκρα
 * χαμηλότερα από την κορυφή (δράπει στις κλίσεις), (γ) δουλεύει και σε hip lines.
 */

import { buildRoundedRidgeCap, findAdjacentFaces } from '../roof-ridge-cap';
import { computeRoofGeometry, applyRoofShapePreset } from '../../../bim/geometry/roof-geometry';
import { sceneUnitsToMeters } from '../../../utils/scene-units';
import type { Polygon3D, Point3D } from '../../../bim/types/bim-base';
import type { RoofParams } from '../../../bim/types/roof-types';

const rect: Polygon3D = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ] as Point3D[],
};

const params = (shape: 'gable' | 'hip'): RoofParams => ({
  outline: rect,
  edges: applyRoofShapePreset(rect, shape, 30, 'deg'),
  slopeUnit: 'deg',
  basePivotZ: 3000,
  thickness: 200,
  sceneUnits: 'mm',
});

const sceneToM = sceneUnitsToMeters('mm');

/** Συλλέγει τα y όλων των κορυφών της cap geometry. */
function capYs(geo: { getAttribute(name: string): { count: number; getY(i: number): number } }): number[] {
  const pos = geo.getAttribute('position');
  const ys: number[] = [];
  for (let i = 0; i < pos.count; i++) ys.push(pos.getY(i));
  return ys;
}

describe('findAdjacentFaces', () => {
  it('gable ridge → ακριβώς 2 γειτονικά νερά', () => {
    const g = computeRoofGeometry(params('gable'));
    const ridge = g.ridges.find((r) => r.kind === 'ridge');
    expect(ridge).toBeDefined();
    expect(findAdjacentFaces(ridge!, g.faces).length).toBe(2);
  });

  it('hip line → 2 γειτονικά νερά (τραπέζιο + τρίγωνο)', () => {
    const g = computeRoofGeometry(params('hip'));
    const hip = g.ridges.find((r) => r.kind === 'hip');
    expect(hip).toBeDefined();
    expect(findAdjacentFaces(hip!, g.faces).length).toBe(2);
  });
});

describe('buildRoundedRidgeCap', () => {
  it('κάθεται ΠΑΝΩ στη ridge: άκρα χαμηλότερα από την κορυφή, bulge λίγο πάνω', () => {
    const g = computeRoofGeometry(params('gable'));
    const ridge = g.ridges.find((r) => r.kind === 'ridge')!;
    const apexY = (ridge.a.z ?? 0) * 0.001; // mm → m
    const cap = buildRoundedRidgeCap(ridge, findAdjacentFaces(ridge, g.faces), sceneToM, 0);
    expect(cap).not.toBeNull();
    const ys = capYs(cap!);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Τα skirt άκρα δράπουν ΚΑΤΩ από την κορυφή (κάθονται στις κλίσεις).
    expect(minY).toBeLessThan(apexY);
    // Bulge λίγο ΠΑΝΩ από τη ridge — ΟΧΙ βυθισμένος (regression του dome sink).
    expect(maxY).toBeGreaterThan(apexY);
    // Δεν «πετάει» ψηλά: παραμένει κοντά στην κορυφή.
    expect(maxY).toBeLessThan(apexY + 0.15);
  });

  it('παράγει cap και για hip line', () => {
    const g = computeRoofGeometry(params('hip'));
    const hip = g.ridges.find((r) => r.kind === 'hip')!;
    const cap = buildRoundedRidgeCap(hip, findAdjacentFaces(hip, g.faces), sceneToM, 0);
    expect(cap).not.toBeNull();
    expect(cap!.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('null όταν λείπουν γειτονικά νερά', () => {
    const g = computeRoofGeometry(params('gable'));
    const ridge = g.ridges.find((r) => r.kind === 'ridge')!;
    expect(buildRoundedRidgeCap(ridge, [], sceneToM, 0)).toBeNull();
  });
});
