/**
 * Άγκυρες — η θέση του γραφέα ταξιδεύει στην ΙΔΙΑ εγγραφή της επαφής (ADR-332 D27 Β-ΙΙ Φ3)
 *
 * Τρέχει η **πραγματική** διαδρομή της υπηρεσίας (`updateContactFromForm` / `createContact` /
 * `relocateAddressPin` → saver → όψη θέσης → εφαρμογή απόφασης → `updateContact`). Mock μόνο
 * στα σύνορα: το `apiClient` (η διαδρομή του διακομιστή έχει δικές της άγκυρες) και το Firestore.
 */

import { act, renderHook } from '@testing-library/react';
import type { CompanyAddress } from '@/types/ContactFormTypes';

const DELETE_SENTINEL = { __deleteField: true } as const;
const updateDocCalls: Array<Record<string, unknown>> = [];
const setDocCalls: Array<Record<string, unknown>> = [];

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ __doc: true })),
  setDoc: jest.fn(async (_ref: unknown, data: Record<string, unknown>) => { setDocCalls.push(data); }),
  updateDoc: jest.fn(async (_ref: unknown, data: Record<string, unknown>) => { updateDocCalls.push(data); }),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  deleteField: jest.fn(() => DELETE_SENTINEL),
  FieldValue: class {},
}));
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'user_test', displayName: 'Test', email: null,
      getIdTokenResult: async () => ({ claims: { companyId: 'comp_alpha' } }),
    },
  },
}));
jest.mock('@/lib/firestore/utils', () => ({ getCol: jest.fn(() => ({})), asDate: (v: unknown) => v }));
jest.mock('@/lib/firestore/converters/contact.converter', () => ({ contactConverter: {} }));

const HUMAN = { lat: 40.6617, lng: 22.9204 };
const HQ: CompanyAddress = {
  id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
};
var storedContact: Record<string, unknown> = {};
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getById: jest.fn(async () => storedContact) },
}));

/** Το σύνορο προς τον διακομιστή: καταγράφει και απαντά ό,τι ορίσει το test. */
var posts: Array<{ url: string; body: { addresses: Array<{ id: string }>; relocateAddressIds?: string[] } }> = [];
var respond: (body: { addresses: Array<{ id: string }> }) => unknown = () => ({ positions: [], positionAdvisories: [] });
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    post: jest.fn(async (url: string, body: never) => {
      posts.push({ url, body });
      return respond(body);
    }),
    delete: jest.fn(),
  },
}));

jest.mock('../contacts-query.service', () => ({
  getAllContacts: jest.fn(), getAllContactIds: jest.fn(), searchContacts: jest.fn(),
  getContactStatistics: jest.fn(), subscribeToContacts: jest.fn(), exportContacts: jest.fn(),
  importContacts: jest.fn(), archiveMultipleContacts: jest.fn(),
}));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: jest.fn() } }));
jest.mock('@/services/photo-upload.service', () => ({ PhotoUploadService: { cleanupMultiplePhotos: jest.fn() } }));
jest.mock('@/utils/contactForm/photo-cleanup', () => ({ cleanupOrphanedPhotos: jest.fn() }));
jest.mock('@/services/contacts/DuplicatePreventionService', () => ({
  DuplicatePreventionService: {
    detectDuplicates: jest.fn(async () => ({ isDuplicate: false, recommendations: [], matchingContacts: [], confidence: 0 })),
  },
}));

import { ContactsService } from '../contacts.service';
import { useContactAddressAdvisories } from '../contacts/contact-address-advisories';

/** Ο «διακομιστής» δέχεται τη θέση του ανθρώπου όπως ήρθε και σφραγίζει φρεσκάδα. */
const humanPinServer = (body: { addresses: Array<{ id: string; coordinates?: unknown }> }) => ({
  positions: body.addresses.map((a) => ({ id: a.id, coordinates: a.coordinates, source: 'dragged', verifiedAt: 7 })),
  positionAdvisories: [],
});

beforeEach(() => {
  updateDocCalls.length = 0;
  setDocCalls.length = 0;
  posts = [];
  storedContact = {
    id: 'cont_alfa', type: 'company', companyName: 'ALFA', companyId: 'comp_alpha', status: 'active',
    customFields: { companyAddresses: [HQ] },
  };
  respond = humanPinServer;
});

const addressesWritten = () => updateDocCalls[0]['customFields.companyAddresses'] as CompanyAddress[];

describe('ADR-332 D27 Β-ΙΙ Φ3 — ενημέρωση', () => {
  it('«Μόνο η θέση» → αποθήκευση ⇒ ΜΙΑ ερώτηση, ΕΝΑ updateDoc, θέση + id στη λίστα ΚΑΙ στο παράγωγο', async () => {
    await ContactsService.updateContactFromForm('cont_alfa', {
      companyAddresses: [{ ...HQ, coordinates: HUMAN, source: 'dragged' }],
    });

    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('/api/contacts/cont_alfa/address-positions');
    expect(updateDocCalls).toHaveLength(1);
    expect(addressesWritten()[0]).toMatchObject({ id: 'addr_hq', coordinates: HUMAN, source: 'dragged', verifiedAt: 7 });
    expect((updateDocCalls[0]['addresses'] as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'addr_hq', coordinates: HUMAN, source: 'dragged',
    });
  });

  it('νέο υποκατάστημα: η ταυτότητα δίνεται ΠΡΙΝ την ερώτηση — ίδια στο αίτημα και στην εγγραφή', async () => {
    await ContactsService.updateContactFromForm('cont_alfa', {
      companyAddresses: [HQ, { type: 'branch', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος' }],
    });

    const sentId = posts[0].body.addresses[1].id;
    expect(sentId).toEqual(expect.stringMatching(/^addr_/));
    expect(addressesWritten()[1].id).toBe(sentId);
  });

  it('ο γραφέας δεν απάντησε ⇒ η αποθήκευση ΠΡΟΧΩΡΑ με τις θέσεις της φόρμας (άγνοια ≠ γνώση)', async () => {
    respond = () => { throw new Error('network'); };

    await ContactsService.updateContactFromForm('cont_alfa', {
      companyAddresses: [{ ...HQ, coordinates: HUMAN, source: 'dragged' }],
    });

    expect(updateDocCalls).toHaveLength(1);
    expect(addressesWritten()[0]).toMatchObject({ coordinates: HUMAN, source: 'dragged' });
    expect(addressesWritten()[0].verifiedAt).toBeUndefined();
  });

  it('αποθήκευση χωρίς διευθύνσεις ⇒ καμία ερώτηση στον γραφέα', async () => {
    await ContactsService.updateContactFromForm('cont_alfa', { notes: 'σημείωση' });
    expect(posts).toEqual([]);
  });

  it('η συμβουλή απόκλισης φτάνει στο store της καρτέλας', async () => {
    respond = (body) => ({ ...humanPinServer(body), positionAdvisories: [{ addressId: 'addr_hq', distanceMetres: 900, toleranceMetres: 50 }] });
    const { result } = renderHook(() => useContactAddressAdvisories('cont_alfa'));

    await act(async () => {
      await ContactsService.updateContactFromForm('cont_alfa', { companyAddresses: [{ ...HQ, street: 'Τσιμισκή' }] });
    });

    expect(result.current.map((a) => a.addressId)).toEqual(['addr_hq']);
  });
});

describe('ADR-332 D27 Β-ΙΙ Φ3 — δημιουργία και «Μετακίνησε»', () => {
  it('δημιουργία: η θέση λύνεται ΠΡΙΝ το setDoc, στη διαδρομή νέας επαφής', async () => {
    await ContactsService.createContact({
      type: 'company', companyName: 'NEA', status: 'active',
      customFields: { companyAddresses: [{ ...HQ, id: 'addr_new', coordinates: HUMAN, source: 'dragged' }] },
    } as unknown as Parameters<typeof ContactsService.createContact>[0]);

    expect(posts[0].url).toBe('/api/contacts/address-positions');
    const written = (setDocCalls[0]['customFields'] as { companyAddresses: CompanyAddress[] }).companyAddresses;
    expect(written[0]).toMatchObject({ id: 'addr_new', coordinates: HUMAN, verifiedAt: 7 });
  });

  it('«Μετακίνησε» ⇒ relocate ΜΟΝΟ για αυτή τη διεύθυνση, ΕΝΑ updateDoc, χάρτης customFields άθικτος', async () => {
    await ContactsService.relocateAddressPin('cont_alfa', 'addr_hq');

    expect(posts[0].body.relocateAddressIds).toEqual(['addr_hq']);
    expect(updateDocCalls).toHaveLength(1);
    expect(updateDocCalls[0]).not.toHaveProperty(['customFields']);
    expect(addressesWritten()[0].id).toBe('addr_hq');
    // Β5: η απήχηση κουβαλά τη λίστα που γράφτηκε — η ανοιχτή επαφή τη βλέπει χωρίς επαναφόρτωση.
    const { RealtimeService } = jest.requireMock('@/services/realtime') as { RealtimeService: { dispatch: jest.Mock } };
    expect(RealtimeService.dispatch).toHaveBeenLastCalledWith('CONTACT_UPDATED', expect.objectContaining({
      updates: expect.objectContaining({ companyAddresses: [expect.objectContaining({ id: 'addr_hq', verifiedAt: 7 })] }),
    }));
  });

  it('«Μετακίνησε» σε αποτυχία ⇒ το σφάλμα ΦΤΑΝΕΙ στον άνθρωπο (δεν καταπίνεται)', async () => {
    respond = () => { throw new Error('network'); };
    await expect(ContactsService.relocateAddressPin('cont_alfa', 'addr_hq')).rejects.toThrow('network');
    expect(updateDocCalls).toEqual([]);
  });
});
