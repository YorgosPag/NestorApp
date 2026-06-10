/**
 * ADR-422 L7.9-C — tests για την αντιστοίχιση χώρου → πλάκα (footprint containment).
 * jest globals — ΟΧΙ vitest import.
 */

import { findBestSlabMatch, type SlabMatchCandidate } from '../slab-space-match';
import type { Point3D } from '../../../types/bim-base';
import { createDefaultFloorBuildup } from '../../../types/slab-dna-types';

/** Ορθογώνιο outline (κλειστό όχι απαραίτητο — pointInPolygon δεν το χρειάζεται). */
function rect(x0: number, y0: number, x1: number, y1: number): Point3D[] {
  return [
    { x: x0, y: y0, z: 0 },
    { x: x1, y: y0, z: 0 },
    { x: x1, y: y1, z: 0 },
    { x: x0, y: y1, z: 0 },
  ];
}

const dna = createDefaultFloorBuildup();

describe('findBestSlabMatch', () => {
  it('πλάκα που καλύπτει πλήρως τον χώρο → match', () => {
    const footprint = rect(1, 1, 4, 4);
    const candidates: SlabMatchCandidate[] = [
      { id: 'slab-big', outline: rect(0, 0, 10, 10), dna, kind: 'floor' },
    ];
    expect(findBestSlabMatch(footprint, candidates)?.id).toBe('slab-big');
  });

  it('best-overlap: tie-break στη ΜΙΚΡΟΤΕΡΗ πλάκα (πιο ειδική) όταν containment ίσο', () => {
    const footprint = rect(1, 1, 3, 3);
    const candidates: SlabMatchCandidate[] = [
      { id: 'slab-big', outline: rect(0, 0, 20, 20), dna, kind: 'floor' },
      { id: 'slab-small', outline: rect(0, 0, 5, 5), dna, kind: 'floor' },
    ];
    // Και οι δύο περικλείουν 100% τον χώρο → νικά η μικρότερη.
    expect(findBestSlabMatch(footprint, candidates)?.id).toBe('slab-small');
  });

  it('μεγαλύτερο containment νικά ανεξαρτήτως μεγέθους', () => {
    const footprint = rect(4, 4, 8, 8); // κέντρο (6,6)
    const candidates: SlabMatchCandidate[] = [
      { id: 'covers', outline: rect(0, 0, 10, 10), dna, kind: 'floor' }, // 100%
      { id: 'partial', outline: rect(0, 0, 5, 5), dna, kind: 'floor' }, // μόνο 1 κορυφή
    ];
    expect(findBestSlabMatch(footprint, candidates)?.id).toBe('covers');
  });

  it('καμία πλάκα δεν περικλείει τον χώρο → null', () => {
    const footprint = rect(100, 100, 110, 110);
    const candidates: SlabMatchCandidate[] = [
      { id: 'far', outline: rect(0, 0, 10, 10), dna, kind: 'floor' },
    ];
    expect(findBestSlabMatch(footprint, candidates)).toBeNull();
  });

  it('κενές υποψήφιες → null', () => {
    expect(findBestSlabMatch(rect(0, 0, 1, 1), [])).toBeNull();
  });
});
