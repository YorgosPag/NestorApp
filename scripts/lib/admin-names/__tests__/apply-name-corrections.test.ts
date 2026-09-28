/**
 * @fileoverview Άγκυρες των ΔΙΟΡΘΩΣΕΩΝ ΟΝΟΜΑΤΟΣ — ADR-893 §7 (τα λάθη γραμμάτων της ΕΛΣΤΑΤ).
 */

import {
  correctedNormalizedName,
  correctionOutcome,
  parseNameCorrections,
  withCorrectedNames,
  type NameCorrection,
} from '../apply-name-corrections';

const STAGIRA: NameCorrection = {
  l: 6,
  c: '130201',
  from: 'ΣΤΑΓΕΙΡΩΝ-ΑΚΑΝΘΟΥ',
  to: 'ΣΤΑΓΙΡΩΝ-ΑΚΑΝΘΟΥ',
  evidence: ['ekloges.ypes.gr/…/5212/'],
};
const ELSTAT_ROW = { n: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΣΤΑΓΕΙΡΩΝ-ΑΚΑΝΘΟΥ', sn: 'ΣΤΑΓΕΙΡΩΝ-ΑΚΑΝΘΟΥ', l: 6, c: '130201' };

describe('correctionOutcome — ιδεμποτεντ, και ΠΟΤΕ σιωπηλό', () => {
  it('η γραμμή λέει ακόμη το παλιό ⇒ διορθώνεται, με το πρόθεμα βαθμίδας όπως ήταν', () => {
    expect(correctionOutcome(ELSTAT_ROW, STAGIRA)).toEqual({
      kind: 'apply',
      n: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΣΤΑΓΙΡΩΝ-ΑΚΑΝΘΟΥ',
      sn: 'ΣΤΑΓΙΡΩΝ-ΑΚΑΝΘΟΥ',
    });
  });

  it('ήδη διορθωμένη — σε οποιαδήποτε γραφή (και μετά τη γραφή εμφάνισης) ⇒ τίποτα', () => {
    const written = { n: 'Δημοτική Ενότητα Σταγίρων-Ακάνθου', sn: 'Σταγίρων-Ακάνθου', l: 6, c: '130201' };
    expect(correctionOutcome(written, STAGIRA)).toEqual({ kind: 'done' });
  });

  it('η πηγή γράφει ΤΡΙΤΟ όνομα ⇒ μπαγιάτικη δήλωση, πρόβλημα με όνομα', () => {
    const renamed = { ...ELSTAT_ROW, sn: 'ΑΛΛΟ ΟΝΟΜΑ', n: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΑΛΛΟ ΟΝΟΜΑ' };
    expect(correctionOutcome(renamed, STAGIRA)).toMatchObject({ kind: 'stale' });
  });
});

describe('withCorrectedNames — αντίγραφα για όποιον ΔΙΑΒΑΖΕΙ το μητρώο', () => {
  it('διορθώνει χωρίς να αγγίξει το πρωτότυπο, και ονομάζει δήλωση χωρίς γραμμή', () => {
    const rows = [ELSTAT_ROW, { n: 'ΔΗΜΟΣ ΑΡΙΣΤΟΤΕΛΗ', sn: 'ΑΡΙΣΤΟΤΕΛΗ', l: 5, c: '1302' }];
    const orphan: NameCorrection = { ...STAGIRA, c: '999999' };
    const result = withCorrectedNames(rows, [STAGIRA, orphan]);
    expect(result.rows[0].sn).toBe('ΣΤΑΓΙΡΩΝ-ΑΚΑΝΘΟΥ');
    expect(result.rows[1]).toBe(rows[1]);
    expect(ELSTAT_ROW.sn).toBe('ΣΤΑΓΕΙΡΩΝ-ΑΚΑΝΘΟΥ');
    expect(result.problems).toEqual(['διόρθωση ονόματος χωρίς γραμμή μητρώου: 6:999999']);
  });
});

describe('parseNameCorrections — γραμμή χωρίς απόδειξη είναι σφάλμα, όχι παράλειψη', () => {
  it('δέχεται έγκυρες, αρνείται χωρίς `evidence`', () => {
    expect(parseNameCorrections({ entries: [STAGIRA] })).toHaveLength(1);
    expect(() => parseNameCorrections({ entries: [{ ...STAGIRA, evidence: [] }] })).toThrow(/άκυρες γραμμές/);
    expect(() => parseNameCorrections({})).toThrow(/entries/);
  });
});

describe('correctedNormalizedName — ίδιο δίπλωμα με τις υπόλοιπες 20.717 γραμμές', () => {
  it('αλλάζει ΜΟΝΟ το κομμάτι του ονόματος, η παύλα μένει κενό όπως στην ΕΛΣΤΑΤ', () => {
    expect(correctedNormalizedName('δημοτικη ενοτητα σταγειρων ακανθου', STAGIRA)).toBe('δημοτικη ενοτητα σταγιρων ακανθου');
  });

  it('το nn δεν περιέχει το παλιό όνομα ⇒ null (πρόβλημα, όχι επινόηση)', () => {
    expect(correctedNormalizedName('δημοτικη ενοτητα αλλο', STAGIRA)).toBeNull();
  });
});
