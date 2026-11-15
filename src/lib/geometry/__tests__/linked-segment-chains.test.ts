/**
 * ⚓ ADR-929 §6.21.9 (Ε2) — τμήματα → πολυγραμμές από ρητή τοπολογία. Η γωνία ζωγραφίζεται σωστά μόνο ως ΜΙΑ υποδιαδρομή
 * (το `stroke-linejoin` υπάρχει μόνο μέσα σε υποδιαδρομή)· ο βρόχος κλείνει ώστε να ενωθεί και η τελευταία γωνία.
 */

import { describe, expect, it } from '@jest/globals';
import { chainLinkedSegments, coincidentEndLinks, type ChainableSegment } from '../linked-segment-chains';

type P = { readonly x: number; readonly y: number };
const s = (x0: number, y0: number, x1: number, y1: number): ChainableSegment<P> => ({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 } });
const chainsOf = (segments: readonly ChainableSegment<P>[]) => chainLinkedSegments(segments, coincidentEndLinks(segments));
const xy = (points: readonly P[]) => points.map((p) => `${p.x},${p.y}`);

describe('chainLinkedSegments — κάθε τμήμα σε ΑΚΡΙΒΩΣ μία αλυσίδα', () => {
  it('χωρίς ενώσεις: κάθε τμήμα είναι δική του ανοιχτή αλυσίδα δύο σημείων', () => {
    const chains = chainsOf([s(0, 0, 10, 0), s(0, 5, 10, 5)]);
    expect(chains.map((c) => [xy(c.points), c.closed])).toEqual([[['0,0', '10,0'], false], [['0,5', '10,5'], false]]);
  });

  it('γωνία L: ΜΙΑ πολυγραμμή με την κορυφή στη μέση — και όταν το δεύτερο τμήμα είναι αντεστραμμένο', () => {
    expect(xy(chainsOf([s(0, 0, 10, 0), s(10, 0, 10, 10)])[0].points)).toEqual(['0,0', '10,0', '10,10']);
    const reversed = chainsOf([s(0, 0, 10, 0), s(10, 10, 10, 0)]);
    expect(reversed).toHaveLength(1);
    expect(xy(reversed[0].points)).toEqual(['0,0', '10,0', '10,10']);
  });

  it('ορθογώνιο (με ανακατεμένες φορές): ΕΝΑΣ κλειστός βρόχος, τέσσερις κορυφές, τέσσερα τμήματα', () => {
    const chains = chainsOf([s(0, 0, 20, 0), s(20, 10, 20, 0), s(20, 10, 0, 10), s(0, 0, 0, 10)]);
    expect(chains).toHaveLength(1);
    expect(chains[0].closed).toBe(true);
    expect(xy(chains[0].points)).toEqual(['0,0', '20,0', '20,10', '0,10']);
    expect([...chains[0].segmentIndices].sort()).toEqual([0, 1, 2, 3]);
  });

  it('ανοιχτή αλυσίδα που δεν ξεκινά από το πρώτο τμήμα: διασχίζεται από το ελεύθερο άκρο της, ολόκληρη', () => {
    const chains = chainsOf([s(10, 0, 10, 10), s(0, 0, 10, 0), s(10, 10, 20, 10)]);
    expect(chains).toHaveLength(1);
    expect(xy(chains[0].points)).toEqual(['0,0', '10,0', '10,10', '20,10']);
  });

  it('ένα άκρο δέχεται ΜΙΑ ένωση: η πρώτη κατά σειρά εισόδου κερδίζει, οι άλλες μένουν απολήξεις', () => {
    const segments = [s(0, 0, 10, 0), s(10, 0, 10, 10), s(10, 0, 20, 0)];
    const chains = chainLinkedSegments(segments, [
      { a: { index: 0, end: 'end' }, b: { index: 1, end: 'start' } },
      { a: { index: 0, end: 'end' }, b: { index: 2, end: 'start' } },
    ]);
    expect(chains.map((c) => c.segmentIndices)).toEqual([[0, 1], [2]]);
  });

  it('ενώσεις προς ανύπαρκτο ή το ίδιο τμήμα αγνοούνται', () => {
    const chains = chainLinkedSegments([s(0, 0, 10, 0)], [
      { a: { index: 0, end: 'end' }, b: { index: 0, end: 'start' } },
      { a: { index: 0, end: 'end' }, b: { index: 7, end: 'start' } },
    ]);
    expect(chains).toEqual([{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, segmentIndices: [0] }]);
  });
});

describe('coincidentEndLinks — ΑΚΡΙΒΗΣ ταύτιση, μόνο κόμβοι βαθμού 2', () => {
  it('άκρα που απέχουν έστω και ελάχιστα δεν ενώνονται (καμία ανοχή)', () => {
    expect(coincidentEndLinks([s(0, 0, 10, 0), s(10.000001, 0, 10, 10)])).toEqual([]);
  });

  it('τρία άκρα στο ίδιο σημείο (διακλάδωση): καμία ένωση — δεν υπάρχει μία σωστή συνέχεια', () => {
    expect(coincidentEndLinks([s(0, 0, 10, 0), s(10, 0, 10, 10), s(10, 0, 20, 0)])).toEqual([]);
  });

  it('τμήμα μηδενικού μήκους δεν ενώνεται με τον εαυτό του', () => {
    expect(coincidentEndLinks([s(3, 3, 3, 3)])).toEqual([]);
  });
});
