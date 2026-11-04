/**
 * @jest-environment node
 *
 * **Η παράδοση προσκλήσεων RFQ** (ADR-923 §5.13 Τ5): αληθινή κρίση παραλήπτη (`vendor-recipient`), αληθινός αναγνώστης
 * `quoteIntake`, αληθινό καθολικό και αληθινή σάρωση πάνω στο ψεύτικο Firestore. Ψεύτικα μόνο: ο πάροχος email, η έκδοση
 * διαπιστευτηρίου (τυχαιότητα, μυστικό), η ποσόστωση (Upstash) και ο orchestrator ειδοποιήσεων.
 *
 * 🔒 Κάθε σενάριο ασφαλείας ρωτά **σε ποιον** πήγε το email — όχι μόνο αν πήγε.
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({ after: () => { throw new Error('outside request scope'); } }));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fake,
  isFirebaseAdminAvailable: () => true,
  safeFirestoreOperation: async (op: (db: unknown) => Promise<unknown>, fallback: unknown) => {
    try { return await op(fake); } catch { return fallback; }
  },
  FieldValue: jest.requireActual('firebase-admin/firestore').FieldValue,
}));

const mockSend = jest.fn();
jest.mock('../channels/email-channel', () => ({ emailVendorInviteChannel: { send: (...a: unknown[]) => mockSend(...a) } }));
const mockMint = jest.fn(async (input: { inviteId: string; rfqId: string; companyId: string; issuedVia: string }) => ({
  credential: { id: `vic_${input.issuedVia}_${mockMint.mock.calls.length}`, inviteId: input.inviteId, rfqId: input.rfqId, companyId: input.companyId, nonceHash: 'h', expiresAt: '2027-01-01T00:00:00.000Z' },
  token: `tok_${input.issuedVia}`,
}));
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: (nowMs: number) => nowMs + 7 * 86_400_000,
  mintVendorInviteCredential: (input: { inviteId: string; rfqId: string; companyId: string; issuedVia: string }) => mockMint(input),
}));
jest.mock('../vendor-portal-links', () => ({ vendorPortalUrl: (t: string) => `https://app.test/q#${t}`, vendorDeclineUrl: (t: string) => `https://app.test/d#${t}` }));
const mockQuota = jest.fn(async () => true);
jest.mock('@/lib/middleware/subject-quota', () => ({ withinSubjectQuota: (...a: unknown[]) => mockQuota(...(a as [])) }));
const mockDispatch = jest.fn(async () => ({ success: true, dedupeKey: 'k', skipped: false }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: (...a: unknown[]) => mockDispatch(...(a as [])) }));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: async () => ['u_admin_1', 'u_admin_2'] }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: async () => 'Γραφείο Αγοραστή' }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';

import {
  INVITE_DELIVERY_POLICY,
  claimedInviteDelivery,
  pendingInviteDelivery,
  rejectedInviteDelivery,
  type VendorInviteDelivery,
} from '../../types/vendor-invite-delivery';
import { deliverRfqInvite, scheduleRfqInviteDeliveries } from '../rfq-invite-delivery';
import { runRfqInviteDeliverySweep } from '../rfq-invite-delivery-sweep';
import { resolveInviteRecipient } from '../vendor-invite-links-service';
/* eslint-enable import/first */

const BUYER = 'comp_buyer';
const SUPPLIER = 'comp_aries';
const PLATFORM_CONTACT = generateDeterministicPlatformCompanyContactId(BUYER, SUPPLIER);
const NOW = Date.parse('2026-11-04T10:00:00.000Z');
const LINK = { portalUrl: 'https://app.test/q#mem', declineUrl: 'https://app.test/d#mem', expiresAtIso: '2026-11-11T10:00:00.000Z' };

const invite = (id: string) => fake.getData(COLLECTIONS.VENDOR_INVITES, id) as Record<string, unknown> & { delivery: VendorInviteDelivery };
const sentTo = () => mockSend.mock.calls.map(([message]) => (message as { recipient: string }).recipient);

function seedInvite(id: string, contactId: string, over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.VENDOR_INVITES, id, {
    id, rfqId: 'rfq_1', companyId: BUYER, vendorContactId: contactId, status: 'sent', deliveryChannel: 'email',
    expiresAt: Timestamp.fromMillis(NOW + 7 * 86_400_000), deliveredAt: null, recipientEmail: null, recipientName: null,
    delivery: pendingInviteDelivery(NOW), ...over,
  });
}

function seedPlatformContact(over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.CONTACTS, PLATFORM_CONTACT, { type: 'company', companyId: BUYER, platformCompanyId: SUPPLIER, companyName: 'ARIES ΑΕ', ...over });
}

function seedIntake(enabled = true): void {
  const id = generateDeterministicCatalogSupplierProfileId(SUPPLIER);
  fake.seed('catalog_supplier_profiles', id, {
    id, companyId: SUPPLIER, isDeleted: false, revision: 1, description: {}, projects: [], quoteIntake: { enabled, recipientEmail: 'quotes@aries.gr' },
  });
}

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ success: true, providerMessageId: 'm1', errorReason: null, channel: 'email' });
  mockQuota.mockResolvedValue(true);
  fake.seed(COLLECTIONS.RFQS, 'rfq_1', { id: 'rfq_1', companyId: BUYER, title: 'Καλώδια Β΄ φάσης', status: 'draft' });
  seedIntake();
});

describe('παραλήπτης — ποιος παίρνει τον σύνδεσμο της πύλης', () => {
  it('επαφή του αγοραστή με email ⇒ εκείνο το email, με στιγμιότυπο στην πρόσκληση', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_v', { companyId: BUYER, email: 'v@vendor.gr', displayName: 'Vendor' });
    seedInvite('inv_1', 'cont_v');
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('delivered');
    expect(sentTo()).toEqual(['v@vendor.gr']);
    expect(invite('inv_1')).toMatchObject({ recipientEmail: 'v@vendor.gr', delivery: { state: 'delivered', attempts: 1, recipientKind: 'contact' } });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('επαφή πλατφόρμας ⇒ το `quoteIntake` του προμηθευτή· η διεύθυνση ΔΕΝ μένει στην πρόσκληση· ειδοποιούνται οι διαχειριστές', async () => {
    seedPlatformContact();
    seedInvite('inv_1', PLATFORM_CONTACT);
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('delivered');
    expect(sentTo()).toEqual(['quotes@aries.gr']);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ portalUrl: LINK.portalUrl, rfqTitle: 'Καλώδια Β΄ φάσης' }));
    expect(invite('inv_1')).toMatchObject({ recipientEmail: null, recipientName: 'ARIES ΑΕ', delivery: { state: 'delivered', recipientKind: 'platform' } });
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'procurement.quoteRequested', recipientId: 'u_admin_1', tenantId: SUPPLIER, eventId: 'quote-request:inv_1',
      titleParams: { who: 'Γραφείο Αγοραστή', title: 'Καλώδια Β΄ φάσης' },
    }));
  });

  it('🔒 η ειδοποίηση δεν φέρει σύνδεσμο πύλης ούτε id του RFQ του αγοραστή', async () => {
    seedPlatformContact();
    seedInvite('inv_1', PLATFORM_CONTACT);
    await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW);
    const serialized = JSON.stringify(mockDispatch.mock.calls);
    expect(serialized).not.toContain('mem');
    expect(serialized).not.toContain('rfq_1');
  });

  it('κλειστό opt-in ⇒ κανένα email, `no_recipient`', async () => {
    seedIntake(false);
    seedPlatformContact();
    seedInvite('inv_1', PLATFORM_CONTACT);
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('undeliverable');
    expect(mockSend).not.toHaveBeenCalled();
    expect(invite('inv_1').delivery).toMatchObject({ state: 'undeliverable', reason: 'no_recipient' });
  });

  it('🔒 πλαστό `platformCompanyId` σε καρτέλα με άλλο id ⇒ ΔΕΝ ανοίγει το κανάλι του προμηθευτή', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_forged', { type: 'company', companyId: BUYER, platformCompanyId: SUPPLIER, companyName: 'Πλαστή' });
    seedInvite('inv_1', 'cont_forged');
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('undeliverable');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('🔒 για επαφή πλατφόρμας το email της καρτέλας αγνοείται: το κανάλι το ορίζει ο προμηθευτής', async () => {
    seedPlatformContact({ email: 'attacker@evil.test' });
    seedInvite('inv_1', PLATFORM_CONTACT);
    await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW);
    expect(sentTo()).toEqual(['quotes@aries.gr']);
  });

  it('🔒 επαφή άλλου μισθωτή ⇒ κανένα email', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_x', { companyId: 'comp_other', email: 'x@other.gr' });
    seedInvite('inv_1', 'cont_x');
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('undeliverable');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('εξαντλημένη ποσόστωση του προμηθευτή ⇒ `recipient_quota`, κανένα email, καμία ειδοποίηση', async () => {
    mockQuota.mockResolvedValue(false);
    seedPlatformContact();
    seedInvite('inv_1', PLATFORM_CONTACT);
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('undeliverable');
    expect(mockQuota).toHaveBeenCalledWith('rfq-quote-request:supplier', SUPPLIER, expect.objectContaining({ limit: 100 }));
    expect(invite('inv_1').delivery.reason).toBe('recipient_quota');
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('RFQ που δεν δέχεται πια προσφορές ⇒ `rfq_closed`', async () => {
    fake.seed(COLLECTIONS.RFQS, 'rfq_1', { id: 'rfq_1', companyId: BUYER, title: 'X', status: 'cancelled' });
    seedPlatformContact();
    seedInvite('inv_1', PLATFORM_CONTACT);
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('undeliverable');
    expect(invite('inv_1').delivery.reason).toBe('rfq_closed');
  });
});

describe('ιδεμποτία — το πολύ ένα email ανά πρόσκληση', () => {
  beforeEach(() => { seedPlatformContact(); seedInvite('inv_1', PLATFORM_CONTACT); });

  it('δεύτερη κλήση (π.χ. after() και σάρωση μαζί) ⇒ `skipped`, ένα μόνο email', async () => {
    const outcomes = await Promise.all([deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW), deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)]);
    expect(outcomes.sort()).toEqual(['delivered', 'skipped']);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('παραδομένη πρόσκληση δεν ξαναστέλνεται ούτε με απευθείας κλήση, όσο αργότερα κι αν γίνει', async () => {
    await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW);
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW + 86_400_000)).toBe('skipped');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('🔒 η καταγραφή δεν πατά την κρίση της σάρωσης: κράτηση που έληξε στη μέση μένει `unknown`', async () => {
    mockSend.mockImplementationOnce(async () => {
      await runRfqInviteDeliverySweep(fake, NOW + INVITE_DELIVERY_POLICY.leaseMs + 1);
      return { success: true, providerMessageId: 'm1', errorReason: null, channel: 'email' };
    });
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('skipped');
    expect(invite('inv_1').delivery.state).toBe('unknown');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('η σάρωση αγνοεί παραδομένη πρόσκληση', async () => {
    await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW);
    const report = await runRfqInviteDeliverySweep(fake, NOW + 86_400_000);
    expect(report.scanned).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('ληγμένη κράτηση (η διεργασία πέθανε στη μέση) ⇒ `unknown`, ΧΩΡΙΣ δεύτερο email', async () => {
    fake.seed(COLLECTIONS.VENDOR_INVITES, 'inv_1', { ...invite('inv_1'), delivery: claimedInviteDelivery(pendingInviteDelivery(NOW), NOW) });
    const report = await runRfqInviteDeliverySweep(fake, NOW + INVITE_DELIVERY_POLICY.leaseMs + 1);
    expect(report).toMatchObject({ scanned: 1, unknown: 1 });
    expect(invite('inv_1').delivery.state).toBe('unknown');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('κράτηση που ΔΕΝ έληξε δεν πειράζεται', async () => {
    fake.seed(COLLECTIONS.VENDOR_INVITES, 'inv_1', { ...invite('inv_1'), delivery: claimedInviteDelivery(pendingInviteDelivery(NOW), NOW) });
    expect((await runRfqInviteDeliverySweep(fake, NOW + 1000)).scanned).toBe(0);
    expect(invite('inv_1').delivery.state).toBe('sending');
  });
});

describe('επανάληψη — μόνο όταν ο πάροχος αρνήθηκε', () => {
  beforeEach(() => { seedPlatformContact(); seedInvite('inv_1', PLATFORM_CONTACT); });

  it('άρνηση ⇒ `pending` με αναμονή· η σάρωση ξαναστέλνει με ΝΕΟ σύνδεσμο (`email_resend`)', async () => {
    mockSend.mockResolvedValueOnce({ success: false, providerMessageId: null, errorReason: 'resend: 500', channel: 'email' });
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('pending');
    expect(invite('inv_1').delivery).toMatchObject({ state: 'pending', attempts: 1, lastError: 'resend: 500', dueAt: new Date(NOW + 60_000).toISOString() });
    expect((await runRfqInviteDeliverySweep(fake, NOW + 30_000)).scanned).toBe(0);
    const report = await runRfqInviteDeliverySweep(fake, NOW + 60_000);
    expect(report).toMatchObject({ scanned: 1, delivered: 1 });
    expect(mockMint).toHaveBeenCalledWith(expect.objectContaining({ inviteId: 'inv_1', issuedVia: 'email_resend', issuedBy: null }));
    expect(mockSend.mock.calls[1][0]).toMatchObject({ recipient: 'quotes@aries.gr', portalUrl: 'https://app.test/q#tok_email_resend' });
    expect(invite('inv_1').delivery).toMatchObject({ state: 'delivered', attempts: 2 });
  });

  it('βλάβη πριν από την αποστολή (π.χ. ανάγνωση) ⇒ ασφαλής επανάληψη, όχι χαμένη πρόσκληση', async () => {
    mockQuota.mockRejectedValueOnce(new Error('upstash down'));
    expect(await deliverRfqInvite({ inviteId: 'inv_1', link: LINK }, NOW)).toBe('pending');
    expect(invite('inv_1').delivery.lastError).toBe('upstash down');
  });

  it('μετά από `maxAttempts` αρνήσεις ⇒ `failed`, η σάρωση σταματά', () => {
    let delivery = pendingInviteDelivery(NOW);
    for (let attempt = 1; attempt <= INVITE_DELIVERY_POLICY.maxAttempts; attempt += 1) {
      delivery = rejectedInviteDelivery(claimedInviteDelivery(delivery, NOW), 'x', NOW);
    }
    expect(delivery).toMatchObject({ state: 'failed', attempts: INVITE_DELIVERY_POLICY.maxAttempts, dueAt: null });
  });
});

describe('scheduleRfqInviteDeliveries — έξω από αίτημα τρέχει αμέσως', () => {
  it('το `after` πετά ⇒ η απόπειρα γίνεται τώρα', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_v', { companyId: BUYER, email: 'v@vendor.gr', displayName: 'Vendor' });
    seedInvite('inv_1', 'cont_v', { delivery: pendingInviteDelivery(Date.now() - 1000) });
    scheduleRfqInviteDeliveries([{ inviteId: 'inv_1', link: LINK }]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sentTo()).toEqual(['v@vendor.gr']);
  });
});

describe('resolveInviteRecipient — επαναποστολή και αυτοεξυπηρέτηση λήξης', () => {
  const platformInvite = { companyId: BUYER, vendorContactId: PLATFORM_CONTACT, recipientEmail: null, recipientName: 'ARIES ΑΕ' };

  it('πρόσκληση πλατφόρμας (χωρίς στιγμιότυπο) ⇒ λύνεται ζωντανά στο `quoteIntake`', async () => {
    seedPlatformContact();
    expect(await resolveInviteRecipient(platformInvite)).toEqual({ email: 'quotes@aries.gr', name: 'ARIES ΑΕ' });
  });

  it('ο προμηθευτής έκλεισε το opt-in ⇒ καμία επαναποστολή', async () => {
    seedIntake(false);
    seedPlatformContact();
    expect(await resolveInviteRecipient(platformInvite)).toBeNull();
  });

  it('στιγμιότυπο επαφής του αγοραστή ⇒ κερδίζει, όπως πριν (ADR-876 §5)', async () => {
    expect(await resolveInviteRecipient({ ...platformInvite, recipientEmail: 'snap@v.gr' })).toEqual({ email: 'snap@v.gr', name: 'ARIES ΑΕ' });
  });
});
