/**
 * ADR-939 — «Γράψτε μας» στη σελίδα παραστατικού: η πλευρά του πελάτη (`invoice-portal-messages.ts`).
 *
 * Γ1 κείμενο · Γ2 ταυτότητα συνομιλίας · Γ3 όψη μηνύματος · Γ4 ροή αποστολής (άρνηση / όριο / αποθήκευση /
 * ειδοποίηση) · Γ5 μισθωτής και πηγή από τον σύνδεσμο, ποτέ από το αίτημα.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  }),
}));

const mockReadMessagesPage = jest.fn();
jest.mock('@/app/api/conversations/[conversationId]/messages/conversation-messages-page', () => ({
  readMessagesPage: (...args: unknown[]) => mockReadMessagesPage(...args),
}));
const mockWithinSubjectQuota = jest.fn();
jest.mock('@/lib/middleware/subject-quota', () => ({
  withinSubjectQuota: (...args: unknown[]) => mockWithinSubjectQuota(...args),
}));
const mockStoreChannelMessage = jest.fn();
jest.mock('@/server/comms/crm/channel-crm-store', () => ({
  storeChannelMessage: (...args: unknown[]) => mockStoreChannelMessage(...args),
}));
const mockDispatchNotification = jest.fn();
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: unknown[]) => mockDispatchNotification(...args),
}));
jest.mock('@/services/enterprise-id.service', () => ({
  ...jest.requireActual('@/services/enterprise-id.service'),
  generateMessageId: () => 'msg_fixed',
}));
const mockReadSharedInvoice = jest.fn();
jest.mock('../invoice-public-session', () => ({
  readSharedInvoice: (...args: unknown[]) => mockReadSharedInvoice(...args),
}));

import type { Firestore } from 'firebase-admin/firestore';

import {
  invoicePortalConversationId,
  normaliseInvoicePortalText,
  postInvoicePortalMessage,
  readInvoicePortalThread,
  toInvoicePortalMessage,
  unansweredCustomerBurst,
  PORTAL_EMAIL_BURST_LIMIT,
} from '../invoice-portal-messages';
import type { MessageListItem } from '@/app/api/conversations/[conversationId]/messages/conversation-messages-page';
import { EVENT_CATEGORY_MAP, NOTIFICATION_EVENT_TYPES, PORTAL_MESSAGE_EMAIL_GRACE_MS } from '@/config/notification-events';
import { DEFAULT_CRM_SETTINGS } from '@/services/user-notification-settings/user-notification-settings.types';
import { INVOICE_PORTAL_MESSAGE_MAX_LENGTH } from '@/subapps/accounting/types/invoice-portal-messages';

const db = {} as Firestore;
const SHARE_ID = 'share_abc';
const TENANT = 'comp_tenant';

function sharedFound() {
  return {
    kind: 'found' as const,
    companyId: TENANT,
    share: { createdBy: 'user_issuer' },
    invoice: { invoiceId: 'inv_1', series: 'Α', number: 10, customer: { name: 'Πελάτης ΑΕ' } },
  };
}

function listItem(direction: 'inbound' | 'outbound', id: string): MessageListItem {
  return {
    id, conversationId: 'conv', direction, channel: 'portal', senderId: 's', senderName: 'Εσωτερικό Όνομα',
    senderType: direction === 'inbound' ? 'customer' : 'agent', content: { text: `κείμενο ${id}` },
    providerMessageId: 'p', deliveryStatus: 'delivered', providerMetadata: {}, createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReadSharedInvoice.mockResolvedValue(sharedFound());
  mockWithinSubjectQuota.mockResolvedValue(true);
  mockStoreChannelMessage.mockResolvedValue({ messageDocId: 'msg_doc_1', conversationId: 'conv', isNewConversation: true });
  mockDispatchNotification.mockResolvedValue({ success: true });
  mockReadMessagesPage.mockResolvedValue({ messages: [listItem('outbound', 'b'), listItem('inbound', 'a')], totalCount: 2, offset: 0 });
});

describe('Γ1 — κείμενο', () => {
  it('κόβει περιθώρια και δέχεται έως το όριο', () => {
    expect(normaliseInvoicePortalText('  γεια  ')).toBe('γεια');
    expect(normaliseInvoicePortalText('x'.repeat(INVOICE_PORTAL_MESSAGE_MAX_LENGTH))).toHaveLength(INVOICE_PORTAL_MESSAGE_MAX_LENGTH);
  });
  it('απορρίπτει κενό και υπέρβαση ορίου', () => {
    expect(normaliseInvoicePortalText('   ')).toBeNull();
    expect(normaliseInvoicePortalText('x'.repeat(INVOICE_PORTAL_MESSAGE_MAX_LENGTH + 1))).toBeNull();
  });
});

describe('Γ2 — μία συνομιλία ανά σύνδεσμο', () => {
  it('ίδιος σύνδεσμος ⇒ ίδια συνομιλία · άλλος σύνδεσμος ⇒ άλλη', () => {
    expect(invoicePortalConversationId(SHARE_ID)).toBe(invoicePortalConversationId(SHARE_ID));
    expect(invoicePortalConversationId(SHARE_ID)).not.toBe(invoicePortalConversationId('share_other'));
    expect(invoicePortalConversationId(SHARE_ID)).toContain('_portal_');
  });
});

describe('Γ3 — όψη μηνύματος για τον πελάτη', () => {
  it('εισερχόμενο = πελάτης · εξερχόμενο = εκδότης · κανένα όνομα υπαλλήλου', () => {
    const view = toInvoicePortalMessage(listItem('outbound', 'b'));
    expect(view).toEqual({ id: 'b', author: 'issuer', text: 'κείμενο b', sentAt: '2026-11-12T10:00:00.000Z' });
    expect(JSON.stringify(view)).not.toContain('Εσωτερικό Όνομα');
    expect(toInvoicePortalMessage(listItem('inbound', 'a')).author).toBe('customer');
  });
  it('το νήμα έρχεται από το παλαιότερο στο νεότερο', async () => {
    const outcome = await readInvoicePortalThread(db, { shareId: SHARE_ID, nowMs: 0 });
    expect(outcome).toEqual({ status: 'ok', messages: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })] });
  });
});

describe('Γ4 — ροή αποστολής', () => {
  const post = (text: string) => postInvoicePortalMessage(db, { shareId: SHARE_ID, nowMs: 0, text });

  it('άκυρο κείμενο ⇒ άρνηση χωρίς ανάγνωση συνδέσμου', async () => {
    await expect(post('  ')).resolves.toEqual({ status: 'refused', reason: 'invalid-text' });
    expect(mockReadSharedInvoice).not.toHaveBeenCalled();
  });
  it('ανενεργός σύνδεσμος ⇒ η άρνηση της σελίδας, τίποτα δεν γράφεται', async () => {
    mockReadSharedInvoice.mockResolvedValue({ kind: 'refused', reason: 'link-inactive' });
    await expect(post('γεια')).resolves.toEqual({ status: 'refused', reason: 'link-inactive' });
    expect(mockStoreChannelMessage).not.toHaveBeenCalled();
  });
  it('εξαντλημένο όριο ⇒ άρνηση, τίποτα δεν γράφεται, κανείς δεν ειδοποιείται', async () => {
    mockWithinSubjectQuota.mockResolvedValue(false);
    await expect(post('γεια')).resolves.toEqual({ status: 'refused', reason: 'quota-exhausted' });
    expect(mockWithinSubjectQuota).toHaveBeenCalledWith('invoice-portal-message', SHARE_ID, expect.objectContaining({ limit: 20 }));
    expect(mockStoreChannelMessage).not.toHaveBeenCalled();
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });
  it('αποτυχία αποθήκευσης ⇒ store-failed, καμία ειδοποίηση', async () => {
    mockStoreChannelMessage.mockResolvedValue({ messageDocId: null, conversationId: null, isNewConversation: false });
    await expect(post('γεια')).resolves.toEqual({ status: 'refused', reason: 'store-failed' });
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });
  it('επιτυχία ⇒ ειδοποίηση στον δημιουργό του συνδέσμου και νήμα', async () => {
    const outcome = await post('  γεια σας  ');
    expect(outcome.status).toBe('sent');
    expect(mockDispatchNotification).toHaveBeenCalledWith(expect.objectContaining({
      eventType: NOTIFICATION_EVENT_TYPES.CRM_PORTAL_MESSAGE,
      recipientId: 'user_issuer', tenantId: TENANT, eventId: 'msg_doc_1', body: 'γεια σας',
      titleParams: { customer: 'Πελάτης ΑΕ', reference: 'Α-10' },
    }));
    expect(mockLoggerInfo).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
  it('🔴 ADR-939 §3(στ) — ο τύπος είναι ΑΝΟΙΧΤΟΣ από προεπιλογή, όχι ο κλειστός `newCommunication`', () => {
    const mapping = EVENT_CATEGORY_MAP[NOTIFICATION_EVENT_TYPES.CRM_PORTAL_MESSAGE];
    expect(mapping).toEqual(expect.objectContaining({ category: 'crm', settingKey: 'portalMessage', isMandatory: false }));
    expect(DEFAULT_CRM_SETTINGS.portalMessage).toBe(true);
  });
  it('παραλείφθηκε (διακόπτης κλειστός) ⇒ το μήνυμα στάλθηκε ΚΑΙ ο λόγος καταγράφεται', async () => {
    mockDispatchNotification.mockResolvedValue({ success: true, skipped: true, reason: 'crm.portalMessage disabled' });
    await expect(post('γεια')).resolves.toEqual(expect.objectContaining({ status: 'sent' }));
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.any(String), {
      data: { messageDocId: 'msg_doc_1', recipientId: 'user_issuer', reason: 'crm.portalMessage disabled' },
    });
  });
  it('δεν γράφτηκε (success:false) ⇒ το μήνυμα στάλθηκε ΚΑΙ προειδοποίηση', async () => {
    mockDispatchNotification.mockResolvedValue({ success: false, skipped: true, reason: 'Failed to load user settings' });
    await expect(post('γεια')).resolves.toEqual(expect.objectContaining({ status: 'sent' }));
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.any(String), {
      data: { messageDocId: 'msg_doc_1', recipientId: 'user_issuer', reason: 'Failed to load user settings' },
    });
  });
  it('αποτυχία ειδοποίησης δεν ακυρώνει το μήνυμα', async () => {
    mockDispatchNotification.mockRejectedValue(new Error('down'));
    await expect(post('γεια')).resolves.toEqual(expect.objectContaining({ status: 'sent' }));
  });
});

describe('Γ5 — μισθωτής και πηγή μόνο από τον σύνδεσμο', () => {
  it('γράφει στον μισθωτή του συνδέσμου, κανάλι portal, με πηγή το παραστατικό', async () => {
    await postInvoicePortalMessage(db, { shareId: SHARE_ID, nowMs: 0, text: 'γεια' });
    expect(mockStoreChannelMessage).toHaveBeenCalledWith(expect.objectContaining({
      companyId: TENANT,
      channel: 'portal',
      externalUserId: `share:${SHARE_ID}`,
      direction: 'inbound',
      senderName: 'Πελάτης ΑΕ',
      subject: { kind: 'invoice', invoiceId: 'inv_1', shareId: SHARE_ID, reference: 'Α-10' },
    }));
  });
});

describe('Γ6 — ADR-939 §6.1 βήμα 6Β: ένα email για όλη τη σιωπή', () => {
  const msg = (id: string, author: 'customer' | 'issuer') => ({ id, author, text: id, sentAt: '2026-11-13T10:00:00.000Z' });

  it('Γ6.1 — μόνο τα μηνύματα πελάτη ΜΕΤΑ την τελευταία απάντηση, με τη σειρά τους', () => {
    const burst = unansweredCustomerBurst([msg('c1', 'customer'), msg('i1', 'issuer'), msg('c2', 'customer'), msg('c3', 'customer')]);
    expect(burst.map((m) => m.id)).toEqual(['c2', 'c3']);
  });

  it('Γ6.2 — τελευταίο μήνυμα του εκδότη ⇒ τίποτα αναπάντητο', () => {
    expect(unansweredCustomerBurst([msg('c1', 'customer'), msg('i1', 'issuer')])).toEqual([]);
  });

  it('Γ6.3 — όριο: μόνο τα πιο πρόσφατα', () => {
    const many = Array.from({ length: PORTAL_EMAIL_BURST_LIMIT + 3 }, (_, i) => msg(`c${i}`, 'customer'));
    const burst = unansweredCustomerBurst(many);
    expect(burst).toHaveLength(PORTAL_EMAIL_BURST_LIMIT);
    expect(burst[burst.length - 1]?.id).toBe(`c${PORTAL_EMAIL_BURST_LIMIT + 2}`);
  });

  it('Γ6.4 🔑 — η ειδοποίηση φέρει αναμονή, γεγονότα συνομιλίας και σώμα email με όλα τα αναπάντητα', async () => {
    mockReadMessagesPage.mockResolvedValue({
      messages: [listItem('inbound', 'msg_doc_1'), listItem('inbound', 'a0'), listItem('outbound', 'b')], totalCount: 3, offset: 0,
    });
    const before = Date.now();
    await postInvoicePortalMessage(db, { shareId: SHARE_ID, nowMs: 0, text: 'γεια' });
    const request = mockDispatchNotification.mock.calls[0]?.[0] as { emailNotBefore: Date };
    expect(mockDispatchNotification).toHaveBeenCalledWith(expect.objectContaining({
      body: 'γεια',
      emailBody: 'κείμενο a0\n\nκείμενο msg_doc_1',
      emailFacts: { kind: 'crm-conversation-unread', conversationId: 'conv', messageId: 'msg_doc_1' },
    }));
    expect(request.emailNotBefore.getTime()).toBeGreaterThanOrEqual(before + PORTAL_MESSAGE_EMAIL_GRACE_MS);
  });

  it('Γ6.5 🔴 — αποτυχία ανάγνωσης νήματος ΔΕΝ χάνει την ειδοποίηση (email μόνο με αυτό το μήνυμα)', async () => {
    mockReadMessagesPage.mockRejectedValueOnce(new Error('down'));
    await expect(postInvoicePortalMessage(db, { shareId: SHARE_ID, nowMs: 0, text: 'γεια' }))
      .resolves.toEqual(expect.objectContaining({ status: 'sent' }));
    expect(mockDispatchNotification).toHaveBeenCalledWith(expect.objectContaining({ emailBody: 'γεια' }));
  });
});
