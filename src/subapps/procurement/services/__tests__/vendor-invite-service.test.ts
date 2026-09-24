/**
 * @jest-environment node
 *
 * @fileoverview **Υπηρεσία πρόσκλησης** — φράχτης μισθωτή (ADR-876 §5 Σ15 · ADR-742 §4) + ιδεμποτική ανάκληση (Σ20).
 *
 * Τ1 `fetchVendorContact`: επαφή **χωρίς** `companyId` δεν ανήκει σε κανέναν. Έγραφε
 *    `data.companyId && data.companyId !== companyId` ⇒ επαφή χωρίς tenant περνούσε, και ο
 *    σύνδεσμος της πύλης (που ανοίγει το RFQ) θα έφευγε στο email της — το ΙΔΙΟ σφάλμα που το
 *    `rfq-service` είχε ήδη διορθώσει στο δίδυμό του.
 * Τ2 `getVendorInvite`: η παγίδα του κενού — `''` δεν είναι tenant.
 * Τ3 `revokeVendorInvite`: ήδη ανακλημένη ⇒ επιτυχία χωρίς εγγραφή/audit · υποβεβλημένη ⇒ `not_live` ·
 *    προ-migration `'expired'` ⇒ `not_live` (ΟΧΙ σιωπηλή «επιτυχία» χωρίς ανάκληση συνδέσμων).
 *
 * Κάθε ισχυρισμός περνά από την **πραγματική** εξαγόμενη συνάρτηση (μάθημα ADR-742 §7quater:
 * το test του εργαλείου δεν αποδεικνύει ότι κάποιος το καλεί).
 */

jest.mock('server-only', () => ({}));

const mockGet = jest.fn();
const mockTxUpdate = jest.fn();
const mockDb = {
  collection: () => ({ doc: () => ({ get: mockGet }) }),
  runTransaction: (fn: (tx: unknown) => unknown) => fn({ get: mockGet, update: mockTxUpdate }),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: (fn: (db: unknown) => unknown) => fn(mockDb),
  getAdminFirestore: () => mockDb,
  FieldValue: {},
}));
jest.mock('firebase-admin', () => ({ __esModule: true, default: { firestore: { Timestamp: { now: jest.fn() } } } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../channels', () => ({ resolveChannel: jest.fn() }));
jest.mock('../rfq-service', () => ({ getRfq: jest.fn() }));
jest.mock('../vendor-invite-issue', () => ({ prepareVendorInvite: jest.fn(), writePreparedVendorInvite: jest.fn() }));
const mockAudit = jest.fn();
jest.mock('../vendor-invite-audit', () => ({ recordVendorInviteAudit: (...a: unknown[]) => mockAudit(...a) }));
jest.mock('@/services/vendor-portal/vendor-invite-credential-store', () => ({
  readLiveCredentialRefsTx: jest.fn().mockResolvedValue([{ id: 'vic_1' }]),
}));
jest.mock('@/services/vendor-portal/admin-client-timestamp', () => ({
  adminTimestampAsClient: jest.fn(),
  adminTimestampFromDateAsClient: jest.fn(),
}));

import type { AuthContext } from '@/lib/auth';

import { fetchVendorContact, getVendorInvite, revokeVendorInvite } from '../vendor-invite-service';

const snap = (data: Record<string, unknown>) => ({ exists: true, id: 'doc_1', data: () => data });

beforeEach(() => jest.clearAllMocks());

describe('Τ1 — fetchVendorContact', () => {
  it('επαφή της ίδιας εταιρείας ⇒ επιστρέφεται', async () => {
    mockGet.mockResolvedValue(snap({ companyId: 'co_1', displayName: 'Vendor' }));
    expect(await fetchVendorContact('co_1', 'doc_1')).not.toBeNull();
  });

  it.each([
    ['ξένης εταιρείας', { companyId: 'co_OTHER' }],
    ['χωρίς companyId', {}],
    ['με companyId null (υπεργραφείο, ADR-232)', { companyId: null }],
    ['με κενό companyId', { companyId: '' }],
  ])('επαφή %s ⇒ null', async (_label, data) => {
    mockGet.mockResolvedValue(snap({ displayName: 'Vendor', ...data }));
    expect(await fetchVendorContact('co_1', 'doc_1')).toBeNull();
  });
});

describe('Τ2 — getVendorInvite', () => {
  it('πρόσκληση της ίδιας εταιρείας ⇒ επιστρέφεται', async () => {
    mockGet.mockResolvedValue(snap({ companyId: 'co_1', status: 'sent' }));
    expect(await getVendorInvite('co_1', 'doc_1')).toMatchObject({ id: 'doc_1', status: 'sent' });
  });

  it('κενό companyId και στα δύο (παγίδα `"" === ""`) ⇒ null', async () => {
    mockGet.mockResolvedValue(snap({ companyId: '', status: 'sent' }));
    expect(await getVendorInvite('', 'doc_1')).toBeNull();
  });

  it('πρόσκληση χωρίς companyId ⇒ null', async () => {
    mockGet.mockResolvedValue(snap({ status: 'sent' }));
    expect(await getVendorInvite('co_1', 'doc_1')).toBeNull();
  });
});

describe('Τ3 — revokeVendorInvite (ιδεμποτική, ADR-876 §5 Σ20)', () => {
  const ctx = { uid: 'u_1', companyId: 'co_1' } as unknown as AuthContext;
  const invite = (status: string) => snap({ companyId: 'co_1', rfqId: 'rfq_1', status });

  it('ζωντανή ⇒ ανάκληση πρόσκλησης + συνδέσμων + audit', async () => {
    mockGet.mockResolvedValue(invite('sent'));
    await revokeVendorInvite(ctx, 'rfq_1', 'doc_1');
    expect(mockTxUpdate).toHaveBeenCalledTimes(2);
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it('ήδη ανακλημένη ⇒ επιτυχία, ΚΑΜΙΑ εγγραφή, ΚΑΝΕΝΑ audit', async () => {
    mockGet.mockResolvedValue(invite('revoked'));
    await expect(revokeVendorInvite(ctx, 'rfq_1', 'doc_1')).resolves.toBeUndefined();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it.each(['submitted', 'declined', 'expired'])("'%s' ⇒ not_live (ποτέ σιωπηλή επιτυχία)", async (status) => {
    mockGet.mockResolvedValue(invite(status));
    await expect(revokeVendorInvite(ctx, 'rfq_1', 'doc_1')).rejects.toMatchObject({ code: 'not_live' });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});
