import 'server-only';

/**
 * @fileoverview **«Γράψτε μας»: ο πελάτης γράφει στον εκδότη από τη σελίδα του παραστατικού** (ADR-939)
 * @description Το Zoho Invoice έχει σχόλια πάνω στο τιμολόγιο· εδώ το μήνυμα μπαίνει στα **ενιαία εισερχόμενα CRM**,
 *   δίπλα σε Telegram/WhatsApp/email, δεμένο με το παραστατικό:
 *
 *   1. Ο σύνδεσμος είναι η ταυτότητα του πελάτη (`share:<shareId>`, ο ίδιος δράστης με το «άνοιξε τον σύνδεσμο»).
 *      **Μία** συνομιλία ανά σύνδεσμο, κανάλι `portal`, πηγή `{ kind: 'invoice' }`.
 *   2. Το παραστατικό, ο μισθωτής και ο εκδότης βγαίνουν **μόνο** από τον σύνδεσμο (`readSharedInvoice`): το σώμα
 *      του αιτήματος φέρει μόνο κείμενο.
 *   3. Όριο ανά σύνδεσμο ανά 24ω (`INVOICE_PORTAL_MESSAGE_DAILY_QUOTA`) πάνω από το όριο ρυθμού της διαδρομής.
 *   4. Αποθήκευση από τον **ένα** γραφέα του CRM (`storeChannelMessage`)· ειδοποίηση στον δημιουργό του συνδέσμου.
 *
 *   Η όψη του νήματος (`InvoicePortalMessage`) είναι ρητή λίστα πεδίων: ποτέ ονόματα υπαλλήλων, ids ή email.
 *
 * @see ADR-939 · ADR-ACC-018 §16.1 · ADR-174 (μοντέλο συνομιλιών)
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  readMessagesPage, type MessageListItem,
} from '@/app/api/conversations/[conversationId]/messages/conversation-messages-page';
import {
  NOTIFICATION_ENTITY_TYPES, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES, getCurrentEnvironment,
} from '@/config/notification-events';
import { INVOICE_PORTAL_MESSAGE_DAILY_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withinSubjectQuota } from '@/lib/middleware/subject-quota';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { storeChannelMessage } from '@/server/comms/crm/channel-crm-store';
import { generateConversationId } from '@/server/lib/id-generation';
import { dispatchNotification, type DispatchResult } from '@/server/notifications/notification-orchestrator';
import type { ConversationSubjectDoc } from '@/server/types/conversations.firestore';
import { generateMessageId } from '@/services/enterprise-id.service';
import type { Invoice } from '@/subapps/accounting/types';
import {
  INVOICE_PORTAL_MESSAGE_MAX_LENGTH, INVOICE_PORTAL_THREAD_LIMIT,
  type InvoicePortalMessage, type InvoicePortalPostResponse, type InvoicePortalThreadResponse,
} from '@/subapps/accounting/types/invoice-portal-messages';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { MESSAGE_DIRECTION } from '@/types/conversations';
import { orgWorkspace } from '@/types/workspace-membership';

import { linkHolderActor } from './invoice-link-opened';
import { readSharedInvoice, type InvoicePublicSessionInput } from './invoice-public-session';

const logger = createModuleLogger('InvoicePortalMessages');

/** Δύο είδη πράξης δεν τρώνε το ένα το όριο του άλλου (`subject-quota`). */
const PORTAL_MESSAGE_QUOTA_SCOPE = 'invoice-portal-message';

/** Η **μία** συνομιλία του συνδέσμου: η ταυτότητα του πελάτη είναι ο σύνδεσμος. */
export function invoicePortalConversationId(shareId: string): string {
  return generateConversationId(COMMUNICATION_CHANNELS.PORTAL, linkHolderActor(shareId));
}

/** Το κείμενο όπως αποθηκεύεται: χωρίς περιθώρια· `null` όταν είναι κενό ή υπερβαίνει το όριο. */
export function normaliseInvoicePortalText(raw: string): string | null {
  const text = raw.trim();
  return text.length > 0 && text.length <= INVOICE_PORTAL_MESSAGE_MAX_LENGTH ? text : null;
}

/** Η όψη ενός μηνύματος για τον πελάτη. Εισερχόμενο = ο πελάτης· κάθε εξερχόμενο = ο εκδότης. */
export function toInvoicePortalMessage(item: MessageListItem): InvoicePortalMessage {
  return {
    id: item.id,
    author: item.direction === MESSAGE_DIRECTION.INBOUND ? 'customer' : 'issuer',
    text: item.content.text,
    sentAt: item.createdAt,
  };
}

/** Τα πιο πρόσφατα μηνύματα του νήματος, από το παλαιότερο στο νεότερο. */
async function threadOf(shareId: string): Promise<InvoicePortalMessage[]> {
  const page = await readMessagesPage({
    conversationId: invoicePortalConversationId(shareId), page: 1, pageSize: INVOICE_PORTAL_THREAD_LIMIT, order: 'desc',
  });
  return page.messages.map(toInvoicePortalMessage).reverse();
}

/** Το νήμα για τη σελίδα. Ίδιοι φρουροί με την όψη: ενεργός σύνδεσμος, τιμολόγιο του μισθωτή του. */
export async function readInvoicePortalThread(
  db: Firestore, input: InvoicePublicSessionInput,
): Promise<InvoicePortalThreadResponse> {
  const shared = await readSharedInvoice(db, input);
  if (shared.kind === 'refused') return { status: 'refused', reason: shared.reason };
  return { status: 'ok', messages: await threadOf(input.shareId) };
}

/** Η σειρά-αριθμός όπως τη διαβάζει ο άνθρωπος (π.χ. «Α-10»): ο ίδιος τύπος με την όψη της σελίδας. */
export function invoiceReferenceOf(invoice: Pick<Invoice, 'series' | 'number'>): string {
  return `${invoice.series}-${invoice.number}`;
}

function invoiceSubjectOf(invoice: Invoice, shareId: string): ConversationSubjectDoc {
  return { kind: 'invoice', invoiceId: invoice.invoiceId, shareId, reference: invoiceReferenceOf(invoice) };
}

interface IssuerNotice {
  readonly companyId: string;
  readonly recipientId: string;
  readonly invoice: Invoice;
  readonly messageDocId: string;
  readonly text: string;
}

/**
 * ADR-939 §3(στ)(β) — **κανένα αποτέλεσμα της ειδοποίησης δεν χάνεται σιωπηλά.** Ο orchestrator επιστρέφει
 * `success:true, skipped:true` όταν ο εκδότης έκλεισε τον τύπο ή όταν η ίδια ειδοποίηση υπάρχει ήδη (επανάληψη)·
 * αυτό είναι **νόμιμο** αποτέλεσμα, άρα `info`, όχι σφάλμα. Το `success:false` (π.χ. οι ρυθμίσεις δεν διαβάστηκαν)
 * σημαίνει ότι ο εκδότης **δεν** ειδοποιήθηκε χωρίς να το επιλέξει, άρα `warn`.
 */
function reportIssuerNoticeOutcome(messageDocId: string, recipientId: string, result: DispatchResult): void {
  const data = { messageDocId, recipientId, reason: result.reason ?? null };
  if (!result.success) {
    logger.warn('Η ειδοποίηση του εκδότη δεν γράφτηκε: το μήνυμα είναι ήδη στα εισερχόμενα', { data });
  } else if (result.skipped) {
    logger.info('Η ειδοποίηση του εκδότη παραλείφθηκε', { data });
  }
}

/**
 * Ειδοποίηση στον δημιουργό του συνδέσμου. **Παράπλευρη** πράξη: το μήνυμα έχει ήδη αποθηκευτεί και φαίνεται στα
 * εισερχόμενα, οπότε αποτυχία εδώ καταγράφεται και δεν γυρίζει στον πελάτη ως «δεν στάλθηκε».
 */
async function notifyIssuer(notice: IssuerNotice): Promise<void> {
  const reference = invoiceReferenceOf(notice.invoice);
  const customer = notice.invoice.customer.name;
  try {
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.CRM_PORTAL_MESSAGE,
      recipientId: notice.recipientId,
      tenantId: notice.companyId,
      title: `${customer} · ${reference}`,
      titleKey: 'notifications.portal.newMessage',
      titleParams: { customer, reference },
      body: notice.text,
      severity: 'info',
      source: { service: SOURCE_SERVICES.CRM, feature: 'invoice-portal', env: getCurrentEnvironment() },
      eventId: notice.messageDocId,
      entityId: notice.invoice.invoiceId,
      entityType: NOTIFICATION_ENTITY_TYPES.INVOICE,
      ...viewDestination(ENTITY_ROUTES.crm.communications, orgWorkspace(notice.companyId)),
    });
    reportIssuerNoticeOutcome(notice.messageDocId, notice.recipientId, result);
  } catch (error: unknown) {
    logger.warn('Η ειδοποίηση του εκδότη απέτυχε: το μήνυμα είναι ήδη στα εισερχόμενα', {
      messageDocId: notice.messageDocId, error: getErrorMessage(error),
    });
  }
}

export interface InvoicePortalPostInput extends InvoicePublicSessionInput {
  readonly text: string;
}

/**
 * Ο πελάτης γράφει. Σειρά: κείμενο → σύνδεσμος/τιμολόγιο → όριο → αποθήκευση → ειδοποίηση → νήμα.
 * Η επανάληψη του ίδιου αιτήματος (δίκτυο) αναπαράγεται από το σύνορο ιδεμποτίας της διαδρομής (CHECK 3.92).
 */
export async function postInvoicePortalMessage(
  db: Firestore, input: InvoicePortalPostInput,
): Promise<InvoicePortalPostResponse> {
  const text = normaliseInvoicePortalText(input.text);
  if (text === null) return { status: 'refused', reason: 'invalid-text' };
  const shared = await readSharedInvoice(db, input);
  if (shared.kind === 'refused') return { status: 'refused', reason: shared.reason };
  if (!(await withinSubjectQuota(PORTAL_MESSAGE_QUOTA_SCOPE, input.shareId, INVOICE_PORTAL_MESSAGE_DAILY_QUOTA))) {
    return { status: 'refused', reason: 'quota-exhausted' };
  }
  const stored = await storeChannelMessage({
    companyId: shared.companyId,
    channel: COMMUNICATION_CHANNELS.PORTAL,
    externalUserId: linkHolderActor(input.shareId),
    providerMessageId: generateMessageId(),
    senderName: shared.invoice.customer.name,
    text,
    direction: MESSAGE_DIRECTION.INBOUND,
    subject: invoiceSubjectOf(shared.invoice, input.shareId),
  });
  if (stored.messageDocId === null) return { status: 'refused', reason: 'store-failed' };
  await notifyIssuer({
    companyId: shared.companyId, recipientId: shared.share.createdBy, invoice: shared.invoice,
    messageDocId: stored.messageDocId, text,
  });
  return { status: 'sent', messages: await threadOf(input.shareId) };
}
