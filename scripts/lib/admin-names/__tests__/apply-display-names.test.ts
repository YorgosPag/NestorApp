/**
 * @fileoverview Άγκυρες της εφαρμογής — «αλλάζει μόνο η γραφή, ποτέ η ταυτότητα» — ADR-893.
 */

import { applyDisplayNames, type WritableNamedRow } from '../apply-display-names';

function rows(): WritableNamedRow[] {
  return [
    { n: 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ', sn: 'ΑΘΗΝΑΙΩΝ', l: 5, c: '4501' },
    { n: 'Τοπική Κοινότητα Ανθοχωρίου', sn: 'Ανθοχωρίου', l: 7, c: '01010102' },
  ];
}

describe('applyDisplayNames', () => {
  it('γράφει τη γραφή, και ΜΟΝΟ στη γραμμή με τον ίδιο (βαθμίδα, κωδικό)', () => {
    const target = rows();
    const outcome = applyDisplayNames(target, [{ l: 5, c: '4501', n: 'Δήμος Αθηναίων', sn: 'Αθηναίων' }]);
    expect(outcome).toEqual({ applied: 1, problems: [] });
    expect(target[0]).toEqual({ n: 'Δήμος Αθηναίων', sn: 'Αθηναίων', l: 5, c: '4501' });
    expect(target[1].n).toBe('Τοπική Κοινότητα Ανθοχωρίου');
  });

  it('άλλες λέξεις ⇒ πρόβλημα, και η γραμμή μένει ανέγγιχτη', () => {
    const target = rows();
    const outcome = applyDisplayNames(target, [{ l: 5, c: '4501', n: 'Δήμος Πειραιώς', sn: 'Πειραιώς' }]);
    expect(outcome.applied).toBe(0);
    expect(outcome.problems[0]).toMatch(/άλλες λέξεις/);
    expect(target[0].n).toBe('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ');
  });

  it('μπαγιάτικος πίνακας (γραμμή που δεν υπάρχει πια) ⇒ πρόβλημα, όχι σιωπή', () => {
    const outcome = applyDisplayNames(rows(), [{ l: 5, c: '9999', n: 'Δήμος Πουθενά', sn: 'Πουθενά' }]);
    expect(outcome.problems[0]).toMatch(/χωρίς γραμμή μητρώου/);
  });

  it('ο κωδικός ΜΑΖΙ με τη βαθμίδα — οι κωδικοί συμπίπτουν ανάμεσα σε βαθμίδες', () => {
    const outcome = applyDisplayNames(rows(), [{ l: 4, c: '4501', n: 'Δήμος Αθηναίων', sn: 'Αθηναίων' }]);
    expect(outcome.applied).toBe(0);
  });
});
