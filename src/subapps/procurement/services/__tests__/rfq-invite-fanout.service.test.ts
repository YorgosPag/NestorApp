/**
 * Το fan-out προσκλήσεων RFQ — ADR-742 Ομάδα 2, σημείο §3.1(β)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΦΙΛΤΡΟ ΑΞΙΖΕΙ ΔΙΚΗ ΤΟΥ ΣΟΥΙΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Είναι **δευτερεύον δίχτυ σε παρενέργεια**, όχι ο κύριος φύλακας της
 * διαδρομής — και γι' αυτό ακριβώς κανείς δεν το κοίταζε. Η μετάλλαξη που
 * επαναφέρει το παλιό `data.companyId && data.companyId !== ctx.companyId`
 * άφηνε **282/282 πράσινα** (ίδιο σχήμα με το μάθημα #3 της Ομάδας 1: η
 * αφαίρεση του φύλακα σχέσης άφηνε 12/12).
 *
 * Το διακύβευμα δεν είναι διαρροή ονόματος: το μήνυμα μεταφέρει **portal
 * token** που ανοίγει το RFQ σε όποιον το λάβει. Επαφή **χωρίς** `companyId`
 * περνούσε το παλιό φίλτρο (`data.companyId &&` → falsy → δεν έμπαινε καν στη
 * σύγκριση) και έπαιρνε το token.
 */

import type { AuthContext } from '@/lib/auth';

const mockTimestamp = () => ({ seconds: 1700000000, nanoseconds: 0 });

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(jest.fn(() => mockDb), {
    Timestamp: {
      now: jest.fn(() => mockTimestamp()),
      fromDate: jest.fn(() => mockTimestamp()),
    },
    FieldPath: { documentId: jest.fn(() => '__name__') },
  }),
}));

jest.mock('@/utils/firestore-sanitize', () => ({
  sanitizeForFirestore: jest.fn((x: unknown) => x),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateRfqId: jest.fn(() => 'rfq_1'),
  generateVendorInviteId: jest.fn(() => 'inv_1'),
}));

jest.mock('@/services/vendor-portal/vendor-portal-token-service', () => ({
  generateVendorPortalToken: jest.fn(() => ({
    token: 'TOKEN_THAT_OPENS_THE_RFQ',
    expiresAt: '2026-09-01T00:00:00.000Z',
  })),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@/lib/date-local', () => ({
  normalizeToDate: jest.fn(() => new Date('2026-09-01T00:00:00.000Z')),
}));

jest.mock('../rfq-line-service', () => ({
  snapshotFromBoq: jest.fn(async () => []),
  addRfqLinesBulk: jest.fn(async () => []),
}));

jest.mock('../sourcing-event-service', () => ({
  recomputeSourcingEventStatus: jest.fn(async () => 'partial'),
}));

const mockSend = jest.fn(async () => ({ success: true }));
jest.mock('../channels/email-channel', () => ({
  emailVendorInviteChannel: { send: (...a: unknown[]) => mockSend(...(a as [])) },
}));

jest.mock('@/services/contacts/contact-name-resolver-types', () => ({
  getContactEmail: jest.fn((c: { email?: string }) => c.email ?? null),
}));

const mockContactSnap = { get: jest.fn() };
const mockDocRef = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(() => mockContactSnap.get()),
  update: jest.fn().mockResolvedValue(undefined),
};
const mockBatch = { set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => mockDocRef),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  })),
  batch: jest.fn(() => mockBatch),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) =>
    op(mockDb),
  ),
  FieldValue: { arrayUnion: jest.fn(), increment: jest.fn() },
}));

import { createRfq } from '../rfq-service';

const ctx: AuthContext = { uid: 'u1', companyId: 'co1' } as AuthContext;

/** Δημιουργία RFQ με έναν προσκεκλημένο προμηθευτή — ενεργοποιεί το fan-out. */
async function createWithVendor() {
  await createRfq(ctx, {
    projectId: 'proj1',
    title: 'RFQ',
    invitedVendorIds: ['vendor_1'],
  });
}

const contact = (data: Record<string, unknown>) => ({
  exists: true,
  id: 'vendor_1',
  data: () => data,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ success: true });
});

describe('fan-out προσκλήσεων — ποιος λαμβάνει το portal token', () => {
  it('επαφή του ίδιου πελάτη λαμβάνει', async () => {
    mockContactSnap.get.mockResolvedValue(
      contact({ companyId: 'co1', email: 'v@example.com', displayName: 'V' }),
    );
    await createWithVendor();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'v@example.com' }),
    );
  });

  it('επαφή ΑΛΛΟΥ πελάτη δεν λαμβάνει', async () => {
    mockContactSnap.get.mockResolvedValue(
      contact({ companyId: 'co_other', email: 'x@example.com' }),
    );
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('🔴 επαφή ΧΩΡΙΣ companyId δεν λαμβάνει — το token δεν φεύγει σε άγνωστο tenant', async () => {
    mockContactSnap.get.mockResolvedValue(contact({ email: 'orphan@example.com' }));
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('🔴 επαφή με ΚΕΝΟ companyId δεν λαμβάνει — το κενό είναι απουσία tenant', async () => {
    mockContactSnap.get.mockResolvedValue(
      contact({ companyId: '', email: 'empty@example.com' }),
    );
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('ανύπαρκτη επαφή δεν λαμβάνει', async () => {
    mockContactSnap.get.mockResolvedValue({ exists: false, id: 'vendor_1', data: () => undefined });
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
