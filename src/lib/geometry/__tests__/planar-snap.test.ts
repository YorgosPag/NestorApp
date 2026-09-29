/**
 * ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ9.6 — έλξη σε γειτονικούς χώρους (κορυφή πριν από ακμή, μόνο μέσα σε ανοχή) + ορθογώνιος
 * περιορισμός του Shift + η ΜΙΑ προβολή σε τμήμα.
 */

import { closestPointOnSegment, distanceToSegment } from '../planar-polygon';
import { constrainOrthogonal, snapToRings } from '../planar-snap';

const KITCHEN = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }];
const BATH = [{ x: 3.2, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }, { x: 3.2, y: 2 }];

describe('closestPointOnSegment', () => {
  it('προβολή μέσα στο τμήμα · κομμένη στα άκρα · εκφυλισμένο ⇒ το `a`', () => {
    expect(closestPointOnSegment({ x: 1, y: 5 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(closestPointOnSegment({ x: -3, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(closestPointOnSegment({ x: 9, y: 9 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 });
  });

  it('η απόσταση είναι η απόσταση από ΑΥΤΟ το σημείο (μία προβολή, όχι δύο)', () => {
    expect(distanceToSegment({ x: 1, y: 5 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(5);
    expect(distanceToSegment({ x: 7, y: 4 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(5);
  });
});

describe('snapToRings', () => {
  it('κοντά σε γωνία ⇒ ακριβώς η γωνία (κορυφή ΠΡΙΝ από ακμή, κι ας είναι η ακμή πιο κοντά)', () => {
    const snap = snapToRings({ x: 3.05, y: 3.99 }, [KITCHEN], 0.1);
    expect(snap).toEqual({ point: { x: 3, y: 4 }, kind: 'vertex' });
  });

  it('κοντά σε ακμή, μακριά από γωνίες ⇒ πάνω στην ακμή', () => {
    expect(snapToRings({ x: 3.04, y: 2.5 }, [KITCHEN], 0.1)).toEqual({ point: { x: 3, y: 2.5 }, kind: 'edge' });
  });

  it('έξω από την ανοχή ⇒ το σημείο μένει ακριβώς όπου ήταν', () => {
    const at = { x: 3.3, y: 3 };
    expect(snapToRings(at, [KITCHEN], 0.1)).toEqual({ point: at, kind: 'none' });
  });

  it('ανάμεσα σε δύο χώρους ⇒ ο πλησιέστερος · ανοχή 0 ⇒ ποτέ έλξη', () => {
    expect(snapToRings({ x: 3.17, y: 1 }, [KITCHEN, BATH], 0.1).point).toEqual({ x: 3.2, y: 1 });
    expect(snapToRings({ x: 3.01, y: 4 }, [KITCHEN], 0).kind).toBe('none');
  });
});

describe('constrainOrthogonal', () => {
  it('κρατά τη μεγαλύτερη συνιστώσα ⇒ οριζόντια ή κάθετη ακμή', () => {
    expect(constrainOrthogonal({ x: 0, y: 0 }, { x: 3, y: 0.4 })).toEqual({ x: 3, y: 0 });
    expect(constrainOrthogonal({ x: 1, y: 1 }, { x: 1.3, y: -2 })).toEqual({ x: 1, y: -2 });
  });
});
