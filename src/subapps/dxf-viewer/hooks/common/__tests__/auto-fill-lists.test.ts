/**
 * 🔴 ADR-828 Φ4β — άγκυρες της **γέφυρας** ανάμεσα στις ρυθμίσεις και τη μηχανή σειράς.
 *
 * Το ζητούμενο: ό,τι αποθηκεύει ο άνθρωπος γίνεται υποψήφια που ο ανιχνευτής μπορεί να
 * ρωτήσει — και ό,τι **δεν** μπορεί να είναι σειρά δεν φτάνει ποτέ εκεί σιωπηλά.
 */

import { toNameListCandidates } from '../../../settings/auto-fill-lists';
import type { AutoFillList } from '@/services/user-settings';

const list = (name: string, ...entries: readonly string[]): AutoFillList => ({ name, entries });

describe('αποθηκευμένες λίστες → υποψήφιες', () => {
  it('το όνομα γίνεται κλειδί με πρόθεμα «user:» — ξεχωρίζει από τις ενσωματωμένες', () => {
    const [candidate] = toNameListCandidates([list('Όροφοι', 'Ισόγειο', 'Α΄ όροφος')]);
    expect(candidate.key).toBe('user:Όροφοι');
    expect(candidate.entries).toEqual(['Ισόγειο', 'Α΄ όροφος']);
  });

  it('η σειρά των λιστών διατηρείται — εκείνη ΕΙΝΑΙ η προτεραιότητα', () => {
    const candidates = toNameListCandidates([
      list('Πρώτη', 'α', 'β'),
      list('Δεύτερη', 'γ', 'δ'),
    ]);
    expect(candidates.map((c) => c.key)).toEqual(['user:Πρώτη', 'user:Δεύτερη']);
  });

  /**
   * ⚠️ Μια λίστα με **ένα** όνομα δεν έχει «επόμενο»: η αναδίπλωσή της θα έγραφε την ίδια
   * λέξη σε κάθε κελί, δηλαδή αντιγραφή μεταμφιεσμένη σε σειρά. Πέφτει έξω εδώ ώστε ο
   * ανιχνευτής να μην τη δει ποτέ.
   */
  it('🔑 λίστα με μία εγγραφή ΔΕΝ γίνεται υποψήφια', () => {
    expect(toNameListCandidates([list('Μονή', 'μόνο αυτό')])).toEqual([]);
  });

  it('κενή λίστα δεν γίνεται υποψήφια — και δεν πετά', () => {
    expect(toNameListCandidates([list('Κενή')])).toEqual([]);
  });

  it('οι έγκυρες επιβιώνουν δίπλα στις άκυρες', () => {
    const candidates = toNameListCandidates([list('Μονή', 'ένα'), list('Καλή', 'α', 'β')]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].key).toBe('user:Καλή');
  });

  it('χωρίς λίστες, καμία υποψήφια', () => {
    expect(toNameListCandidates([])).toEqual([]);
  });
});
