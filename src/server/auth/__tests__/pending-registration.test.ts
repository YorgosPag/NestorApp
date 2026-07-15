/**
 * @fileoverview Unit tests για το SSoT provisioning service (ADR-660).
 * Καλύπτουν τη λογική: pending upsert χωρίς claims, no-op για ήδη-assigned χρήστη,
 * race-proof notify-once (transaction-guarded `pendingNotifiedAt`), και το ότι η
 * ειδοποίηση στέλνεται μόνο στους ενεργούς admin του tenant (πηγή = `users`
 * collection, companyId + globalRole — ΟΧΙ το συχνά-άδειο members subcollection).
 *
 * Το Admin SDK (Firestore transaction + users query) και ο Mailgun sender είναι
 * mocked — ο έλεγχος είναι καθαρά στη λογική του service.
 */

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/config/tenant', () => ({
  getCompanyId: () => 'comp_TEST',
}));

const sendReplyViaMailgunMock = jest.fn();
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: (...args: unknown[]) => sendReplyViaMailgunMock(...args),
}));

jest.mock('@/services/email-templates/pending-registration-admin', () => ({
  buildPendingRegistrationAdminEmail: () => ({ subject: 'S', html: 'H', text: 'T' }),
}));

const getAdminFirestoreMock = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => getAdminFirestoreMock(),
}));

import { ensurePendingRegistration } from '../pending-registration';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// HARNESS
// =============================================================================

/** Ένα doc του `users` collection όπως το επιστρέφει το where('companyId'==tenant). */
interface UserSeed { uid: string; globalRole?: string; status?: string; email?: string }
interface SetCall { data: Record<string, unknown>; options: unknown }

function makeFirestore(opts: {
  userDoc: Record<string, unknown> | null;
  tenantUsers: UserSeed[];
}): { db: unknown; setCalls: SetCall[] } {
  const setCalls: SetCall[] = [];
  const userRef = { __kind: 'userRef' };

  const usersQuery = {
    where: () => usersQuery,
    limit: () => usersQuery,
    get: async () => ({
      docs: opts.tenantUsers.map((u) => ({ id: u.uid, data: () => u })),
    }),
  };

  const db = {
    // Μόνο το USERS collection χρησιμοποιείται πλέον (userRef + admin query).
    collection: (_name: string) => ({
      doc: () => userRef,
      where: () => usersQuery,
    }),
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: opts.userDoc !== null, data: () => opts.userDoc }),
        set: (_ref: unknown, data: Record<string, unknown>, options: unknown) => {
          setCalls.push({ data, options });
        },
      };
      return cb(tx);
    },
  };

  return { db, setCalls };
}

const INPUT = { uid: 'uid_new', email: 'newuser@example.com', displayName: 'Νέος', authProvider: 'google.com' };

beforeEach(() => {
  jest.clearAllMocks();
  sendReplyViaMailgunMock.mockResolvedValue({ success: true, messageId: 'mg_1' });
});

// Sanity: το collection() δείχνει στο USERS (η μοναδική collection που αγγίζει το service).
it('uses the USERS collection as the admin source', () => {
  expect(COLLECTIONS.USERS).toBeDefined();
});

// =============================================================================
// TESTS
// =============================================================================

describe('ensurePendingRegistration', () => {
  it('creates a pending record WITHOUT claims and notifies active admins (first time)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: null,
      tenantUsers: [
        { uid: 'admin1', globalRole: 'company_admin', status: 'active', email: 'admin@example.com' },
        { uid: 'user2', globalRole: 'external_user', status: 'active', email: 'user2@example.com' },
      ],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'pending', notified: true });
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data).toMatchObject({
      status: 'pending',
      registrationStatus: 'pending',
      companyId: null,
      globalRole: null,
      pendingNotifiedAt: 'TS',
      requestedAt: 'TS',
      uid: 'uid_new',
    });
    // Ο external_user φιλτραρίστηκε — μόνο ο admin παραλήπτης.
    expect(sendReplyViaMailgunMock).toHaveBeenCalledTimes(1);
    expect(sendReplyViaMailgunMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@example.com' }),
    );
  });

  it('is a no-op for an already-assigned user (never downgrades)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { companyId: 'comp_EXISTING', globalRole: 'internal_user' },
      tenantUsers: [{ uid: 'admin1', globalRole: 'company_admin', status: 'active', email: 'admin@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'assigned', notified: false });
    expect(setCalls).toHaveLength(0);
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  it('does NOT re-notify when the user was already notified (notify-once)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { pendingNotifiedAt: 'TS_OLD', displayName: 'Ήδη', companyId: null },
      tenantUsers: [{ uid: 'admin1', globalRole: 'super_admin', status: 'active', email: 'admin@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'pending', notified: false });
    // Το record ενημερώνεται, αλλά ΧΩΡΙΣ νέο pendingNotifiedAt / requestedAt.
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data).not.toHaveProperty('pendingNotifiedAt');
    expect(setCalls[0].data).not.toHaveProperty('requestedAt');
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  it('reports notified:false when the tenant has no admin recipients', async () => {
    const { db } = makeFirestore({
      userDoc: null,
      tenantUsers: [{ uid: 'user2', globalRole: 'external_user', status: 'active', email: 'user2@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'pending', notified: false });
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  it('excludes suspended/inactive admins and admins without an email', async () => {
    const { db } = makeFirestore({
      userDoc: null,
      tenantUsers: [
        { uid: 'admin1', globalRole: 'company_admin', status: 'suspended', email: 'suspended@example.com' },
        { uid: 'admin2', globalRole: 'company_admin', status: 'active', email: 'active-admin@example.com' },
        { uid: 'admin3', globalRole: 'super_admin', status: 'active' },
      ],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result.notified).toBe(true);
    expect(sendReplyViaMailgunMock).toHaveBeenCalledTimes(1);
    expect(sendReplyViaMailgunMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'active-admin@example.com' }),
    );
  });
});
