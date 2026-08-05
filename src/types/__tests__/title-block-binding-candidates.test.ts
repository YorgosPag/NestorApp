/**
 * @fileoverview 🔴 Η ΙΣΟΠΑΛΙΑ — «καμία προεπιλογή όταν η κορυφή δεν κέρδισε» (ADR-745 §6.4, Δ2).
 *
 * Το ADR λέει ρητά ότι *«μια λάθος ταυτοποίηση είναι χειρότερη από καμία»*. Ο κώδικας το τηρούσε
 * στον **Λ2** (που παράγει επίτηδες όλους τους υποψηφίους) και το **παραβίαζε στο UI**, που
 * έπαιρνε `candidates[0]` με το κουμπί έγκρισης ενεργό.
 *
 * 🔑 **Δύο αυθαιρεσίες, όχι μία** — και η δεύτερη είναι ο λόγος που αυτό το αρχείο υπάρχει:
 * ένας έλεγχος ισοπαλίας γραμμένος ως `compareBindingCandidates(a,b) === 0` πιάνει **μόνο** την
 * πρώτη, επειδή το τρίτο σκέλος του συγκριτή (`label.localeCompare`) σπάει τεχνητά την ισοπαλία
 * μεταξύ **διαφορετικών ανθρώπων**.
 */

import {
  candidatesTieOnEvidence,
  compareBindingCandidates,
  unambiguousWinner,
} from '@/types/title-block-binding';
import type { BindingCandidate, BindingEvidence } from '@/types/title-block-binding';

const contact = (
  contactId: string,
  role: 'architect' | 'surveyor' | 'structural_engineer',
  label: string,
  evidence: BindingEvidence[],
): BindingCandidate => ({
  target: { kind: 'contact', contactId, role, projectId: 'proj_1' },
  label,
  evidence,
});

const NAME_EXACT: BindingEvidence = { kind: 'name-exact', value: 'Μαυρομιχάλης Κωνσταντίνος' };
const EMAIL: BindingEvidence = { kind: 'email', value: 'info@x.gr' };

describe('unambiguousWinner — καμία προεπιλογή χωρίς αυστηρό νικητή', () => {
  it('🔑 (α) ΙΔΙΑ ΕΠΑΦΗ × ΠΟΛΛΟΙ ΡΟΛΟΙ ⇒ null (η «Μηχανικός» ανήκει σε 5 από τους 7)', () => {
    // Ταυτόσημο label, ταυτόσημη μαρτυρία — διαφέρουν ΜΟΝΟ στον ρόλο. Ό,τι κι αν διαλέξει ο
    // κώδικας εδώ, το διαλέγει στα τυφλά.
    const candidates = [
      contact('cont_1', 'architect', 'Μαυρομιχάλης Κωνσταντίνος', [NAME_EXACT]),
      contact('cont_1', 'surveyor', 'Μαυρομιχάλης Κωνσταντίνος', [NAME_EXACT]),
      contact('cont_1', 'structural_engineer', 'Μαυρομιχάλης Κωνσταντίνος', [NAME_EXACT]),
    ];
    expect(unambiguousWinner(candidates)).toBeNull();
  });

  it('🔴 (β) ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΟΙ ΑΝΘΡΩΠΟΙ με ταυτόσημη μαρτυρία ⇒ null', () => {
    // Αυτό είναι το test που πέφτει αν η θεραπεία γραφτεί ως `compare(a,b) === 0`: τα labels
    // διαφέρουν, άρα ο πλήρης συγκριτής **δεν** δίνει μηδέν και ο πρώτος αλφαβητικά «κερδίζει».
    // Γράφει λάθος ΑΝΘΡΩΠΟ, όχι λάθος ρόλο.
    const a = contact('cont_1', 'architect', 'Παπαδόπουλος Γεώργιος', [NAME_EXACT]);
    const b = contact('cont_2', 'architect', 'Παπαδόπουλος Γρηγόριος', [NAME_EXACT]);

    expect(compareBindingCandidates(a, b)).not.toBe(0); // ← η παγίδα, ρητά
    expect(candidatesTieOnEvidence(a, b)).toBe(true);
    expect(unambiguousWinner([a, b])).toBeNull();
  });

  it('ΙΣΧΥΡΟΤΕΡΗ μαρτυρία κερδίζει ⇒ ο άνθρωπος δεν ενοχλείται', () => {
    // Το e-mail είναι ταυτότητα, το όνομα ένδειξη. Ζητώντας επιλογή και εδώ, θα εκπαιδεύαμε τον
    // χρήστη να πατά ό,τι βρει — και ο επιλογέας θα έχανε τη σημασία του.
    const strong = contact('cont_1', 'surveyor', 'Νικολάου Α.', [EMAIL, NAME_EXACT]);
    const weak = contact('cont_2', 'surveyor', 'Νικολάου Β.', [NAME_EXACT]);
    expect(unambiguousWinner([strong, weak])).toBe(strong);
  });

  it('ΠΕΡΙΣΣΟΤΕΡΕΣ μαρτυρίες ίδιας ισχύος κερδίζουν', () => {
    const two = contact('cont_1', 'surveyor', 'Α', [EMAIL, NAME_EXACT]);
    const one = contact('cont_2', 'surveyor', 'Β', [EMAIL]);
    expect(unambiguousWinner([two, one])).toBe(two);
  });

  it('🔴 ΜΗ ΟΠΙΣΘΟΔΡΟΜΗΣΗ: ΕΝΑΣ υποψήφιος με ΚΕΝΗ μαρτυρία επιστρέφεται πάντα', () => {
    // Ο δήμος, η περιοχή και το Ο.Τ. παράγουν έναν υποψήφιο με `evidence: []` — δεν τίθεται
    // ερώτημα ταυτότητας. Χωρίς αυτόν τον φρουρό, η σύγκριση «κενή vs undefined» θα έβγαζε
    // ισοπαλία και θα έκλεινε τα μόνα κουμπιά που δουλεύουν σήμερα.
    const value: BindingCandidate = {
      target: { kind: 'project-field', projectId: 'proj_1', field: 'buildingBlock', value: 'Ο.Τ. Γ 753' },
      label: 'Ο.Τ. Γ 753',
      evidence: [],
    };
    expect(unambiguousWinner([value])).toBe(value);
  });

  it('κενή λίστα ⇒ null, χωρίς εξαίρεση', () => {
    expect(unambiguousWinner([])).toBeNull();
  });
});
