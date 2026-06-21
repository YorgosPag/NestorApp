/**
 * AABB SSoT — `aabbIntersectsRaw` + `BoundsOperations.intersects` delegation.
 * Προστατεύει το allocation-free primitive που χρησιμοποιεί το hatch segment culling.
 */

import { aabbIntersectsRaw, BoundsOperations } from '../bounds-operations';
import { createBoundingBox } from '../Bounds';

describe('aabbIntersectsRaw', () => {
  it('overlap → true', () => {
    expect(aabbIntersectsRaw(0, 0, 10, 10, 5, 5, 15, 15)).toBe(true);
  });
  it('disjoint κατά X → false', () => {
    expect(aabbIntersectsRaw(0, 0, 10, 10, 20, 0, 30, 10)).toBe(false);
  });
  it('disjoint κατά Y → false', () => {
    expect(aabbIntersectsRaw(0, 0, 10, 10, 0, 20, 10, 30)).toBe(false);
  });
  it('edge touch → true (inclusive)', () => {
    expect(aabbIntersectsRaw(0, 0, 10, 10, 10, 0, 20, 10)).toBe(true);
  });
  it('το ένα μέσα στο άλλο → true', () => {
    expect(aabbIntersectsRaw(0, 0, 100, 100, 40, 40, 60, 60)).toBe(true);
  });
});

describe('BoundsOperations.intersects delegates στο aabbIntersectsRaw', () => {
  it('ίδιο αποτέλεσμα με το primitive', () => {
    const a = createBoundingBox(0, 0, 10, 10);
    const overlap = createBoundingBox(5, 5, 15, 15);
    const disjoint = createBoundingBox(50, 50, 60, 60);
    expect(BoundsOperations.intersects(a, overlap)).toBe(aabbIntersectsRaw(0, 0, 10, 10, 5, 5, 15, 15));
    expect(BoundsOperations.intersects(a, disjoint)).toBe(false);
  });
});
