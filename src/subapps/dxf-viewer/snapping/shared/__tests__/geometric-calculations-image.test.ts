/**
 * ADR-651/654 — Image / 2D furniture entourage snap-point extraction (έπιπλα → έλξεις).
 *
 * Κλειδώνει ότι το SSoT `GeometricCalculations` παράγει ENDPOINT (4 rotated γωνίες
 * του πλαισίου) + MIDPOINT (μέσα των 4 ακμών) για raster image entities — ώστε ο
 * measure-tool της δημόσιας κάτοψης (και ο editor) να κουμπώνει πάνω στα έπιπλα.
 * Επαναχρησιμοποιεί το ΙΔΙΟ `imageEntityRectVertices` που ζωγραφίζει ο renderer.
 */

import { GeometricCalculations } from '../GeometricCalculations';
import type { Entity } from '../../extended-types';
import type { Point2D } from '../../../rendering/types/Types';

const image = (o: Partial<{ position: Point2D; width: number; height: number; rotation: number }>): Entity =>
  ({ id: 'img1', type: 'image', url: 'furn.webp', visible: true, ...o } as unknown as Entity);

const sortPts = (pts: Point2D[]): Point2D[] =>
  [...pts].sort((a, b) => (a.x - b.x) || (a.y - b.y));

describe('GeometricCalculations — image ENDPOINT snaps (4 corners)', () => {
  it('επιστρέφει τις 4 γωνίες του πλαισίου (rotation 0, pivot = position κάτω-αριστερά)', () => {
    const pts = GeometricCalculations.getEntityEndpoints(image({ position: { x: 0, y: 0 }, width: 10, height: 6 }));
    expect(pts).toHaveLength(4);
    expect(sortPts(pts)).toEqual(sortPts([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 },
    ]));
  });

  it('rotation ≠ 0 → 4 γωνίες, το pivot (position) μένει σταθερό', () => {
    const pts = GeometricCalculations.getEntityEndpoints(
      image({ position: { x: 5, y: 5 }, width: 4, height: 2, rotation: 90 }),
    );
    expect(pts).toHaveLength(4);
    // Ο pivot (position) είναι πάντα μία από τις γωνίες, αμετάβλητος από την περιστροφή.
    expect(pts).toContainEqual({ x: 5, y: 5 });
  });

  it('λείπει width/height → καμία έλξη', () => {
    expect(GeometricCalculations.getEntityEndpoints(image({ position: { x: 0, y: 0 } }))).toHaveLength(0);
  });
});

describe('GeometricCalculations — image MIDPOINT snaps (4 edge mids)', () => {
  it('μέσα των 4 ακμών του πλαισίου (κλειστός βρόχος)', () => {
    const mids = GeometricCalculations.getEntityMidpoints(image({ position: { x: 0, y: 0 }, width: 10, height: 6 }));
    expect(mids).toHaveLength(4);
    expect(sortPts(mids)).toEqual(sortPts([
      { x: 5, y: 0 }, { x: 10, y: 3 }, { x: 5, y: 6 }, { x: 0, y: 3 },
    ]));
  });

  it('λείπει width/height → κανένα midpoint', () => {
    expect(GeometricCalculations.getEntityMidpoints(image({ position: { x: 0, y: 0 } }))).toHaveLength(0);
  });
});
