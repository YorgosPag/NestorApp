import 'server-only';

/**
 * @fileoverview **Ο εκδότης απαντά στο «Γράψτε μας»** από τα ενιαία εισερχόμενα CRM (ADR-939)
 * @description Η απάντηση γράφεται στη **μία** συνομιλία του συνδέσμου (κανάλι `portal`) από τον ένα γραφέα του CRM,
 *   με αποστολέα τον **άνθρωπο** που απάντησε (`senderType: agent`), και:
 *   1. φαίνεται στη σελίδα του παραστατικού (ο πελάτης τη διαβάζει με το ίδιο GET του νήματος)·
 *   2. φεύγει με email στη διεύθυνση που ξέρει **μόνο** ο διακομιστής: εκείνη όπου στάλθηκε ο σύνδεσμος
 *      (`emailHistory[].paymentLinkShareId`), αλλιώς το email του πελάτη στο παραστατικό. Ο πελάτης δεν δηλώνει
 *      ποτέ email στη σελίδα. Χωρίς διεύθυνση η απάντηση μένει μόνο στη σελίδα.
 *
 *   Αποτυχία του email **δεν** ακυρώνει την απάντηση: έχει ήδη γραφτεί και φαίνεται στη σελίδα.
 *
 * @see ADR-939 · invoice-portal-messages.ts (η πλευρά του πελάτη)
 */

import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { wrapInBrandedTemplate } from '@/services/email-templates/base-email-template';
import { buildInvoicePortalReplyEmail } from '@/services/email-templates/invoice-portal-reply-email';
import { storeChannelMessage } from '@/server/comms/crm/channel-crm-store';
import type { ConversationSubjectDoc } from '@/server/types/conversations.firestore';
import { generateMessageId } from '@/services/enterprise-id.service';
import {
  detectInvoiceEmailLanguage, invoiceIssuerEmailFrame,
} from '@/subapps/accounting/services/email/invoice-email-template';
import type { Invoice } from '@/subapps/accounting/types';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { MESSAGE_DIRECTION } from '@/types/conversations';

import { linkHolderActor } from './invoice-link-opened';
import { invoiceReferenceOf } from './invoice-portal-messages';
import { readTenantInvoice } from './tenant-invoice';

const logger = createModuleLogger('InvoicePortalReply');

/**
 * Πού πάει το email της απάντησης: η διεύθυνση όπου στάλθηκε **αυτός** ο σύνδεσμος (η πιο πρόσφατη επιτυχής
 * αποστολή), αλλιώς το email του πελάτη στο παραστατικό. `null` ⇒ η απάντηση μένει μόνο στη σελίδα.
 */
export function invoicePortalReplyRecipient(
  invoice: Pick<Invoice, 'emailHistory' | 'customer'>, shareId: string,
): string | null {
  const sent = (invoice.emailHistory ?? [])
    .filter((record) => record.paymentLinkShareId === shareId && record.status === 'sent');
  const linkRecipient = sent.at(-1)?.recipientEmail?.trim();
  if (linkRecipient) return linkRecipient;
  return invoice.customer.email?.trim() || null;
}

export interface InvoicePortalReplyInput {
  readonly companyId: string;
  readonly subject: ConversationSubjectDoc;
  readonly text: string;
  /** Ο άνθρωπος που απαντά (από το `AuthContext` των εισερχομένων). */
  readonly agent: { readonly uid: string; readonly email: string };
}

export type InvoicePortalReplyOutcome =
  | { readonly kind: 'replied'; readonly messageDocId: string; readonly emailed: boolean }
  | { readonly kind: 'invoice-absent' }
  | { readonly kind: 'store-failed' };

async function emailReply(invoice: Invoice, recipient: string, text: string): Promise<boolean> {
  const language = detectInvoiceEmailLanguage(invoice.customer.country);
  const email = buildInvoicePortalReplyEmail({
    language, issuerName: invoice.issuer.name, reference: invoiceReferenceOf(invoice), replyText: text,
  });
  try {
    const result = await sendReplyViaMailgun({
      to: recipient,
      subject: email.subject,
      textBody: email.textBody,
      htmlBody: wrapInBrandedTemplate({ contentHtml: email.contentHtml, ...invoiceIssuerEmailFrame(invoice), lang: language }),
    });
    return result.success;
  } catch (error: unknown) {
    logger.warn('Το email της απάντησης απέτυχε: η απάντηση φαίνεται ήδη στη σελίδα', { error: getErrorMessage(error) });
    return false;
  }
}

/** Γράφει την απάντηση στη συνομιλία του συνδέσμου και ενημερώνει τον πελάτη με email όπου υπάρχει διεύθυνση. */
export async function replyOnInvoicePortal(input: InvoicePortalReplyInput): Promise<InvoicePortalReplyOutcome> {
  const { companyId, subject, text, agent } = input;
  const found = await readTenantInvoice({ companyId, userId: agent.uid }, subject.invoiceId);
  if (found === null) return { kind: 'invoice-absent' };
  const stored = await storeChannelMessage({
    companyId,
    channel: COMMUNICATION_CHANNELS.PORTAL,
    externalUserId: linkHolderActor(subject.shareId),
    providerMessageId: generateMessageId(),
    senderName: found.invoice.customer.name,
    text,
    direction: MESSAGE_DIRECTION.OUTBOUND,
    agent: { id: agent.uid, name: agent.email },
  });
  if (stored.messageDocId === null) return { kind: 'store-failed' };
  const recipient = invoicePortalReplyRecipient(found.invoice, subject.shareId);
  const emailed = recipient !== null && (await emailReply(found.invoice, recipient, text));
  return { kind: 'replied', messageDocId: stored.messageDocId, emailed };
}
