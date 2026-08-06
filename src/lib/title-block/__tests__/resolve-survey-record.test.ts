/**
 * @fileoverview **Σε ποιο** τοπογραφικό γράφει η πινακίδα (ADR-759 Φ3γ, §Δ.3).
 *
 * Ο πίνακας των τεσσάρων εκβάσεων, εκτελέσιμος. Η λεπτή γραμμή που φυλάει είναι ανάμεσα σε
 * **πληθικότητα** (μία εγγραφή ⇒ αυτή) και **ταξινόμηση** (η νεότερη ⇒ αυτή). Το ADR-759 Q1
 * απαγορεύει ρητά το δεύτερο: ανεβάζοντας **παλιότερο** τοπογραφικό, το ενεργό θα άλλαζε από
 * παρενέργεια.
 */

/* global describe, it, expect */
import { resolveSurveyDestination, type SurveySnapshot } from '../resolve-survey-record';

const open = (id: string) => ({ id, isConfirmed: false, label: id });
const frozen = (id: string) => ({ id, isConfirmed: true, label: id });

describe('ο προορισμός των δηλώσεων του τοπογράφου', () => {
  it('καμία εγγραφή ⇒ ορατός φραγμός με ενέργεια, ΟΧΙ αυτόματη δημιουργία', () => {
    // Ο κύκλος ζωής του `survey_records` έχει ονομαστικό ιδιοκτήτη (N.7.2 ερώτημα 7). Μια
    // δεύτερη διαδρομή δημιουργίας από την παλέτα θα γεννούσε άδειες εγγραφές σε κάθε άνοιγμα
    // σχεδίου, με `createdBy` κάποιον που νόμιζε ότι εγκρίνει **μία τιμή**.
    expect(resolveSurveyDestination({ records: [], activeId: null })).toEqual({
      to: 'blocked',
      reason: 'no-survey-record',
    });
  });

  it('🔑 απόν στιγμιότυπο σημαίνει ΚΥΡΙΟΛΕΚΤΙΚΑ «καμία δόθηκε» — όχι εικασία', () => {
    expect(resolveSurveyDestination(undefined)).toEqual({
      to: 'blocked',
      reason: 'no-survey-record',
    });
  });

  it('ΑΚΡΙΒΩΣ μία εγγραφή ⇒ αυτή, χωρίς να χρειάζεται δείκτης', () => {
    // 🔴 Δεν παραβιάζει το Q1: δεν ταξινομείται τίποτα. Με μία εγγραφή, «η ενεργή» και «η
    // μοναδική» είναι η ίδια πρόταση. Χωρίς αυτόν τον κανόνα θα μπλόκαραν **όλα** τα σημερινά
    // έργα, αφού ο δείκτης δεν είχε ποτέ writer μέχρι τη Φ3γ.
    const one: SurveySnapshot = { records: [open('srv_a')], activeId: null };
    expect(resolveSurveyDestination(one)).toEqual({ to: 'record', record: open('srv_a') });
  });

  it('🔴 δύο εγγραφές ΧΩΡΙΣ δείκτη ⇒ αποφασίζει άνθρωπος, ΠΟΤΕ η σειρά', () => {
    const two: SurveySnapshot = { records: [open('srv_a'), open('srv_b')], activeId: null };
    expect(resolveSurveyDestination(two)).toEqual({
      to: 'blocked',
      reason: 'survey-record-undecided',
    });
  });

  it('ο ρητός δείκτης κερδίζει — ακόμη κι όταν δείχνει στη ΔΕΥΤΕΡΗ', () => {
    const two: SurveySnapshot = { records: [open('srv_a'), open('srv_b')], activeId: 'srv_b' };
    expect(resolveSurveyDestination(two)).toEqual({ to: 'record', record: open('srv_b') });
  });

  it('🔴 δείκτης σε ΑΝΥΠΑΡΚΤΗ εγγραφή ΔΕΝ υποχωρεί σιωπηλά στην πρώτη', () => {
    // Η εγγραφή διαγράφηκε. Μια σιωπηλή υποχώρηση στη «πρώτη του πίνακα» θα έγραφε σε άλλο
    // έγγραφο από αυτό που δήλωσε ο μηχανικός — και τίποτα στην οθόνη δεν θα το έλεγε.
    const two: SurveySnapshot = { records: [open('srv_a'), open('srv_b')], activeId: 'srv_gone' };
    expect(resolveSurveyDestination(two)).toEqual({
      to: 'blocked',
      reason: 'survey-record-undecided',
    });
  });

  it('…αλλά με ΜΙΑ εγγραφή, ο νεκρός δείκτης πέφτει στον κανόνα της πληθικότητας', () => {
    const one: SurveySnapshot = { records: [open('srv_a')], activeId: 'srv_gone' };
    expect(resolveSurveyDestination(one)).toEqual({ to: 'record', record: open('srv_a') });
  });

  it('🔒 ΕΠΙΒΕΒΑΙΩΜΕΝΗ εγγραφή ⇒ ορατός αποκλεισμός ΠΡΙΝ το κλικ', () => {
    // Τα rules θα το απέρριπταν έτσι κι αλλιώς. Η αξία του ελέγχου εδώ είναι ότι η οθόνη
    // **δεν υπόσχεται** εγγραφή που ξέρει ότι θα αποτύχει — το μάθημα του `no-primary-address`.
    const one: SurveySnapshot = { records: [frozen('srv_a')], activeId: 'srv_a' };
    expect(resolveSurveyDestination(one)).toEqual({
      to: 'blocked',
      reason: 'survey-record-locked',
    });
  });

  it('🔒 …και το πάγωμα ΔΕΝ παρακάμπτεται διαλέγοντας άλλη: κρίνεται η ΕΠΙΛΕΓΜΕΝΗ', () => {
    const two: SurveySnapshot = { records: [frozen('srv_a'), open('srv_b')], activeId: 'srv_a' };
    expect(resolveSurveyDestination(two)).toEqual({
      to: 'blocked',
      reason: 'survey-record-locked',
    });
  });
});
