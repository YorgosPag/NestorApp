/**
 * ADR-950 §8 — η σύγκριση **με τα τεκμήρια του διακομιστή**: διαφωνία δεύτερης ανάγνωσης · επαλήθευση διεύθυνσης ·
 * τύπος γραμμής. Η ανάγνωση είναι η πραγματική του `file_f6d8a0c9…` (ζωντανός έλεγχος 2026-11-23).
 */

import {
  compareEvidenceWithForm,
  evidenceDocumentKey,
  type EvidenceReading,
  type EvidenceRow,
} from '@/lib/contacts/contact-evidence-comparison';
import type { DocumentEvidenceField, EvidenceAddressVerification } from '@/schemas/ai-analysis';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';

const PURPOSE = 'stamp-signature';
const AT = '2026-11-23T20:20:01.097Z';

const FIELDS: readonly DocumentEvidenceField[] = [
  { field: 'fullName', printed: 'Παγώνης Ν. Γεώργιος', confidence: 0.95 },
  { field: 'vatNumber', printed: '0408 719 944', confidence: 0.95 },
  { field: 'taxOffice', printed: 'Δ.Ο.Υ. Ιωνίας', confidence: 0.95 },
  { field: 'addressStreet', printed: 'Σαμοφράκης', confidence: 0.95 },
  { field: 'addressNumber', printed: '16', confidence: 0.95 },
  { field: 'addressPostalCode', printed: 'Τ.Κ. 56334', confidence: 0.95 },
  { field: 'addressCity', printed: 'Κορδελιό', confidence: 0.95 },
  { field: 'phone', printed: '2310 55 95 96', confidence: 0.95 },
  { field: 'teeRegistryNumber', printed: 'Μητρώου 74693', confidence: 0.95 },
];

const CORRECTED: EvidenceAddressVerification = {
  verdict: 'corrected',
  correctedStreet: 'Σαμοθράκης',
  places: ['Κορδελιό', 'Περιφερειακή Ενότητα Θεσσαλονίκης'],
  verifiedAt: AT,
};

const formData: ContactFormData = { ...initialFormData, firstName: 'Γεώργιος', lastName: 'Παγώνης' };

function rowsOf(reading: EvidenceReading, form: ContactFormData = formData): readonly EvidenceRow[] {
  return compareEvidenceWithForm({ reading, purpose: PURPOSE, formData: form, contactType: 'individual', dismissals: [] });
}

function row(rows: readonly EvidenceRow[], key: EvidenceRow['key']): EvidenceRow {
  const found = rows.find((r) => r.key === key);
  if (found === undefined) throw new Error(`no row ${key}`);
  return found;
}

describe('διαφωνία δεύτερης ανάγνωσης ⇒ «Αβέβαιο»', () => {
  const reading: EvidenceReading = {
    fields: FIELDS,
    fieldConsensus: [{ field: 'phone', state: 'disputed', alternate: '2310 55 95 95' }],
  };

  it('το τηλέφωνο δεν γίνεται αποδεκτό και δείχνει και τη δεύτερη τιμή', () => {
    const phone = row(rowsOf(reading), 'phone');
    expect(phone).toMatchObject({ ungrounded: 'disputed', documentDisplay: null, documentAlternate: '2310 55 95 95', state: 'not-comparable' });
  });

  it('ο διακομιστής δεν αφήνει «Αγνόηση» σε αμφισβητούμενη τιμή', () => {
    expect(evidenceDocumentKey(reading, PURPOSE, 'phone')).toBeNull();
  });

  it('συμφωνία ⇒ κανονική γραμμή', () => {
    const agreed = row(rowsOf({ fields: FIELDS, fieldConsensus: [{ field: 'phone', state: 'agreed', alternate: null }] }), 'phone');
    expect(agreed).toMatchObject({ ungrounded: null, state: 'missing', documentDisplay: '+302310559596' });
  });
});

describe('διεύθυνση — ο χάρτης κρίνει', () => {
  it('χωρίς επαλήθευση (παλιά ανάγνωση) ⇒ «Δεν επιβεβαιώθηκε», καμία πρόταση', () => {
    expect(row(rowsOf({ fields: FIELDS }), 'address')).toMatchObject({ ungrounded: 'unverified', documentDisplay: null, documentKey: null });
  });

  it('`unavailable` ⇒ το ίδιο: καμία κρίση = καμία πρόταση', () => {
    const reading = { fields: FIELDS, addressVerification: { verdict: 'unavailable' as const, verifiedAt: AT } };
    expect(row(rowsOf(reading), 'address').documentKey).toBeNull();
  });

  it('`corrected` ⇒ «Μήπως: Σαμοθράκης» με Τ.Κ., και το τυπωμένο δίπλα', () => {
    const address = row(rowsOf({ fields: FIELDS, addressVerification: CORRECTED }), 'address');
    expect(address).toMatchObject({
      ungrounded: null,
      state: 'missing',
      correctedFrom: 'Σαμοφράκης',
      documentDisplay: 'Σαμοθράκης 16 56334 Κορδελιό',
    });
    expect(address.seat?.document).toEqual({ street: 'Σαμοθράκης', number: '16', postalCode: '56334', city: 'Κορδελιό' });
  });

  it('`confirmed` ⇒ η τυπωμένη οδός, χωρίς «Μήπως»', () => {
    const reading = { fields: FIELDS, addressVerification: { verdict: 'confirmed' as const, verifiedAt: AT } };
    expect(row(rowsOf(reading), 'address')).toMatchObject({ ungrounded: null, correctedFrom: null, documentDisplay: 'Σαμοφράκης 16 56334 Κορδελιό' });
  });

  it('πίνακας και διακομιστής δίνουν το ΙΔΙΟ κλειδί «Αγνόησης» (με τη διορθωμένη οδό)', () => {
    const reading = { fields: FIELDS, addressVerification: CORRECTED };
    expect(evidenceDocumentKey(reading, PURPOSE, 'address')).toBe(row(rowsOf(reading), 'address').documentKey);
  });

  it('αμφισβητούμενος αριθμός οδού ⇒ όλη η διεύθυνση «Αβέβαιη»', () => {
    const reading: EvidenceReading = {
      fields: FIELDS,
      addressVerification: CORRECTED,
      fieldConsensus: [{ field: 'addressNumber', state: 'disputed', alternate: '18' }],
    };
    expect(row(rowsOf(reading), 'address')).toMatchObject({ ungrounded: 'disputed', documentKey: null });
  });
});

describe('ΔΟΥ, ΤΕΕ, τύπος γραμμής', () => {
  const reading: EvidenceReading = { fields: FIELDS, addressVerification: CORRECTED, phoneLineType: 'FIXED_LINE' };

  it('η ΔΟΥ αποσαφηνίζεται από τους τόπους του χάρτη ⇒ 1317', () => {
    expect(row(rowsOf(reading), 'taxOffice')).toMatchObject({ ungrounded: null, documentDisplay: '1317' });
  });

  it('ο αρ. ΤΕΕ είναι μόνο ο αριθμός', () => {
    expect(row(rowsOf(reading), 'teeRegistryNumber')).toMatchObject({ documentDisplay: '74693', documentKey: '74693' });
  });

  it('ο τύπος γραμμής φτάνει στη γραμμή του τηλεφώνου', () => {
    expect(row(rowsOf(reading), 'phone').phoneLineType).toBe('FIXED_LINE');
  });
});
