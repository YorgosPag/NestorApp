/**
 * ADR-777 §8.79 — **η άκρη σβήνει ΜΟΝΟ όταν η λωρίδα συνεχίζει**.
 *
 * Ο αριθμός έρχεται από τον browser· εδώ κλειδώνεται η **κρίση**. Το σήμα που λέει «συνεχίζει»
 * εκεί που δεν συνεχίζει είναι χειρότερο από κανένα σήμα — γι' αυτό μετρά και το «none».
 */

import { scrollEdgesOf, scrollHiddenOf } from '../useScrollEdges';

describe('scrollEdgesOf — προς ποια πλευρά συνεχίζει η λωρίδα', () => {
  // Μετρημένο 2026-09-25: λωρίδα ~294 px, περιεχόμενο ~372 px (τέσσερις ελληνικές ετικέτες).
  const CLIENT = 294;
  const SCROLL = 372;

  it('Ε1: στην αρχή ⇒ `end` (το «Επαγ|» σβήνει, δεν κόβεται)', () => {
    expect(scrollEdgesOf(0, CLIENT, SCROLL)).toBe('end');
  });

  it('Ε2: στη μέση ⇒ `both`', () => {
    expect(scrollEdgesOf(40, CLIENT, SCROLL)).toBe('both');
  });

  it('Ε3: στο τέλος ⇒ `start` — η τελευταία καρτέλα ΔΕΝ σβήνει', () => {
    expect(scrollEdgesOf(SCROLL - CLIENT, CLIENT, SCROLL)).toBe('start');
  });

  it('Ε4 (ΠΑΡΟΝΟΜΑΣΤΗΣ): όλα χωρούν (desktop) ⇒ `none` — καμία μάσκα', () => {
    expect(scrollEdgesOf(0, 600, 372)).toBe('none');
  });

  it('Ε5: υποπίξελ κύλιση (zoom/DPR) δεν είναι «υπάρχει κι άλλο»', () => {
    expect(scrollEdgesOf(0.5, CLIENT, CLIENT + 0.5)).toBe('none');
  });

  it('Ε6: RTL (`scrollLeft` ≤ 0) κρίνεται με την απόλυτη απόσταση από την αρχή', () => {
    expect(scrollEdgesOf(-(SCROLL - CLIENT), CLIENT, SCROLL)).toBe('start');
  });
});

describe('scrollHiddenOf — το σβήσιμο δεν ξεπερνά όσα κρύβει (ADR-930 §3.11)', () => {
  // Μετρημένο 2026-11-06 στη Ροή Πωλήσεων: θυρίδα 2080 px, περιεχόμενο 2094 px ⇒ κρυμμένα μόλις 14 px.
  it('Κ1: στην αρχή ⇒ τίποτα πριν, 14 px μετά', () => {
    expect(scrollHiddenOf(0, 2080, 2094)).toEqual({ before: 0, after: 14 });
  });

  it('Κ2: στο τέλος ⇒ 14 px πριν, τίποτα μετά', () => {
    expect(scrollHiddenOf(14, 2080, 2094)).toEqual({ before: 14, after: 0 });
  });

  it('Κ3 (ΠΑΡΟΝΟΜΑΣΤΗΣ): όλα χωρούν ⇒ μηδέν — ποτέ αρνητικό', () => {
    expect(scrollHiddenOf(0, 600, 372)).toEqual({ before: 0, after: 0 });
  });

  it('Κ4: RTL (`scrollLeft` ≤ 0) ⇒ απόλυτη απόσταση από την αρχή', () => {
    expect(scrollHiddenOf(-40, 294, 372)).toEqual({ before: 40, after: 38 });
  });
});
