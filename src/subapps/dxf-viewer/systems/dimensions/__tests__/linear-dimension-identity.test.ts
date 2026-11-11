/**
 * ⚓ ADR-929 Δ20 Σ1.3 — ταυτότητα γραμμικής διάστασης (η ιδεμποτία της εγγραφής διαστάσεων).
 *
 * Κλειδώνει: ίδια σημεία με οποιαδήποτε σειρά ⇒ ίδια· αντίθετη φορά γραμμής ⇒ ίδια· ίδια σημεία σε ΑΛΛΗ γραμμή
 * διάστασης ή σε άλλη διεύθυνση ⇒ διαφορετική· διπλότυπο μέσα στην παρτίδα ⇒ μία φορά· εκφυλισμένη ⇒ ποτέ γραμμένη·
 * μη γραμμικές / μη διαστάσεις της σκηνής ⇒ αγνοούνται· δεύτερο πέρασμα πάνω στο αποτέλεσμα ⇒ τίποτα νέο.
 */

import { describe, expect, it } from '@jest/globals';
import type { Entity } from '../../../types/entities';
import type { LinearDimensionEntity } from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { isSameLinearDimension, partitionNewLinearDimensions } from '../linear-dimension-identity';

const TOL = 5;

function linear(id: string, o1: Point2D, o2: Point2D, ref: Point2D, rotation = 0): LinearDimensionEntity {
  return {
    id, type: 'dimension', layerId: 'L', dimensionType: 'linear', styleId: 's',
    defPoints: [o1, o2, ref], rotation, userText: '<>',
  };
}

const BASE = linear('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 500 });

describe('isSameLinearDimension', () => {
  it('ίδια σημεία, ίδια γραμμή ⇒ ίδια', () => {
    expect(isSameLinearDimension(BASE, linear('b', { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 500 }), TOL)).toBe(true);
  });

  it('ανάποδη σειρά σημείων, άλλο σημείο αναφοράς πάνω στην ίδια γραμμή, αντίθετη φορά ⇒ ίδια', () => {
    const b = linear('b', { x: 1000, y: 0 }, { x: 0, y: 0 }, { x: 700, y: 500 }, 180);
    expect(isSameLinearDimension(BASE, b, TOL)).toBe(true);
  });

  it('μέσα στην ανοχή ⇒ ίδια· έξω από αυτήν ⇒ διαφορετική', () => {
    expect(isSameLinearDimension(BASE, linear('b', { x: 3, y: 0 }, { x: 1000, y: 2 }, { x: 0, y: 504 }), TOL)).toBe(true);
    expect(isSameLinearDimension(BASE, linear('b', { x: 9, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 500 }), TOL)).toBe(false);
  });

  it('ίδια σημεία, ΑΛΛΗ γραμμή διάστασης (δεύτερη σειρά) ⇒ διαφορετική', () => {
    expect(isSameLinearDimension(BASE, linear('b', { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 900 }), TOL)).toBe(false);
  });

  it('ίδια σημεία, ΑΛΛΗ διεύθυνση (κατακόρυφη μέτρηση) ⇒ διαφορετική', () => {
    expect(isSameLinearDimension(BASE, linear('b', { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 500 }, 90), TOL)).toBe(false);
  });

  it('εκφυλισμένη (χωρίς τρία σημεία) ⇒ ποτέ ίδια, ποτέ throw', () => {
    const broken = { ...BASE, id: 'x', defPoints: [{ x: 0, y: 0 }] };
    expect(isSameLinearDimension(BASE, broken, TOL)).toBe(false);
  });
});

describe('partitionNewLinearDimensions', () => {
  const chain = [
    linear('p1', { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 500 }),
    linear('p2', { x: 1000, y: 0 }, { x: 2500, y: 0 }, { x: 0, y: 500 }),
  ];

  it('κενή σκηνή ⇒ όλες νέες, με τη σειρά της πρότασης', () => {
    const r = partitionNewLinearDimensions(chain, [], TOL);
    expect(r.fresh.map((d) => d.id)).toEqual(['p1', 'p2']);
    expect(r.existing).toBe(0);
  });

  it('όσες υπάρχουν στη σκηνή φεύγουν· μη γραμμικές και μη διαστάσεις αγνοούνται', () => {
    const scene = [
      linear('s1', { x: 1000, y: 0 }, { x: 0, y: 0 }, { x: 300, y: 500 }, 180),
      { ...chain[1], id: 's2', dimensionType: 'aligned' },
      { id: 'w', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
    ] as unknown as readonly Entity[];
    const r = partitionNewLinearDimensions(chain, scene, TOL);
    expect(r.fresh.map((d) => d.id)).toEqual(['p2']);
    expect(r.existing).toBe(1);
  });

  it('διπλότυπο μέσα στην ίδια παρτίδα ⇒ γράφεται μία φορά', () => {
    const twin = linear('p1b', { x: 1000, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 500 });
    const r = partitionNewLinearDimensions([chain[0], twin], [], TOL);
    expect(r.fresh.map((d) => d.id)).toEqual(['p1']);
    expect(r.existing).toBe(1);
  });

  it('εκφυλισμένη πρόταση ⇒ δεν γράφεται (ποτέ μαντεψιά)', () => {
    const broken = { ...chain[0], id: 'bad', defPoints: [] };
    expect(partitionNewLinearDimensions([broken], [], TOL).fresh).toEqual([]);
  });

  it('ιδεμποτία: δεύτερο πέρασμα πάνω στη σκηνή που προέκυψε ⇒ τίποτα νέο', () => {
    const first = partitionNewLinearDimensions(chain, [], TOL);
    const second = partitionNewLinearDimensions(chain, first.fresh as unknown as readonly Entity[], TOL);
    expect(second.fresh).toEqual([]);
    expect(second.existing).toBe(2);
  });
});
