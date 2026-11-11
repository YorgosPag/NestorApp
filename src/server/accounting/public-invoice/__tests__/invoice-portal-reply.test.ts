/**
 * ADR-939 — η απάντηση του εκδότη (`invoice-portal-reply.ts`): πού πάει το email.
 *
 * Π1 η διεύθυνση όπου στάλθηκε ΑΥΤΟΣ ο σύνδεσμος · Π2 αποτυχημένη αποστολή δεν μετρά · Π3 εφεδρεία στο email του
 * πελάτη · Π4 χωρίς διεύθυνση ⇒ μόνο σελίδα.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({ sendReplyViaMailgun: jest.fn() }));
jest.mock('@/server/comms/crm/channel-crm-store', () => ({ storeChannelMessage: jest.fn() }));
jest.mock('../invoice-portal-messages', () => ({ invoiceReferenceOf: () => 'Α-10' }));
jest.mock('../tenant-invoice', () => ({ readTenantInvoice: jest.fn() }));

import { invoicePortalReplyRecipient } from '../invoice-portal-reply';
import type { EmailSendRecord, Invoice } from '@/subapps/accounting/types';

function record(shareId: string | null, recipientEmail: string, status: 'sent' | 'failed'): EmailSendRecord {
  return {
    sentAt: '2026-11-10T10:00:00.000Z', recipientEmail, subject: 's', mailgunMessageId: null, status, error: null,
    resolvedSource: 'manual', paymentLinkShareId: shareId,
  };
}

function invoiceWith(emailHistory: EmailSendRecord[], customerEmail: string | null): Pick<Invoice, 'emailHistory' | 'customer'> {
  return { emailHistory, customer: { email: customerEmail } as Invoice['customer'] };
}

describe('invoicePortalReplyRecipient', () => {
  it('Π1 — η πιο πρόσφατη επιτυχής αποστολή ΑΥΤΟΥ του συνδέσμου', () => {
    const invoice = invoiceWith([
      record('share_a', 'first@example.com', 'sent'),
      record('share_b', 'other-link@example.com', 'sent'),
      record('share_a', 'latest@example.com', 'sent'),
    ], 'customer@example.com');
    expect(invoicePortalReplyRecipient(invoice, 'share_a')).toBe('latest@example.com');
  });
  it('Π2 — αποτυχημένη αποστολή δεν είναι διεύθυνση', () => {
    const invoice = invoiceWith([record('share_a', 'bounced@example.com', 'failed')], 'customer@example.com');
    expect(invoicePortalReplyRecipient(invoice, 'share_a')).toBe('customer@example.com');
  });
  it('Π3 — σύνδεσμος χωρίς email ⇒ το email του πελάτη στο παραστατικό', () => {
    expect(invoicePortalReplyRecipient(invoiceWith([], ' customer@example.com '), 'share_a')).toBe('customer@example.com');
  });
  it('Π4 — καμία διεύθυνση ⇒ null (η απάντηση μένει στη σελίδα)', () => {
    expect(invoicePortalReplyRecipient(invoiceWith([], null), 'share_a')).toBeNull();
    expect(invoicePortalReplyRecipient(invoiceWith([], '  '), 'share_a')).toBeNull();
  });
});
