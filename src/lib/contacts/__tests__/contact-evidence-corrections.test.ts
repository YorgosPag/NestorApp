/**
 * ADR-950 §10 — **διόρθωση ανάγνωσης**: ο άνθρωπος διαβάζει ο ίδιος τη γραμμή. Η ανάγνωση είναι η πραγματική του
 * `.jpg` της σφραγίδας Παγώνη (ζωντανός έλεγχος 2026-11-24): ΑΦΜ καλυμμένος από την υπογραφή, τηλέφωνο με διαφωνία
 * δεύτερης ανάγνωσης, διεύθυνση «δεν επιβεβαιώθηκε στον χάρτη» — οι τρεις γραμμές που ήταν αδιέξοδο.
 */

import { canRegisterEvidence, canProposeEvidenceSeat } from '@/lib/contacts/contact-evidence-acceptance';
import { evidenceDocumentKey, type EvidenceReading, type EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import {
  applyEvidenceCorrections,
  checkEvidenceCorrection,
  compareEvidenceWithCorrections,
  evidenceCorrectionFields,
  evidenceRowFieldSpecs,
  machineReadingSignature,
  preferredReading,
  readEvidenceCorrections,
  withEvidenceCorrection,
  withoutEvidenceCorrection,
} from '@/lib/contacts/contact-evidence-corrections';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';
import type { EvidenceCorrection } from '@/types/file-record';

const PURPOSE = 'stamp-signature';
const AT = '2026-11-24T11:50:00.000Z';
const VALID_VAT = '040817944';

const READING: EvidenceReading = {
  fields: [
    { field: 'fullName', printed: 'Παγώνης Ν. Γεώργιος', confidence: 0.95 },
    { field: 'vatNumber', printed: '0408 7944', confidence: 0.95 },
    { field: 'taxOffice', printed: 'Δ.Ο.Υ. Ιωνίας', confidence: 0.95 },
    { field: 'addressStreet', printed: 'Σαμοφράκης', confidence: 0.95 },
    { field: 'addressNumber', printed: '16', confidence: 0.95 },
    { field: 'addressPostalCode', printed: '56334', confidence: 0.95 },
    { field: 'addressCity', printed: 'Κορδελιό', confidence: 0.95 },
    { field: 'phone', printed: '2310 55.95.96', confidence: 0.95 },
  ],
  fieldConsensus: [{ field: 'phone', state: 'disputed', alternate: '2310 55.95.95' }],
  addressVerification: { verdict: 'unverified', places: [], verifiedAt: AT },
};

const formData: ContactFormData = { ...initialFormData, firstName: 'Γεώργιος', lastName: 'Παγώνης' };

function correctionOf(row: EvidenceCorrection['row'], values: EvidenceCorrection['values'], reading: EvidenceReading = READING): EvidenceCorrection {
  return {
    row,
    values,
    machineReadingAtCorrection: machineReadingSignature(reading, evidenceRowFieldSpecs(PURPOSE, row)),
    correctedBy: 'uid-1',
    correctedAt: AT,
  };
}

function rowsOf(corrections: readonly EvidenceCorrection[], reading: EvidenceReading = READING): readonly EvidenceRow[] {
  return compareEvidenceWithCorrections({ reading, purpose: PURPOSE, formData, contactType: 'individual', dismissals: [], corrections });
}

function row(rows: readonly EvidenceRow[], key: EvidenceRow['key']): EvidenceRow {
  const found = rows.find((r) => r.key === key);
  if (found === undefined) throw new Error(`no row ${key}`);
  return found;
}

describe('χωρίς διόρθωση — οι τρεις γραμμές είναι αδιέξοδο', () => {
  const rows = rowsOf([]);

  it('ΑΦΜ · τηλέφωνο · διεύθυνση δεν συγκρίνονται και δεν καταχωρίζονται', () => {
    expect(row(rows, 'vatNumber')).toMatchObject({ state: 'not-comparable', ungrounded: 'failed-check' });
    expect(row(rows, 'phone')).toMatchObject({ state: 'not-comparable', ungrounded: 'disputed' });
    expect(row(rows, 'address')).toMatchObject({ state: 'not-comparable', ungrounded: 'unverified' });
    expect(rows.filter(canRegisterEvidence).map((r) => r.key)).not.toEqual(expect.arrayContaining(['vatNumber', 'phone']));
  });

  it('καμία γραμμή δεν φέρει σημείωση διόρθωσης', () => {
    expect(rows.every((r) => r.correction === undefined)).toBe(true);
  });
});

describe('η διόρθωση κάνει τη γραμμή συγκρίσιμη — και τα υπάρχοντα κουμπιά δουλεύουν', () => {
  it('ΑΦΜ του ανθρώπου ⇒ «Λείπει από την επαφή», καταχωρίσιμο, με ό,τι είχε διαβάσει η μηχανή', () => {
    const vat = row(rowsOf([correctionOf('vatNumber', { vatNumber: VALID_VAT })]), 'vatNumber');
    expect(vat).toMatchObject({ state: 'missing', ungrounded: null, documentDisplay: VALID_VAT, documentKey: VALID_VAT });
    expect(vat.correction).toEqual({ machinePrinted: '0408 7944', stale: false });
    expect(canRegisterEvidence(vat)).toBe(true);
  });

  it('τηλέφωνο: η διαφωνία δεύτερης ανάγνωσης παύει — την έλυσε ο άνθρωπος', () => {
    const phone = row(rowsOf([correctionOf('phone', { phone: '2310 55 95 95' })]), 'phone');
    expect(phone).toMatchObject({ state: 'missing', ungrounded: null, documentDisplay: '+302310559595', documentAlternate: null });
    expect(canRegisterEvidence(phone)).toBe(true);
  });

  it('διεύθυνση: ο χάρτης δεν μπλοκάρει την ανάγνωση του ανθρώπου — γίνεται πρόταση έδρας', () => {
    const values = { addressStreet: 'Σαμοθράκης', addressNumber: '16', addressPostalCode: '56334', addressCity: 'Κορδελιό' };
    const address = row(rowsOf([correctionOf('address', values)]), 'address');
    expect(address).toMatchObject({ state: 'missing', ungrounded: null, correctedFrom: null });
    expect(address.seat?.document).toEqual({ street: 'Σαμοθράκης', number: '16', postalCode: '56334', city: 'Κορδελιό' });
    expect(canProposeEvidenceSeat(address)).toBe(true);
    // Η διεύθυνση δεν καταχωρίζεται ποτέ με ένα πάτημα — ιδιοκτήτης της είναι ο editor έδρας (ADR-948).
    expect(canRegisterEvidence(address)).toBe(false);
  });

  it('μέρος διεύθυνσης που άφησε κενό ο άνθρωπος δεν «ξαναγεμίζει» από τη μηχανή', () => {
    const address = row(rowsOf([correctionOf('address', { addressStreet: 'Σαμοθράκης', addressPostalCode: '56334' })]), 'address');
    expect(address.seat?.document).toEqual({ street: 'Σαμοθράκης', number: null, postalCode: '56334', city: null });
  });

  it('οι άλλες γραμμές μένουν ανέγγιχτες', () => {
    const rows = rowsOf([correctionOf('vatNumber', { vatNumber: VALID_VAT })]);
    expect(row(rows, 'phone')).toMatchObject({ ungrounded: 'disputed' });
    expect(row(rows, 'phone').correction).toBeUndefined();
  });

  it('το κλειδί «Αγνόησης» του διακομιστή είναι η τιμή του ανθρώπου — ίδιο με του πίνακα', () => {
    const corrected = applyEvidenceCorrections(READING, PURPOSE, [correctionOf('vatNumber', { vatNumber: VALID_VAT })]);
    expect(evidenceDocumentKey(corrected, PURPOSE, 'vatNumber')).toBe(VALID_VAT);
    expect(evidenceDocumentKey(READING, PURPOSE, 'vatNumber')).toBeNull();
  });
});

describe('νέα ανάγνωση της μηχανής ⇒ η διόρθωση μένει, αλλά ζητά ξανά κρίση', () => {
  it('ίδια ανάγνωση ⇒ όχι μπαγιάτικη · άλλη ανάγνωση ⇒ `stale`', () => {
    const correction = correctionOf('vatNumber', { vatNumber: VALID_VAT });
    const reread: EvidenceReading = {
      ...READING,
      fields: READING.fields.map((f) => (f.field === 'vatNumber' ? { ...f, printed: '0408 719 944' } : f)),
    };
    expect(row(rowsOf([correction]), 'vatNumber').correction?.stale).toBe(false);
    const after = row(rowsOf([correction], reread), 'vatNumber');
    expect(after.correction).toEqual({ machinePrinted: '0408 719 944', stale: true });
    expect(after.documentDisplay).toBe(VALID_VAT);
  });
});

describe('ο έλεγχος της τιμής του ανθρώπου — οι ίδιοι ελεγκτές με τη μηχανή', () => {
  it('ΑΦΜ που δεν περνά το ψηφίο ελέγχου απορρίπτεται', () => {
    expect(checkEvidenceCorrection(PURPOSE, 'vatNumber', { vatNumber: '040817945' })).toMatchObject({ ok: false, invalid: ['vatNumber'] });
    expect(checkEvidenceCorrection(PURPOSE, 'vatNumber', { vatNumber: ` ${VALID_VAT} ` })).toEqual({ ok: true, values: { vatNumber: VALID_VAT }, invalid: [] });
  });

  it('κενή τιμή δεν είναι διόρθωση', () => {
    expect(checkEvidenceCorrection(PURPOSE, 'phone', { phone: '  ' }).ok).toBe(false);
    expect(checkEvidenceCorrection(PURPOSE, 'address', {}).ok).toBe(false);
  });

  it('διεύθυνση: όποια μέρη δώσει ο άνθρωπος· ξένα πεδία αγνοούνται', () => {
    const check = checkEvidenceCorrection(PURPOSE, 'address', { addressStreet: 'Σαμοθράκης', vatNumber: VALID_VAT });
    expect(check).toEqual({ ok: true, values: { addressStreet: 'Σαμοθράκης' }, invalid: [] });
  });

  it('Τ.Κ. με λάθος μορφή απορρίπτεται', () => {
    expect(checkEvidenceCorrection(PURPOSE, 'address', { addressPostalCode: '5633' }).invalid).toEqual(['addressPostalCode']);
  });

  it('αριθμός μητρώου με παραρτήματα θέλει και τον εκδότη', () => {
    expect(checkEvidenceCorrection(PURPOSE, 'barAssociationNumber', { barAssociationNumber: '1234' })).toMatchObject({ ok: false, invalid: ['barAssociation'] });
    expect(checkEvidenceCorrection(PURPOSE, 'barAssociationNumber', { barAssociationNumber: '1234', barAssociation: 'Θεσσαλονίκης' }).ok).toBe(true);
  });

  it('γραμμή που δεν ανήκει στο είδος εγγράφου δεν διορθώνεται', () => {
    expect(checkEvidenceCorrection('tax', 'phone', { phone: '2310559595' }).ok).toBe(false);
    expect(checkEvidenceCorrection(null, 'vatNumber', { vatNumber: VALID_VAT }).ok).toBe(false);
  });
});

describe('τα πεδία του διαλόγου', () => {
  it('ξεκινούν με ό,τι διάβασε η μηχανή και φέρουν τη δεύτερη ανάγνωση', () => {
    const [phone] = evidenceCorrectionFields(READING, PURPOSE, 'phone', null);
    expect(phone).toEqual({ key: 'phone', kind: 'phone', machine: '2310 55.95.96', alternate: '2310 55.95.95', initial: '2310 55.95.96' });
  });

  it('με διόρθωση, ξεκινούν από αυτήν — και ό,τι άφησε κενό μένει κενό', () => {
    const fields = evidenceCorrectionFields(READING, PURPOSE, 'address', correctionOf('address', { addressStreet: 'Σαμοθράκης' }));
    expect(fields.map((f) => [f.key, f.initial])).toEqual([
      ['addressStreet', 'Σαμοθράκης'],
      ['addressNumber', ''],
      ['addressPostalCode', ''],
      ['addressCity', ''],
    ]);
  });

  it('προτιμά την ανάγνωση που περνά ΜΟΝΗ της τον ελεγκτή — αλλιώς καμία', () => {
    const vat = { key: 'vatNumber', kind: 'vat', machine: '040817914', alternate: VALID_VAT, initial: '040817914' } as const;
    expect(preferredReading(vat)).toBe(VALID_VAT);
    // Δύο έγκυρα τηλέφωνα ⇒ ο άνθρωπος διαλέγει κοιτώντας την εικόνα.
    expect(preferredReading(evidenceCorrectionFields(READING, PURPOSE, 'phone', null)[0])).toBeNull();
  });
});

describe('το μητρώο διορθώσεων', () => {
  const first = correctionOf('vatNumber', { vatNumber: VALID_VAT });

  it('μία διόρθωση ανά γραμμή — η νέα αντικαθιστά την παλιά', () => {
    const second = { ...first, correctedAt: '2026-11-25T08:00:00.000Z' };
    expect(withEvidenceCorrection(withEvidenceCorrection([], first), second)).toEqual([second]);
    expect(withoutEvidenceCorrection([first], 'vatNumber')).toEqual([]);
    expect(withoutEvidenceCorrection([first], 'phone')).toEqual([first]);
  });

  it('ό,τι κρατά ο δίσκος κρίνεται — άκυρη γραμμή παραλείπεται, δεν σβήνει τις υπόλοιπες', () => {
    const raw = [first, { ...first, row: 'addressStreet' }, { ...first, values: { nope: 'x' } }, { ...first, values: {} }, { ...first, correctedBy: '' }, null];
    expect(readEvidenceCorrections(raw)).toEqual([first]);
    expect(readEvidenceCorrections(undefined)).toEqual([]);
  });
});
