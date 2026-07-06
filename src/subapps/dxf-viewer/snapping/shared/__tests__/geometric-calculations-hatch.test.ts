/**
 * ADR-507 — Hatch snap-point extraction (γραμμοσκίαση → έλξεις).
 *
 * Κλειδώνει ότι το SSoT `GeometricCalculations` παράγει ENDPOINT (κορυφές ορίου =
 * λαβές hatch-vertex), MIDPOINT (μέσα ακμών, incl. ακμή κλεισίματος) και CENTER
 * (κέντρο bbox ορίου) για γραμμοσκίαση — ώστε το hover πάνω στις λαβές να δείχνει
 * έλξεις όπως σε κλειστή πολυγραμμή.
 */

import { GeometricCalculations } from '../GeometricCalculations';
import type { Entity } from '../../extended-types';
import type { Point2D } from '../../../rendering/types/Types';

const hatch = (boundaryPaths: Point2D[][]): Entity =>
  ({ id: 'h1', type: 'hatch', boundaryPaths, visible: true } as unknown as Entity);

// Τετράγωνο όριο (χωρίς επανάληψη πρώτης κορυφής — implicit close).
const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('GeometricCalculations — hatch ENDPOINT snaps', () => {
  it('επιστρέφει κάθε κορυφή του ορίου (λαβές hatch-vertex)', () => {
    const pts = GeometricCalculations.getEntityEndpoints(hatch([SQUARE]));
    expect(pts).toHaveLength(4);
    expect(pts).toEqual(SQUARE);
  });

  it('συμπεριλαμβάνει τις κορυφές island rings (outer + εσωτερικά)', () => {
    const island: Point2D[] = [
      { x: 3, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 6 },
    ];
    const pts = GeometricCalculations.getEntityEndpoints(hatch([SQUARE, island]));
    expect(pts).toHaveLength(7); // 4 outer + 3 island
    expect(pts).toEqual([...SQUARE, ...island]);
  });

  it('κενό όριο → καμία έλξη', () => {
    expect(GeometricCalculations.getEntityEndpoints(hatch([]))).toHaveLength(0);
  });
});

describe('GeometricCalculations — hatch MIDPOINT snaps', () => {
  it('μέσα ακμών + ακμή κλεισίματος (κλειστός βρόχος)', () => {
    const mids = GeometricCalculations.getEntityMidpoints(hatch([SQUARE]));
    expect(mids).toHaveLength(4);
    expect(mids).toEqual([
      { x: 5, y: 0 },   // (0,0)-(10,0)
      { x: 10, y: 5 },  // (10,0)-(10,10)
      { x: 5, y: 10 },  // (10,10)-(0,10)
      { x: 0, y: 5 },   // ακμή κλεισίματος (0,10)-(0,0)
    ]);
  });

  it('ring < 2 κορυφές → κανένα midpoint', () => {
    expect(GeometricCalculations.getEntityMidpoints(hatch([[{ x: 1, y: 1 }]]))).toHaveLength(0);
  });
});

describe('GeometricCalculations — hatch CENTER snap', () => {
  it('κέντρο bbox του ορίου', () => {
    expect(GeometricCalculations.getEntityCenter(hatch([SQUARE]))).toEqual({ x: 5, y: 5 });
  });

  it('εκφυλισμένο/κενό όριο → null', () => {
    expect(GeometricCalculations.getEntityCenter(hatch([]))).toBeNull();
  });
});
