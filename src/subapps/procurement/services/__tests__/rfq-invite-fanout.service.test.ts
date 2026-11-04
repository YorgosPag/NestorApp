/**
 * @jest-environment node
 *
 * Το fan-out προσκλήσεων RFQ — ADR-742 Ομάδα 2, σημείο §3.1(β) · ADR-923 §5.13 Τ5
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΦΙΛΤΡΟ ΑΞΙΖΕΙ ΔΙΚΗ ΤΟΥ ΣΟΥΙΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Είναι **δευτερεύον δίχτυ σε παρενέργεια**, όχι ο κύριος φύλακας της διαδρομής — και γι' αυτό ακριβώς κανείς δεν το
 * κοίταζε. Η μετάλλαξη που επαναφέρει το παλιό `data.companyId && data.companyId !== ctx.companyId` άφηνε **282/282
 * πράσινα** (ίδιο σχήμα με το μάθημα #3 της Ομάδας 1).
 *
 * Το διακύβευμα δεν είναι διαρροή ονόματος: το μήνυμα μεταφέρει **portal token** που ανοίγει το RFQ σε όποιον το λάβει.
 *
 * ADR-923 §5.13 Τ5: η κρίση ζει πλέον στο `vendor-recipient` (μία για όλους τους δρόμους) και η αποστολή στο καθολικό
 * παράδοσης. Η σουίτα τρέχει **ολόκληρη** τη διαδρομή `createRfq → after() → παράδοση` πάνω στο ψεύτικο Firestore, ώστε ο
 * φύλακας να ελέγχεται εκεί που ζει και όχι σε αντίγραφο.
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({ after: () => { throw new Error('outside request scope'); } }));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fake,
  isFirebaseAdminAvailable: () => true,
  safeFirestoreOperation: async (op: (db: unknown) => Promise<unknown>) => op(fake),
  FieldValue: jest.requireActual('firebase-admin/firestore').FieldValue,
}));
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: (nowMs: number) => nowMs + 7 * 86_400_000,
  mintVendorInviteCredential: async (input: { inviteId: string; rfqId: string; companyId: string }) => ({
    credential: { id: `vic_${input.inviteId}`, inviteId: input.inviteId, rfqId: input.rfqId, companyId: input.companyId, nonceHash: 'h', expiresAt: '2027-01-01T00:00:00.000Z' },
    token: `tok_${input.inviteId}`,
  }),
}));
jest.mock('../vendor-portal-links', () => ({ vendorPortalUrl: (t: string) => `https://app.test/q#${t}`, vendorDeclineUrl: (t: string) => `https://app.test/d#${t}` }));
const mockSend = jest.fn(async () => ({ success: true, providerMessageId: null, errorReason: null, channel: 'email' }));
jest.mock('../channels/email-channel', () => ({ emailVendorInviteChannel: { send: (...a: unknown[]) => mockSend(...(a as [])) } }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: async () => 'audit' } }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';

import { createRfq } from '../rfq-service';
/* eslint-enable import/first */

const ctx = { uid: 'u1', companyId: 'co1', email: 'pm@co1.gr', globalRole: 'company_admin' } as unknown as AuthContext;

/** Δημιουργία RFQ με έναν προσκεκλημένο προμηθευτή — ενεργοποιεί το fan-out και περιμένει την παράδοση. */
async function createWithVendor(): Promise<void> {
  await createRfq(ctx, { projectId: 'proj1', title: 'RFQ', invitedVendorIds: ['vendor_1'] });
  await new Promise((resolve) => setTimeout(resolve, 50));
}

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
});

describe('fan-out προσκλήσεων — ποιος λαμβάνει το portal token', () => {
  it('επαφή του ίδιου πελάτη λαμβάνει', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'vendor_1', { companyId: 'co1', email: 'v@example.com', displayName: 'V' });
    await createWithVendor();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'v@example.com', portalUrl: expect.stringContaining('tok_') }));
  });

  it('επαφή ΑΛΛΟΥ πελάτη δεν λαμβάνει', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'vendor_1', { companyId: 'co_other', email: 'x@example.com' });
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('🔴 επαφή ΧΩΡΙΣ companyId δεν λαμβάνει — το token δεν φεύγει σε άγνωστο tenant', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'vendor_1', { email: 'orphan@example.com' });
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('🔴 επαφή με ΚΕΝΟ companyId δεν λαμβάνει — το κενό είναι απουσία tenant', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'vendor_1', { companyId: '', email: 'empty@example.com' });
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('ανύπαρκτη επαφή δεν λαμβάνει — και η πρόσκληση λέει γιατί (`no_recipient`), δεν σωπαίνει', async () => {
    await createWithVendor();
    expect(mockSend).not.toHaveBeenCalled();
    const [invite] = Object.values(fake.getAllDocs(COLLECTIONS.VENDOR_INVITES)) as { delivery: { state: string; reason: string } }[];
    expect(invite.delivery).toMatchObject({ state: 'undeliverable', reason: 'no_recipient' });
  });
});
