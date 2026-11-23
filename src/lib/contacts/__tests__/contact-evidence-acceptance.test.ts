/** ADR-950 §8.5 · §8.6 — τύπος τηλεφώνου από τον τύπο γραμμής · «Συμπλήρωση κενών». */

import {
  acceptEvidence,
  acceptEvidenceBatch,
  fillableEvidenceRows,
  fillableEvidenceSeat,
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

function rowsOf(formData: ContactFormData): readonly EvidenceRow[] {
  return compareEvidenceWithForm({ reading: READING, purpose: 'stamp-signature', formData, contactType: 'individual', dismissals: [] });
}

describe('«Προσθήκη» τηλεφώνου — τύπος από τον τύπο γραμμής', () => {
  it('σταθερό σε φυσικό πρόσωπο ⇒ «Οικίας» (`home`), όχι «Κινητό»', () => {
    const phone = rowsOf(EMPTY).find((r) => r.key === 'phone');
    if (phone === undefined) throw new Error('no phone row');
    expect(acceptEvidence(EMPTY, phone, 'individual').phones?.[0]).toMatchObject({ type: 'home', number: '2310559595' });
  });
});

describe('«Συμπλήρωση κενών»', () => {
  it('μόνο κενά, μόνο γειωμένα — ο αρ. ΤΕΕ θέλει ενεργή ιδιότητα «Μηχανικός»', () => {
    const keys = fillableEvidenceRows(rowsOf(EMPTY), EMPTY).map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['vatNumber', 'taxOffice', 'phone']));
    expect(keys).not.toContain('teeRegistryNumber');
    expect(keys).not.toContain('address');
  });

  it('με ενεργό «Μηχανικό» μπαίνει και ο αρ. ΤΕΕ', () => {
    const engineer: ContactFormData = { ...EMPTY, activePersonas: ['engineer'] };
    expect(fillableEvidenceRows(rowsOf(engineer), engineer).map((r) => r.key)).toContain('teeRegistryNumber');
  });

  it('ποτέ αντικατάσταση: πεδίο με άλλη τιμή δεν προσφέρεται', () => {
    const filled: ContactFormData = { ...EMPTY, vatNumber: '123456789' };
    expect(fillableEvidenceRows(rowsOf(filled), filled).map((r) => r.key)).not.toContain('vatNumber');
  });

  it('η διεύθυνση προσφέρεται ως πρόταση όταν η έδρα είναι κενή', () => {
    expect(fillableEvidenceSeat(rowsOf(EMPTY))?.key).toBe('address');
  });

  it('μία αλλαγή φόρμας με ΟΛΑ τα επιλεγμένα', () => {
    const next = acceptEvidenceBatch(EMPTY, fillableEvidenceRows(rowsOf(EMPTY), EMPTY), 'individual');
    expect(next).toMatchObject({ vatNumber: '094063140', taxOffice: '1317' });
    expect(next.phones).toHaveLength(1);
  });
});
