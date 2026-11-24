/** ADR-950 §8.5 · §8.6 · §9 — τύπος τηλεφώνου · «Συμπλήρωση κενών» · «Καταχώριση» · αρ. μητρώου επαγγέλματος. */

import {
  acceptEvidence,
  acceptEvidenceBatch,
  canRegisterEvidence,
  fillableEvidenceRows,
  fillableEvidenceSeat,
  formDataChanges,
} from '@/lib/contacts/contact-evidence-acceptance';
import { compareEvidenceWithForm, type EvidenceReading, type EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import type { DocumentEvidenceField } from '@/schemas/ai-analysis';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';

const AT = '2026-11-23T20:20:01.097Z';

const FIELDS: readonly DocumentEvidenceField[] = [
  { field: 'vatNumber', printed: '094 063 140', confidence: 0.95 },
  { field: 'taxOffice', printed: 'Δ.Ο.Υ. Ιωνίας', confidence: 0.95 },
  { field: 'addressStreet', printed: 'Σαμοθράκης', confidence: 0.95 },
  { field: 'addressNumber', printed: '16', confidence: 0.95 },
  { field: 'addressPostalCode', printed: 'Τ.Κ. 56334', confidence: 0.95 },
  { field: 'addressCity', printed: 'Κορδελιό', confidence: 0.95 },
  { field: 'phone', printed: '2310 55 95 95', confidence: 0.95 },
  { field: 'teeRegistryNumber', printed: 'Μητρώου 74693', confidence: 0.95 },
];

const READING: EvidenceReading = {
  fields: FIELDS,
  phoneLineType: 'FIXED_LINE',
  addressVerification: { verdict: 'confirmed', places: ['Θεσσαλονίκη'], verifiedAt: AT },
};

const EMPTY: ContactFormData = { ...initialFormData, firstName: 'Γεώργιος', lastName: 'Παγώνης' };

function rowsOf(formData: ContactFormData, reading: EvidenceReading = READING): readonly EvidenceRow[] {
  return compareEvidenceWithForm({ reading, purpose: 'stamp-signature', formData, contactType: 'individual', dismissals: [] });
}

function rowOf(rows: readonly EvidenceRow[], key: EvidenceRow['key']): EvidenceRow {
  const found = rows.find((r) => r.key === key);
  if (found === undefined) throw new Error(`no row ${key}`);
  return found;
}

describe('«Προσθήκη» τηλεφώνου — τύπος από τον τύπο γραμμής', () => {
  it('σταθερό σε φυσικό πρόσωπο ⇒ «Οικίας» (`home`), όχι «Κινητό»', () => {
    const phone = rowOf(rowsOf(EMPTY), 'phone');
    expect(acceptEvidence(EMPTY, phone, 'individual').phones?.[0]).toMatchObject({ type: 'home', number: '2310559595' });
  });
});

describe('«Συμπλήρωση κενών»', () => {
  it('μόνο κενά, μόνο γειωμένα — και ο αρ. ΤΕΕ, ΧΩΡΙΣ προϋπάρχουσα ιδιότητα «Μηχανικός» (ADR-950 §9)', () => {
    const keys = fillableEvidenceRows(rowsOf(EMPTY)).map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['vatNumber', 'taxOffice', 'phone', 'teeRegistryNumber']));
    expect(keys).not.toContain('address');
  });

  it('ποτέ αντικατάσταση: πεδίο με άλλη τιμή δεν προσφέρεται', () => {
    const filled: ContactFormData = { ...EMPTY, vatNumber: '123456789' };
    expect(fillableEvidenceRows(rowsOf(filled)).map((r) => r.key)).not.toContain('vatNumber');
  });

  it('η διεύθυνση προσφέρεται ως πρόταση όταν η έδρα είναι κενή', () => {
    expect(fillableEvidenceSeat(rowsOf(EMPTY))?.key).toBe('address');
  });

  it('μία αλλαγή φόρμας με ΟΛΑ τα επιλεγμένα', () => {
    const next = acceptEvidenceBatch(EMPTY, fillableEvidenceRows(rowsOf(EMPTY)), 'individual');
    expect(next).toMatchObject({ vatNumber: '094063140', taxOffice: '1317' });
    expect(next.phones).toHaveLength(1);
    expect(next.personaData.engineer?.teeRegistryNumber).toBe('74693');
  });
});

describe('αρ. μητρώου επαγγέλματος — η αποδοχή ενεργοποιεί την ιδιότητα (ADR-950 §9)', () => {
  it('αρ. ΤΕΕ ⇒ `engineer` ενεργός + ο αριθμός στο πεδίο του· η γραμμή γίνεται «Ταιριάζει»', () => {
    const next = acceptEvidence(EMPTY, rowOf(rowsOf(EMPTY), 'teeRegistryNumber'), 'individual');
    expect(next.activePersonas).toEqual(['engineer']);
    expect(next.personaData.engineer).toMatchObject({ teeRegistryNumber: '74693', engineerSpecialty: null });
    expect(rowOf(rowsOf(next), 'teeRegistryNumber').state).toBe('match');
  });

  it('δεν αγγίζει ό,τι είχε ήδη η ιδιότητα', () => {
    const engineer: ContactFormData = { ...EMPTY, activePersonas: ['engineer'], personaData: { engineer: { engineerSpecialty: 'civil' } } };
    const next = acceptEvidence(engineer, rowOf(rowsOf(engineer), 'teeRegistryNumber'), 'individual');
    expect(next.personaData.engineer).toMatchObject({ teeRegistryNumber: '74693', engineerSpecialty: 'civil' });
    expect(next.activePersonas).toEqual(['engineer']);
  });

  it('δικηγόρος: αριθμός ΚΑΙ σύλλογος γράφονται μαζί', () => {
    const reading: EvidenceReading = {
      fields: [
        { field: 'barAssociationNumber', printed: 'Α.Μ. 4521', confidence: 0.95 },
        { field: 'barAssociation', printed: 'Δ.Σ.Θ.', confidence: 0.95 },
      ],
    };
    const next = acceptEvidence(EMPTY, rowOf(rowsOf(EMPTY, reading), 'barAssociationNumber'), 'individual');
    expect(next.activePersonas).toEqual(['lawyer']);
    expect(next.personaData.lawyer).toMatchObject({ barAssociationNumber: '4521', barAssociation: 'Δ.Σ.Θ.' });
  });
});

describe('«Καταχώριση» με ένα πάτημα (ADR-950 §9)', () => {
  it('μόνο «Λείπει από την επαφή» με γειωμένη τιμή', () => {
    const rows = rowsOf(EMPTY);
    expect(canRegisterEvidence(rowOf(rows, 'vatNumber'))).toBe(true);
    expect(canRegisterEvidence(rowOf(rows, 'teeRegistryNumber'))).toBe(true);
    expect(canRegisterEvidence(rowOf(rows, 'address'))).toBe(false);
  });

  it('ποτέ αντικατάσταση: «Διαφέρει» θέλει επεξεργασία', () => {
    const filled: ContactFormData = { ...EMPTY, vatNumber: '123456789' };
    expect(canRegisterEvidence(rowOf(rowsOf(filled), 'vatNumber'))).toBe(false);
  });

  it('ποτέ αβέβαιη τιμή: διαφωνία δεύτερης ανάγνωσης δεν καταχωρίζεται', () => {
    const disputed: EvidenceReading = { ...READING, fieldConsensus: [{ field: 'teeRegistryNumber', state: 'disputed', alternate: '74698' }] };
    expect(canRegisterEvidence(rowOf(rowsOf(EMPTY, disputed), 'teeRegistryNumber'))).toBe(false);
  });

  it('στην αποθήκευση φεύγει ΜΟΝΟ ό,τι άλλαξε', () => {
    const vat = acceptEvidence(EMPTY, rowOf(rowsOf(EMPTY), 'vatNumber'), 'individual');
    expect(formDataChanges(EMPTY, vat)).toEqual({ vatNumber: '094063140' });
    const tee = acceptEvidence(EMPTY, rowOf(rowsOf(EMPTY), 'teeRegistryNumber'), 'individual');
    expect(Object.keys(formDataChanges(EMPTY, tee)).sort()).toEqual(['activePersonas', 'personaData']);
    expect(formDataChanges(EMPTY, EMPTY)).toEqual({});
  });
});
