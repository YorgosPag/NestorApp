/**
 * @jest-environment node
 *
 * **Ο ΕΝΑΣ φρουρός «επιτρέπεται αποστολή σε χώρο της πλατφόρμας;»** σε κάθε δρόμο εκτός του fan-out (ADR-923 §5.13 Τ5,
 * ανασκόπηση ασφαλείας Ε1/Ε2/Ε6/Ε7): χειρόγραφη πρόσκληση, επαναποστολή, «στείλε μου νέο σύνδεσμο». Αληθινός κριτής
 * παραλήπτη, αληθινός αναγνώστης `quoteIntake`, αληθινά διαπιστευτήρια πάνω στο ψεύτικο Firestore. Ψεύτικα: ο πάροχος, η
 * έκδοση διαπιστευτηρίου, η ποσόστωση, η βιτρίνα, οι ειδοποιήσεις.
 */

jest.mock('server-only', () => ({}));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fake,
  isFirebaseAdminAvailable: () => true,
  safeFirestoreOperation: async (op: (db: unknown) => Promise<unknown>) => op(fake),
  FieldValue: jest.requireActual('firebase-admin/firestore').FieldValue,
}));

const mockSend = jest.fn();
jest.mock('../channels/email-channel', () => ({
  emailVendorInviteChannel: { id: 'email', isAvailable: () => true, send: (...a: unknown[]) => mockSend(...a) },
}));
let mockMintCount = 0;
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: (nowMs: number) => nowMs + 7 * 86_400_000,
  mintVendorInviteCredential: async (input: { inviteId: string; rfqId: string; companyId: string; issuedVia: string }) => {
    mockMintCount += 1;
    const id = `vic_${input.issuedVia}_${mockMintCount}`;
    return {
      credential: { id, inviteId: input.inviteId, rfqId: input.rfqId, companyId: input.companyId, issuedVia: input.issuedVia, issuedAt: `2026-11-04T10:00:0${mockMintCount}.000Z`, revokedAt: null, nonceHash: 'h', expiresAt: '2027-01-01T00:00:00.000Z' },
      token: `tok_${id}`,
    };
  },
}));
jest.mock('../vendor-portal-links', () => ({ vendorPortalUrl: (t: string) => `https://app.test/q#${t}`, vendorDeclineUrl: (t: string) => `https://app.test/d#${t}` }));
const mockQuota = jest.fn(async () => true);
jest.mock('@/lib/middleware/subject-quota', () => ({ withinSubjectQuota: (...a: unknown[]) => mockQuota(...(a as [])) }));
jest.mock('@/lib/middleware/recipient-quota', () => ({ withinRecipientQuota: async () => true }));
const mockShowcase = jest.fn();
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({ readPublicSupplier: (...a: unknown[]) => mockShowcase(...a) }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: async () => ({ success: true }) }));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: async () => [] }));
jest.mock('../vendor-invite-audit', () => ({ recordVendorInviteAudit: () => undefined }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';

import { resendVendorInvite } from '../vendor-invite-links-service';
import { createVendorInvite } from '../vendor-invite-service';
import { renewVendorLink } from '../vendor-link-renew';
import type { VendorInvite } from '../../types/vendor-invite';
/* eslint-enable import/first */

const BUYER = 'comp_buyer';
const SUPPLIER = 'comp_aries';
const PLATFORM_CONTACT = generateDeterministicPlatformCompanyContactId(BUYER, SUPPLIER);
const ctx = { uid: 'u_pm', companyId: BUYER } as unknown as AuthContext;
const SENT = { success: true, providerMessageId: 'm1', errorReason: null, channel: 'email' };
const PROVIDER_TEXT = { success: false, providerMessageId: null, errorReason: 'invalid `to`: quotes@aries.gr', channel: 'email' };

const sentTo = () => mockSend.mock.calls.map(([message]) => (message as { recipient: string }).recipient);
const credentials = () => Object.values(fake.getAllDocs(COLLECTIONS.VENDOR_INVITE_CREDENTIALS)) as { id: string; issuedVia: string; revokedAt: string | null }[];

function seedInvite(over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.VENDOR_INVITES, 'inv_1', {
    id: 'inv_1', rfqId: 'rfq_1', companyId: BUYER, vendorContactId: PLATFORM_CONTACT, status: 'sent', deliveryChannel: 'email',
    expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000), recipientEmail: null, recipientName: 'ARIES ΑΕ', ...over,
  });
  for (const [id, issuedVia] of [['vic_old_mail', 'rfq_fanout'], ['vic_old_copy', 'copy_link']]) {
    fake.seed(COLLECTIONS.VENDOR_INVITE_CREDENTIALS, id, { id, inviteId: 'inv_1', rfqId: 'rfq_1', companyId: BUYER, issuedVia, issuedAt: '2026-11-01T00:00:00.000Z', revokedAt: null });
  }
}

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
  mockMintCount = 0;
  mockSend.mockResolvedValue(SENT);
  mockQuota.mockResolvedValue(true);
  mockShowcase.mockResolvedValue({ companyId: SUPPLIER, legalName: 'ARIES ΑΕ', alias: null });
  fake.seed(COLLECTIONS.RFQS, 'rfq_1', { id: 'rfq_1', companyId: BUYER, title: 'Καλώδια', status: 'active', invitedVendorIds: [] });
  fake.seed(COLLECTIONS.CONTACTS, PLATFORM_CONTACT, { type: 'company', companyId: BUYER, platformCompanyId: SUPPLIER, companyName: 'ARIES ΑΕ' });
  const profile = generateDeterministicCatalogSupplierProfileId(SUPPLIER);
  fake.seed('catalog_supplier_profiles', profile, {
    id: profile, companyId: SUPPLIER, isDeleted: false, revision: 1, description: {}, projects: [], quoteIntake: { enabled: true, recipientEmail: 'quotes@aries.gr' },
  });
});

describe('χειρόγραφη πρόσκληση σε χώρο της πλατφόρμας (Ε7)', () => {
  const invite = () => createVendorInvite(ctx, { rfqId: 'rfq_1', vendorContactId: PLATFORM_CONTACT, deliveryChannel: 'email' });

  it('στέλνει στο `quoteIntake`, και το στιγμιότυπο email της πρόσκλησης μένει `null`', async () => {
    const result = await invite();
    expect(sentTo()).toEqual(['quotes@aries.gr']);
    expect(result.delivery.success).toBe(true);
    const stored = Object.values(fake.getAllDocs(COLLECTIONS.VENDOR_INVITES))[0] as VendorInvite;
    expect(stored.recipientEmail).toBeNull();
    expect(JSON.stringify(stored)).not.toContain('quotes@aries.gr');
  });

  it('περνά από τον ίδιο φρουρό: ζεύγος και προμηθευτής', async () => {
    await invite();
    expect(mockQuota.mock.calls.map(([scope, subject]) => [scope, subject])).toEqual([
      ['rfq-quote-request:pair', `${BUYER}:${SUPPLIER}`], ['rfq-quote-request:supplier', SUPPLIER],
    ]);
  });

  it('όριο προμηθευτή γεμάτο ⇒ κανένα email, κωδικός `recipient_quota`, πρόσκληση σε αναμονή', async () => {
    mockQuota.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await invite();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.delivery).toEqual({ success: false, providerMessageId: null, errorReason: 'recipient_quota' });
    expect(result.invite.status).toBe('pending');
  });

  it('🔒 Ε6: αποτυχία παρόχου ⇒ γενικός κωδικός, ποτέ το κείμενό του (που φέρει τη διεύθυνση)', async () => {
    mockSend.mockResolvedValueOnce(PROVIDER_TEXT);
    const result = await invite();
    expect(result.delivery.errorReason).toBe('delivery_failed');
    expect(JSON.stringify(result)).not.toContain('quotes@aries.gr');
  });

  it('επαφή του αγοραστή (όχι πλατφόρμα) ⇒ κανένας φρουρός πλατφόρμας, στιγμιότυπο όπως πριν', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_v', { companyId: BUYER, email: 'v@vendor.gr', displayName: 'V' });
    const result = await createVendorInvite(ctx, { rfqId: 'rfq_1', vendorContactId: 'cont_v', deliveryChannel: 'email' });
    expect(mockQuota).not.toHaveBeenCalled();
    expect(result.invite.recipientEmail).toBe('v@vendor.gr');
  });
});

describe('επαναποστολή σε χώρο της πλατφόρμας (Ε1/Ε6/Ε7)', () => {
  beforeEach(() => seedInvite());

  it('περνά από τον φρουρό και ανακαλεί τους ΠΡΟΗΓΟΥΜΕΝΟΥΣ συνδέσμους email (όχι τον σύνδεσμο αντιγραφής)', async () => {
    expect(await resendVendorInvite(ctx, 'rfq_1', 'inv_1')).toEqual({ success: true, errorReason: null });
    expect(sentTo()).toEqual(['quotes@aries.gr']);
    expect(mockQuota).toHaveBeenCalledWith('rfq-quote-request:pair', `${BUYER}:${SUPPLIER}`, expect.anything());
    const byId = new Map(credentials().map((c) => [c.id, c]));
    expect(byId.get('vic_old_mail')?.revokedAt).not.toBeNull();
    expect(byId.get('vic_old_copy')?.revokedAt).toBeNull();
    expect(credentials().filter((c) => c.issuedVia === 'email_resend' && c.revokedAt === null)).toHaveLength(1);
  });

  it('γεμάτο όριο ⇒ κανένα email, κανένα νέο διαπιστευτήριο, τίποτα δεν ανακαλείται', async () => {
    mockQuota.mockResolvedValueOnce(false);
    expect(await resendVendorInvite(ctx, 'rfq_1', 'inv_1')).toEqual({ success: false, errorReason: 'recipient_quota' });
    expect(mockSend).not.toHaveBeenCalled();
    expect(credentials()).toHaveLength(2);
    expect(credentials().every((c) => c.revokedAt === null)).toBe(true);
  });

  it('🔒 αποτυχία παρόχου ⇒ γενικός κωδικός και οι παλιοί σύνδεσμοι ΔΕΝ ανακαλούνται (ο προμηθευτής δεν μένει χωρίς)', async () => {
    mockSend.mockResolvedValueOnce(PROVIDER_TEXT);
    expect(await resendVendorInvite(ctx, 'rfq_1', 'inv_1')).toEqual({ success: false, errorReason: 'delivery_failed' });
    expect(credentials().find((c) => c.id === 'vic_old_mail')?.revokedAt).toBeNull();
  });

  it('βιτρίνα όχι επιβεβαιωμένη ⇒ κανένας παραλήπτης (Ε3β)', async () => {
    mockShowcase.mockResolvedValue(null);
    await expect(resendVendorInvite(ctx, 'rfq_1', 'inv_1')).rejects.toThrow('Recipient has no email address');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('«στείλε μου νέο σύνδεσμο» σε χώρο της πλατφόρμας (Ε1)', () => {
  it('γεμάτο όριο ζεύγους ⇒ `quota_exhausted`, κανένα email', async () => {
    seedInvite();
    mockQuota.mockResolvedValueOnce(false);
    const invite = fake.getData(COLLECTIONS.VENDOR_INVITES, 'inv_1') as VendorInvite;
    expect(await renewVendorLink({ invite: { ...invite, id: 'inv_1' }, requesterIpHash: 'h', locale: 'el' })).toBe('quota_exhausted');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
