/**
 * ADR-777 §8.79 — **η άκρη σβήνει ΜΟΝΟ όταν η λωρίδα συνεχίζει**.
 *
 * Ο αριθμός έρχεται από τον browser· εδώ κλειδώνεται η **κρίση**. Το σήμα που λέει «συνεχίζει»
 * εκεί που δεν συνεχίζει είναι χειρότερο από κανένα σήμα — γι' αυτό μετρά και το «none».
 */

import { scrollEdgesOf } from '../useScrollEdges';

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
