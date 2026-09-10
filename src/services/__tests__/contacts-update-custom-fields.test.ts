/**
 * Άγκυρα — η αποθήκευση επαφής γράφει το `customFields` ΚΛΕΙΔΙ-ΚΛΕΙΔΙ (ADR-332 D27 Β-ΙΙ Φ0)
 *
 * ## Γιατί υπάρχει
 *
 * Το `updateDoc(ref, { customFields: {...} })` **αντικαθιστά** τον χάρτη. Η αποθήκευση όμως
 * στέλνει dirty diff (ADR-323), οπότε μια αλλαγή **μόνο διευθύνσεων** εταιρείας έγραφε
 * `customFields: { companyAddresses }` και **έσβηνε** ΚΑΔ / ΓΕΜΗ / κεφάλαιο. Κανένα test
 * δεν το έβλεπε: οι σουίτες του saver ελέγχουν την **έξοδο** της συνάρτησης, όχι τι φτάνει
 * στο `updateDoc` (μάθημα D18.1).
 *
 * Εδώ τρέχει η **πραγματική** διαδρομή `updateContactFromForm` → `EnterpriseContactSaver` →
 * `sanitizeContactForUpdate` → `updateContact`· mock μόνο στο σύνορο του Firestore.
 *
 * @see src/utils/contacts/contact-update-paths.ts
 */

import type { ContactFormData, CompanyAddress } from '@/types/ContactFormTypes';

// ---------------------------------------------------------------------------
// Σύνορο Firestore — καταγράφεται ό,τι φτάνει στο `updateDoc`
// ---------------------------------------------------------------------------

const DELETE_SENTINEL = { __deleteField: true } as const;
const updateDocCalls: Array<Record<string, unknown>> = [];

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ __doc: true })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    updateDocCalls.push(data);
  }),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  deleteField: jest.fn(() => DELETE_SENTINEL),
  FieldValue: class {},
}));

jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'user_test', displayName: 'Test', email: null } },
}));

jest.mock('@/lib/firestore/utils', () => ({
  getCol: jest.fn(() => ({ __col: true })),
  asDate: (value: unknown) => value,
}));
jest.mock('@/lib/firestore/converters/contact.converter', () => ({ contactConverter: {} }));

const COMPANY_ID = 'comp_aaaaaaaaaaaaaaaaaaaaaa';
const CONTACT_ID = 'cont_alfa';

/** Η αποθηκευμένη επαφή — με ΚΑΔ και ΓΕΜΗ που ΔΕΝ πρέπει να χαθούν. */
const storedContact = {
  id: CONTACT_ID,
  type: 'company',
  companyName: 'ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.',
  companyId: COMPANY_ID,
  status: 'active',
  customFields: {
    activities: [{ code: '41.20', description: 'Κατασκευή κτιρίων' }],
    gemiStatus: 'Ενεργή',
    chamber: 'ΕΒΕΘ',
    companyAddresses: [
      { type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη' },
    ],
  },
};

jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getById: jest.fn(async () => storedContact) },
}));

jest.mock('../contacts-query.service', () => ({
  getAllContacts: jest.fn(), getAllContactIds: jest.fn(), searchContacts: jest.fn(),
  getContactStatistics: jest.fn(), subscribeToContacts: jest.fn(), exportContacts: jest.fn(),
  importContacts: jest.fn(), archiveMultipleContacts: jest.fn(),
}));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: jest.fn() } }));
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(async () => ({})), delete: jest.fn() },
}));
jest.mock('@/services/photo-upload.service', () => ({
  PhotoUploadService: { cleanupMultiplePhotos: jest.fn(async () => undefined) },
}));
jest.mock('@/utils/contactForm/photo-cleanup', () => ({ cleanupOrphanedPhotos: jest.fn() }));
jest.mock('@/services/contacts/DuplicatePreventionService', () => ({
  DuplicatePreventionService: { detectDuplicates: jest.fn() },
}));

import { ContactsService } from '../contacts.service';

function branch(partial: Partial<CompanyAddress>): CompanyAddress {
  return { type: 'branch', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος', ...partial };
}

beforeEach(() => {
  updateDocCalls.length = 0;
});

describe('ADR-332 D27 Β-ΙΙ Φ0 — το customFields δεν αντικαθίσταται ποτέ ολόκληρο', () => {
  it('αποθήκευση ΜΟΝΟ διευθύνσεων ⇒ διαδρομή πεδίου, ΚΑΔ / ΓΕΜΗ ανέγγιχτα', async () => {
    const hq = storedContact.customFields.companyAddresses[0] as CompanyAddress;
    const dirtyDiff: Partial<ContactFormData> = {
      companyAddresses: [hq, branch({})],
    };

    await ContactsService.updateContactFromForm(CONTACT_ID, dirtyDiff);

    expect(updateDocCalls).toHaveLength(1);
    const payload = updateDocCalls[0];
    // Ο ΧΑΡΤΗΣ δεν γράφεται — αυτό ακριβώς θα έσβηνε activities / gemiStatus / chamber.
    expect(payload).not.toHaveProperty(['customFields']);
    expect(payload['customFields.companyAddresses']).toHaveLength(2);
    // Κανένα αδελφό κλειδί δεν αγγίζεται (ούτε με διαγραφή).
    expect(Object.keys(payload).filter((key) => key.startsWith('customFields.'))).toEqual([
      'customFields.companyAddresses',
    ]);
  });

  it('σβήσιμο ΟΛΩΝ των διευθύνσεων ⇒ διαγραφή του ΚΛΕΙΔΙΟΥ, όχι ολόκληρου του χάρτη', async () => {
    await ContactsService.updateContactFromForm(CONTACT_ID, { companyAddresses: [] });

    const payload = updateDocCalls[0];
    expect(payload).not.toHaveProperty(['customFields']);
    expect(payload['customFields.companyAddresses']).toBe(DELETE_SENTINEL);
  });

  it('ρητό `customFields: null` μένει ρητή διαγραφή του χάρτη (δεν ισοπεδώνεται)', async () => {
    await ContactsService.updateContact(CONTACT_ID, { customFields: null } as unknown as Parameters<
      typeof ContactsService.updateContact
    >[1]);

    expect(updateDocCalls[0]['customFields']).toBe(DELETE_SENTINEL);
  });
});
