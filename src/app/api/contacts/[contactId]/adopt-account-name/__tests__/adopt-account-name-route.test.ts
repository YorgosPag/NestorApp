/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ «ΥΙΟΘΕΤΗΣΗ ΟΝΟΜΑΤΟΣ ΑΠΟ ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ»** — ADR-915 §40.9.
 * @related app/api/contacts/[contactId]/adopt-account-name/route.ts
 *
 * Τι φυλάει: (1) το όνομα έρχεται **από τον server**, ποτέ από το σώμα · (2) CAS ⇒ 409 αντί σιωπηλής αντικατάστασης ·
 * (3) ένας λογαριασμός και δομημένο όνομα, αλλιώς ρητό σφάλμα · (4) cascade + ίχνος **μόνο** όταν γράφτηκε κάτι ·
 * (5) αποτυχία cascade **αναφέρεται**, δεν ρίχνει την ήδη γραμμένη υιοθέτηση.
 * 🔑 Ο πυρήνας της πρότασης/σύγκρισης (`contact-account-name-match`) είναι **ΠΡΑΓΜΑΤΙΚΟΣ** — ψεύτικα είναι μόνο η
 *    ταυτότητα, η βάση, ο αναγνώστης λογαριασμού, το cascade και το ιστορικό.
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({ NextResponse: class {}, NextRequest: class {} }));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T>(h: T) => h }));

const authContext = { uid: 'user_1', email: 'office@example.com', companyId: 'comp_alfa' };
jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authContext, {}),
}));

jest.mock('@/lib/api/ApiErrorHandler', () => {
  const { ApiError } = jest.requireActual('@/lib/api/api-error-types');
  return { ApiError, apiSuccess: (data: unknown) => ({ data }) };
});

/** Το έγγραφο της επαφής όπως το βλέπει η συναλλαγή — κάθε δοκιμή ορίζει το δικό της. */
let contactDoc: Record<string, unknown> | undefined;
const txUpdate = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ get: async () => ({ data: () => contactDoc }), update: txUpdate }),
  }),
}));

const loadOwnedContact = jest.fn(async () => ({ data: contactDoc }));
jest.mock('../../../_shared/contact-owned-doc', () => ({ loadOwnedContact: (spec: unknown) => loadOwnedContact(spec) }));

type AccountRead = { outcome: 'ok'; identity: Record<string, unknown> } | { outcome: 'none' | 'ambiguous' | 'unknown' };
let accountRead: AccountRead;
jest.mock('@/server/engagements/contact-engagement-link.server', () => ({
  readSoleAcceptedAccount: async () => accountRead,
}));

const propagate = jest.fn(async (): Promise<{ success: boolean; error?: string }> => ({ success: true }));
jest.mock('@/lib/firestore/cascade-propagation.service', () => ({
  propagateContactNameChange: (...args: unknown[]) => propagate(...(args as [])),
}));

const recordChange = jest.fn(async () => 'audit_1');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (params: unknown) => recordChange(params as never) },
}));

jest.mock('@/server/lib/performer-stamp', () => ({
  resolvePerformer: async () => ({ uid: 'user_1', name: 'Γραφείο' }),
  performerStamp: () => ({ _lastModifiedBy: 'user_1' }),
  auditActorOf: () => ({ performedBy: 'user_1', performedByName: 'Γραφείο' }),
}));
jest.mock('@/lib/audit/audit-performer', () => ({ userPerformer: () => ({ kind: 'user' }) }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));

import { POST } from '../route';

const OFFICE_NAME = { firstName: 'Αλέξανδρος', lastName: 'Μαυρίδης' };
const ACCOUNT = { uid: 'acc_1', displayName: 'ΓΕΩΡΓΙΟΣ ΠΕΑΣ', givenName: 'Γεώργιος', familyName: 'Πέας' };

function call(expectedCurrent: { firstName: string | null; lastName: string | null } = OFFICE_NAME) {
  const request = { json: async () => ({ expectedCurrent }) };
  const handler = POST as unknown as (req: unknown, seg: unknown) => Promise<{ data: unknown }>;
  return handler(request, { params: Promise.resolve({ contactId: 'cont_1' }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  contactDoc = { type: 'individual', ...OFFICE_NAME };
  accountRead = { outcome: 'ok', identity: ACCOUNT };
  propagate.mockResolvedValue({ success: true });
});

describe('adopt-account-name — η εγγραφή', () => {
  it('γράφει το δομημένο όνομα του λογαριασμού, μετά ιστορικό και cascade με το νέο όνομα', async () => {
    await expect(call()).resolves.toEqual({ data: { outcome: 'adopted', nameCascade: 'complete' } });
    expect(txUpdate).toHaveBeenCalledWith(
      { id: 'cont_1' },
      expect.objectContaining({ firstName: 'Γεώργιος', lastName: 'Πέας', _lastModifiedBy: 'user_1' }),
    );
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 'cont_1',
      entityName: 'Γεώργιος Πέας',
      companyId: 'comp_alfa',
      changes: [
        { field: 'firstName', oldValue: 'Αλέξανδρος', newValue: 'Γεώργιος' },
        { field: 'lastName', oldValue: 'Μαυρίδης', newValue: 'Πέας' },
      ],
    }));
    expect(propagate).toHaveBeenCalledWith('cont_1', 'Γεώργιος Πέας');
  });

  it('ίδιο όνομα ⇒ unchanged: καμία εγγραφή, κανένα ιστορικό, κανένα cascade', async () => {
    contactDoc = { type: 'individual', firstName: 'Γεώργιος', lastName: ' Πέας ' };
    await expect(call()).resolves.toEqual({ data: { outcome: 'unchanged', nameCascade: 'not-needed' } });
    expect(txUpdate).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });

  it('το cascade αποτυγχάνει ⇒ adopted + failed: η επαφή μένει γραμμένη, ο άνθρωπος ειδοποιείται', async () => {
    propagate.mockResolvedValue({ success: false, error: 'boom' });
    await expect(call()).resolves.toEqual({ data: { outcome: 'adopted', nameCascade: 'failed' } });
    expect(txUpdate).toHaveBeenCalledTimes(1);
  });

  it('το cascade πετά ⇒ επίσης failed, ποτέ 500 πάνω σε ήδη γραμμένη επαφή', async () => {
    propagate.mockRejectedValue(new Error('network'));
    await expect(call()).resolves.toEqual({ data: { outcome: 'adopted', nameCascade: 'failed' } });
  });
});

describe('adopt-account-name — οι αρνήσεις', () => {
  it('η επαφή άλλαξε από τότε που την είδε το γραφείο ⇒ 409 CONTACT_CHANGED, καμία εγγραφή', async () => {
    contactDoc = { type: 'individual', firstName: 'Αλέξης', lastName: 'Μαυρίδης' };
    await expect(call()).rejects.toMatchObject({ statusCode: 409, errorCode: 'CONTACT_CHANGED' });
    expect(txUpdate).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });

  it('νομικό πρόσωπο ⇒ 422 NOT_INDIVIDUAL', async () => {
    contactDoc = { type: 'company', companyName: 'Α.Ε.' };
    await expect(call()).rejects.toMatchObject({ statusCode: 422, errorCode: 'NOT_INDIVIDUAL' });
  });

  it('λογαριασμός μόνο με ενιαίο όνομα ⇒ 422 NO_STRUCTURED_NAME (καμία μαντεψιά διάσπασης)', async () => {
    accountRead = { outcome: 'ok', identity: { ...ACCOUNT, givenName: null, familyName: null } };
    await expect(call()).rejects.toMatchObject({ statusCode: 422, errorCode: 'NO_STRUCTURED_NAME' });
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('μόνο το όνομα χωρίς επώνυμο ⇒ επίσης 422 NO_STRUCTURED_NAME', async () => {
    accountRead = { outcome: 'ok', identity: { ...ACCOUNT, familyName: '  ' } };
    await expect(call()).rejects.toMatchObject({ statusCode: 422, errorCode: 'NO_STRUCTURED_NAME' });
  });

  it('δύο αποδεκτοί λογαριασμοί ⇒ 409 AMBIGUOUS_ACCOUNT', async () => {
    accountRead = { outcome: 'ambiguous' };
    await expect(call()).rejects.toMatchObject({ statusCode: 409, errorCode: 'AMBIGUOUS_ACCOUNT' });
  });

  it('κανένας αποδεκτός λογαριασμός ⇒ 409 NO_LINKED_ACCOUNT', async () => {
    accountRead = { outcome: 'none' };
    await expect(call()).rejects.toMatchObject({ statusCode: 409, errorCode: 'NO_LINKED_ACCOUNT' });
  });

  it('ο λογαριασμός δεν διαβάστηκε ⇒ 503, ποτέ «κανένας»', async () => {
    accountRead = { outcome: 'unknown' };
    await expect(call()).rejects.toMatchObject({ statusCode: 503 });
  });

  it('η ιδιοκτησία της επαφής ελέγχεται ΠΡΙΝ από κάθε άλλη ανάγνωση', async () => {
    loadOwnedContact.mockRejectedValueOnce(Object.assign(new Error('Contact not found'), { statusCode: 404 }));
    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
    expect(txUpdate).not.toHaveBeenCalled();
  });
});
