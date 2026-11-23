/**
 * ADR-950 §8.3 · §8.5 — consensus δεύτερης ανάγνωσης και τύπος γραμμής. Ο χάρτης είναι ψεύτικος (έχει δικό του test).
 */

import type { DocumentEvidenceField } from '@/schemas/ai-analysis';

const verifyEvidenceAddress = jest.fn();
jest.mock('@/server/files/evidence-address-verification', () => ({
  verifyEvidenceAddress: (reading: unknown) => verifyEvidenceAddress(reading),
}));

import { corroborateEvidence } from '@/server/files/evidence-corroboration';

const FIRST: readonly DocumentEvidenceField[] = [
  { field: 'addressStreet', printed: 'Σαμοφράκης', confidence: 0.95 },
  { field: 'addressNumber', printed: '16', confidence: 0.95 },
  { field: 'addressPostalCode', printed: 'Τ.Κ. 56334', confidence: 0.95 },
  { field: 'addressCity', printed: 'Κορδελιό', confidence: 0.95 },
  { field: 'phone', printed: '2310 55 95 96', confidence: 0.95 },
  { field: 'teeRegistryNumber', printed: 'Μητρώου 74693', confidence: 0.95 },
];

const RECHECK = ['phone', 'addressPostalCode', 'addressNumber', 'teeRegistryNumber'] as const;

beforeEach(() => {
  verifyEvidenceAddress.mockReset();
  verifyEvidenceAddress.mockResolvedValue({ verdict: 'confirmed', verifiedAt: 'x' });
});

it('ψηφίο που διάβασε αλλιώς η δεύτερη ανάγνωση ⇒ `disputed` με τη δεύτερη τιμή· τα υπόλοιπα `agreed`', async () => {
  const second: DocumentEvidenceField[] = [
    { field: 'phone', printed: '2310 55 95 95', confidence: 0.9 },
    { field: 'addressPostalCode', printed: '563 34', confidence: 0.9 },
    { field: 'addressNumber', printed: '16', confidence: 0.9 },
    { field: 'teeRegistryNumber', printed: '74693', confidence: 0.9 },
  ];
  const result = await corroborateEvidence({ purpose: 'stamp-signature', fields: FIRST, recheckFields: RECHECK, rereadDigits: async () => second });
  expect(result.fieldConsensus).toEqual([
    { field: 'phone', state: 'disputed', alternate: '2310 55 95 95' },
    { field: 'addressPostalCode', state: 'agreed', alternate: null },
    { field: 'addressNumber', state: 'agreed', alternate: null },
    { field: 'teeRegistryNumber', state: 'agreed', alternate: null },
  ]);
});

it('η δεύτερη επιστρέφει `null` (ψηφίο καλυμμένο) ⇒ `disputed` χωρίς εναλλακτική', async () => {
  const second: DocumentEvidenceField[] = [{ field: 'phone', printed: null, confidence: 0 }];
  const result = await corroborateEvidence({ purpose: 'stamp-signature', fields: FIRST, recheckFields: ['phone'], rereadDigits: async () => second });
  expect(result.fieldConsensus).toEqual([{ field: 'phone', state: 'disputed', alternate: null }]);
});

it('αποτυχία της δεύτερης κλήσης ⇒ καμία κρίση consensus, η ανάγνωση συνεχίζει', async () => {
  const result = await corroborateEvidence({
    purpose: 'stamp-signature', fields: FIRST, recheckFields: RECHECK, rereadDigits: async () => { throw new Error('AI down'); },
  });
  expect(result.fieldConsensus).toBeUndefined();
  expect(result.addressVerification).toMatchObject({ verdict: 'confirmed' });
});

it('ο χάρτης παίρνει τη ΓΕΙΩΜΕΝΗ διεύθυνση (Τ.Κ. χωρίς ετικέτα)', async () => {
  await corroborateEvidence({ purpose: 'stamp-signature', fields: FIRST, recheckFields: [], rereadDigits: async () => null });
  expect(verifyEvidenceAddress).toHaveBeenCalledWith({ street: 'Σαμοφράκης', number: '16', postalCode: '56334', city: 'Κορδελιό' });
});

it('σταθερό ⇒ `FIXED_LINE` από τα πλήρη μεταδεδομένα του διακομιστή', async () => {
  const result = await corroborateEvidence({ purpose: 'stamp-signature', fields: FIRST, recheckFields: [], rereadDigits: async () => null });
  expect(result.phoneLineType).toBe('FIXED_LINE');
});
