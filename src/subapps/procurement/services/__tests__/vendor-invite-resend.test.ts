/**
 * @jest-environment node
 *
 * **Επαναποστολή και χειρόγραφη πρόσκληση — οι φρουροί του spam** (ADR-923 §5.13 Τ5, Ε1/Ε2): αληθινή κρίση παραλήπτη,
 * αληθινή ποσόστωση ζεύγους στο Firestore, αληθινό καθολικό. Ψεύτικα: ο πάροχος, η έκδοση διαπιστευτηρίου, το Upstash.
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
const mockChannel = { id: 'email', send: (...a: unknown[]) => mockSend(...a) };
jest.mock('../channels', () => ({ resolveChannel: () => mockChannel }));
jest.mock('../channels/email-channel', () => ({ get emailVendorInviteChannel() { return mockChannel; } }));
const mockMint = jest.fn(async (input: { inviteId: string; rfqId: string; companyId: string; issuedVia: string }) => ({
  credential: { id: `vic_${mockMint.mock.calls.length}`, inviteId: input.inviteId, rfqId: input.rfqId, companyId: input.companyId, nonceHash: 'h', expiresAt: '2027-01-01T00:00:00.000Z' },
  token: `tok_${input.issuedVia}`,
}));
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: (nowMs: number) => nowMs + 7 * 86_400_000,
  mintVendorInviteCredential: (input: { inviteId: string; rfqId: string; companyId: string; issuedVia: string }) => mockMint(input),
}));
jest.mock('../vendor-portal-links', () => ({ vendorPortalUrl: (t: string) => `https://app.test/q#${t}`, vendorDeclineUrl: (t: string) => `https://app.test/d#${t}` }));
const mockQuota = jest.fn(async (..._a: unknown[]) => true);
jest.mock('@/lib/middleware/subject-quota', () => ({
  withinSubjectQuota: (...a: unknown[]) => mockQuota(...(a as [])),
  subjectQuotaVerdict: async (...a: unknown[]) => { const v: unknown = await mockQuota(...(a as [])); return v === true ? 'allowed' : v === false ? 'exhausted' : v; },
}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: async () => ({ success: true }) }));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: async () => ['u_admin_1'] }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: async () => 'Γραφείο' }));
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({ readPublicSupplier: async () => ({ companyId: 'comp_aries', legalName: 'ARIES ΑΕ' }) }));
jest.mock('@/server/notifications/user-notification-settings-store', () => ({ loadDeclaredEmailLanguage: async () => null }));
jest.mock('../vendor-invite-audit', () => ({ recordVendorInviteAudit: () => undefined }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { QUOTE_REQUEST_PAIR_DAILY_QUOTA, VENDOR_INVITE_RESEND_QUOTA } from '@/lib/middleware/rate-limit-config';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';

import { pendingInviteDelivery, type VendorInviteDelivery } from '../../types/vendor-invite-delivery';
import { quoteRequestWindowOf } from '../quote-request-pair-quota';
import { VENDOR_INVITE_RESEND_QUOTA_SCOPE, resendVendorInvite } from '../vendor-invite-links-service';
import { VendorInviteRefusal, VendorInviteStateError, createVendorInvite } from '../vendor-invite-service';/* eslint-enable import/first */

const BUYER = 'comp_buyer';
const SUPPLIER = 'comp_aries';
const PLATFORM_CONTACT = generateDeterministicPlatformCompanyContactId(BUYER, SUPPLIER);
const ctx = { uid: 'u_buyer', companyId: BUYER, email: 'b@b.gr', globalRole: 'company_admin' } as unknown as AuthContext;
const failedDelivery: VendorInviteDelivery = { ...pendingInviteDelivery(0), state: 'failed', attempts: 5, dueAt: null, lastError: 'provider_rejected' };

const inviteDoc = (id: string) => fake.getData(COLLECTIONS.VENDOR_INVITES, id) as Record<string, unknown> & { delivery?: VendorInviteDelivery };
const codeOf = (promise: Promise<unknown>) => promise.then(() => 'ok', (e: unknown) => (e instanceof VendorInviteStateError ? e.code : String(e)));

function seedInvite(id: string, over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.VENDOR_INVITES, id, {
    id, rfqId: 'rfq_1', companyId: BUYER, vendorContactId: PLATFORM_CONTACT, status: 'sent', deliveryChannel: 'email',
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86_400_000), deliveredAt: null, recipientEmail: null, recipientName: 'ARIES ΑΕ',
    createdAt: Timestamp.fromMillis(Date.now() - 60_000), delivery: failedDelivery, ...over,
  });
}

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
  mockQuota.mockResolvedValue(true);
  beforeEachSeed();
});

function beforeEachSeed(): void {
  mockSend.mockResolvedValue({ success: true, providerMessageId: 'm1', errorReason: null, channel: 'email' });
  fake.seed(COLLECTIONS.RFQS, 'rfq_1', { id: 'rfq_1', companyId: BUYER, title: 'Καλώδια', status: 'active', invitedVendorIds: [] });
  fake.seed(COLLECTIONS.CONTACTS, PLATFORM_CONTACT, { type: 'company', companyId: BUYER, platformCompanyId: SUPPLIER, companyName: 'ARIES ΑΕ' });
  const profileId = generateDeterministicCatalogSupplierProfileId(SUPPLIER);
  fake.seed('catalog_supplier_profiles', profileId, {
    id: profileId, companyId: SUPPLIER, isDeleted: false, revision: 1, description: {}, projects: [], quoteIntake: { enabled: true, recipientEmail: 'quotes@aries.gr' },
  });
}

describe('Ε1 — επαναποστολή με όριο', () => {
  it('μετρά ανά ΠΡΟΣΚΛΗΣΗ με το δηλωμένο όριο· εξαντλημένο ⇒ 429-κωδικός, κανένα email, κανένα διαπιστευτήριο', async () => {
    seedInvite('inv_1');
    mockQuota.mockImplementation(async (scope: unknown) => scope !== VENDOR_INVITE_RESEND_QUOTA_SCOPE);
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('resend_quota_exhausted');
    expect(mockQuota).toHaveBeenCalledWith(VENDOR_INVITE_RESEND_QUOTA_SCOPE, 'inv_1', VENDOR_INVITE_RESEND_QUOTA);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockMint).not.toHaveBeenCalled();
  });

  it('το outbox δεν τελείωσε (`pending`) ⇒ `delivery_in_progress`, όχι δεύτερο email', async () => {
    seedInvite('inv_1', { delivery: pendingInviteDelivery(Date.now()) });
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('delivery_in_progress');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('κλειστό RFQ ⇒ καμία επαναποστολή', async () => {
    fake.seed(COLLECTIONS.RFQS, 'rfq_1', { id: 'rfq_1', companyId: BUYER, title: 'Καλώδια', status: 'closed', invitedVendorIds: [] });
    seedInvite('inv_1');
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('not_live');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('γραμματοκιβώτιο του προμηθευτή γεμάτο ⇒ καμία επαναποστολή', async () => {
    seedInvite('inv_1');
    mockQuota.mockImplementation(async (scope: unknown) => scope !== 'rfq-quote-request:supplier');
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('resend_quota_exhausted');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('επιτυχία ⇒ στο `quoteIntake` και το καθολικό λέει πλέον `delivered`· το κείμενο του παρόχου δεν φτάνει στον αγοραστή', async () => {
    seedInvite('inv_1');
    expect(await resendVendorInvite(ctx, 'rfq_1', 'inv_1')).toEqual({ success: true, errorReason: null });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'quotes@aries.gr', locale: 'el' }));
    expect(inviteDoc('inv_1').delivery).toMatchObject({ state: 'delivered', recipientKind: 'platform', lastError: null });
    mockSend.mockResolvedValueOnce({ success: false, providerMessageId: null, errorReason: '550 quotes@aries.gr unknown', channel: 'email' });
    expect(await resendVendorInvite(ctx, 'rfq_1', 'inv_1')).toEqual({ success: false, errorReason: 'provider_rejected' });
  });
});

const pairCount = () => ((fake.getData(COLLECTIONS.QUOTE_REQUEST_PAIR_QUOTAS, BUYER) as { pairs?: Record<string, number> } | undefined)?.pairs ?? {})[SUPPLIER] ?? 0;
const seedPair = (count: number) => fake.seed(COLLECTIONS.QUOTE_REQUEST_PAIR_QUOTAS, BUYER, {
  companyId: BUYER, window: quoteRequestWindowOf(Date.now()), pairs: { [SUPPLIER]: count },
});
const refusalOf = (promise: Promise<unknown>) => promise.then(() => 'ok', (e: unknown) => (e instanceof VendorInviteRefusal ? e.code : String(e)));
const manualInvite = () => createVendorInvite(ctx, { rfqId: 'rfq_1', vendorContactId: PLATFORM_CONTACT, deliveryChannel: 'email' });
const inviteDocs = () => Object.values(fake.getAllDocs(COLLECTIONS.VENDOR_INVITES));
const credentialDocs = () => Object.values(fake.getAllDocs(COLLECTIONS.VENDOR_INVITE_CREDENTIALS));
const supplierQuotaCalls = () => mockQuota.mock.calls.filter((call: unknown[]) => call[0] === 'rfq-quote-request:supplier');

describe('Σ1α — η χειρόγραφη πρόσκληση που αρνήθηκε ΔΕΝ αποθηκεύεται', () => {
  it('μετρά μία μονάδα ζεύγους ανά πρόσκληση, και μόνο μετά από επιτυχία γίνεται `sent`', async () => {
    const result = await manualInvite();
    expect(pairCount()).toBe(1);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'quotes@aries.gr' }));
    expect(inviteDoc(result.invite.id)).toMatchObject({ status: 'sent' });
  });

  it('όριο ζεύγους εξαντλημένο ⇒ 429-κωδικός, ΚΑΜΙΑ πρόσκληση, ΚΑΝΕΝΑ διαπιστευτήριο, ούτε μονάδα του κοινού ορίου', async () => {
    seedPair(QUOTE_REQUEST_PAIR_DAILY_QUOTA.limit);
    expect(await refusalOf(manualInvite())).toBe('quote_request_quota_exhausted');
    expect(inviteDocs()).toEqual([]);
    expect(credentialDocs()).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
    expect(supplierQuotaCalls()).toHaveLength(0);
  });

  it('γραμματοκιβώτιο του προμηθευτή γεμάτο ⇒ καμία πρόσκληση αποθηκεύεται', async () => {
    mockQuota.mockImplementation(async (scope: unknown) => scope !== 'rfq-quote-request:supplier');
    expect(await refusalOf(manualInvite())).toBe('quote_request_quota_exhausted');
    expect(inviteDocs()).toEqual([]);
    expect(pairCount()).toBe(0);
  });
});

describe('Σ1γ — μία ζωντανή πρόσκληση ανά (RFQ, επαφή)', () => {
  it('δεύτερη πρόσκληση στην ίδια επαφή ενώ η πρώτη ζει ⇒ `already_invited`, κανένα δεύτερο email', async () => {
    seedInvite('inv_live', { delivery: undefined });
    expect(await refusalOf(manualInvite())).toBe('already_invited');
    expect(inviteDocs()).toHaveLength(1);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('ανακλημένη ή ληγμένη πρόσκληση δεν εμποδίζει νέα', async () => {
    seedInvite('inv_revoked', { status: 'revoked' });
    seedInvite('inv_expired', { expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    expect(await refusalOf(manualInvite())).toBe('ok');
  });

  it('ανταγωνιστής γράφει ζωντανή πρόσκληση ΜΕΣΑ στη συναλλαγή ⇒ η κράτηση το βλέπει και αρνείται (ατομικό)', async () => {
    // Ο ανταγωνιστής οπλίζεται ΜΕΤΑ τον πρόωρο έλεγχο (στο όριο γραμματοκιβωτίου, που τρέχει αμέσως πριν από την κράτηση),
    // ώστε να χτυπήσει ΜΕΣΑ στη συναλλαγή `reserveInvite` — όχι σε κάποια προηγούμενη ανάγνωση.
    mockQuota.mockImplementation(async (scope: unknown) => {
      if (scope === 'rfq-quote-request:supplier') {
        fake.interfere = () => {
          seedInvite('inv_racer', { delivery: undefined });
          fake.seed(COLLECTIONS.RFQS, 'rfq_1', { id: 'rfq_1', companyId: BUYER, title: 'Καλώδια', status: 'active', invitedVendorIds: [PLATFORM_CONTACT] });
        };
      }
      return true;
    });
    expect(await refusalOf(manualInvite())).toBe('already_invited');
    expect(inviteDocs().map((doc) => (doc as { id: string }).id)).toEqual(['inv_racer']);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Χ-Β 🔑 — ανταγωνιστής ΓΕΜΙΖΕΙ το όριο ζεύγους μέσα στη συναλλαγή ⇒ η κράτηση ξαναδιαβάζει τον μετρητή και αρνείται', async () => {
    // Ο ανταγωνιστής αγγίζει ΜΟΝΟ τον μετρητή ζεύγους (όχι το RFQ). Άρα η σύγκρουση πιάνεται μόνο αν ο μετρητής διαβάστηκε
    // ΜΕΣΑ στη συναλλαγή. Μετάλλαξη «ανάγνωση εκτός συναλλαγής» ⇒ η κράτηση γράφει μπαγιάτικο limit−1+1 και περνά ⇒ κόκκινο.
    seedPair(QUOTE_REQUEST_PAIR_DAILY_QUOTA.limit - 1);
    mockQuota.mockImplementation(async (scope: unknown) => {
      if (scope === 'rfq-quote-request:supplier') fake.interfere = () => seedPair(QUOTE_REQUEST_PAIR_DAILY_QUOTA.limit);
      return true;
    });
    expect(await refusalOf(manualInvite())).toBe('quote_request_quota_exhausted');
    expect(inviteDocs()).toEqual([]);
    expect(credentialDocs()).toEqual([]);
    expect(pairCount()).toBe(QUOTE_REQUEST_PAIR_DAILY_QUOTA.limit);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('Χ-Ε — το email έφυγε· βλάβη στη σήμανση ΔΕΝ γίνεται ψευδές σφάλμα', () => {
  it('η σήμανση `sent` αποτυγχάνει ⇒ επιτυχία προς τον καλούντα, πρόσκληση όπως είναι αποθηκευμένη (`pending`)', async () => {
    mockSend.mockImplementationOnce(async (message: { inviteId: string }) => {
      await fake.collection(COLLECTIONS.VENDOR_INVITES).doc(message.inviteId).delete(); // ⇒ το `update` πετά NOT_FOUND
      return { success: true, providerMessageId: 'm1', errorReason: null, channel: 'email' };
    });
    const result = await manualInvite();
    expect(result.delivery).toMatchObject({ success: true, providerMessageId: 'm1' });
    expect(result.invite.status).toBe('pending');
  });
});

describe('Χ-ΣΤ — η επαφή δίνει μόνο τη γλώσσα· βλάβη ανάγνωσής της ΔΕΝ μπλοκάρει την επαναποστολή', () => {
  it('στιγμιότυπο email + αδιάβαστη επαφή ⇒ η επαναποστολή φεύγει στο στιγμιότυπο, με προεπιλεγμένη γλώσσα', async () => {
    seedInvite('inv_m', { vendorContactId: 'ct_plain', recipientEmail: 'v@vendor.gr', recipientName: 'Προμηθευτής' });
    // Η βάση δεν απαντά ΜΟΝΟ για τις επαφές· κάθε άλλη ανάγνωση (πρόσκληση, RFQ) περνά κανονικά.
    const realCollection = fake.collection.bind(fake);
    const spy = jest.spyOn(fake, 'collection').mockImplementation((name: string) => (name === COLLECTIONS.CONTACTS
      ? ({ doc: () => ({ get: async () => { throw new Error('UNAVAILABLE'); } }) } as unknown as ReturnType<typeof realCollection>)
      : realCollection(name)));
    try {
      expect(await resendVendorInvite(ctx, 'rfq_1', 'inv_m')).toEqual({ success: true, errorReason: null });
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'v@vendor.gr' }));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Σ1β — η επαναποστολή σε χώρο της πλατφόρμας μετρά στο όριο ζεύγους', () => {
  it('όριο ζεύγους εξαντλημένο ⇒ καμία επαναποστολή', async () => {
    seedInvite('inv_1');
    seedPair(QUOTE_REQUEST_PAIR_DAILY_QUOTA.limit);
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('resend_quota_exhausted');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('επιτυχής επαναποστολή ⇒ μία μονάδα ζεύγους', async () => {
    seedInvite('inv_1');
    await resendVendorInvite(ctx, 'rfq_1', 'inv_1');
    expect(pairCount()).toBe(1);
  });
});

describe('Μ2 — τα όρια του Upstash κλείνουν όταν πέφτει το store', () => {
  it('όριο επαναποστολής χωρίς store ⇒ `quota_unavailable`, κανένα email', async () => {
    seedInvite('inv_1');
    mockQuota.mockImplementation(async (scope: unknown) => (scope === VENDOR_INVITE_RESEND_QUOTA_SCOPE ? 'unavailable' : true));
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('quota_unavailable');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('γραμματοκιβώτιο χωρίς store ⇒ ούτε επαναποστολή ούτε χειρόγραφη πρόσκληση', async () => {
    seedInvite('inv_1');
    mockQuota.mockImplementation(async (scope: unknown) => (scope === 'rfq-quote-request:supplier' ? 'unavailable' : true));
    expect(await codeOf(resendVendorInvite(ctx, 'rfq_1', 'inv_1'))).toBe('quota_unavailable');
    fake.reset();
    beforeEachSeed();
    expect(await refusalOf(manualInvite())).toBe('quota_unavailable');
    expect(inviteDocs()).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
