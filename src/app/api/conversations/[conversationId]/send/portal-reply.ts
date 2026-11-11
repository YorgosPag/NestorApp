/**
 * Ο κλάδος **`portal`** της αποστολής από τα εισερχόμενα (ADR-939): απάντηση στο «Γράψτε μας» μιας σελίδας πελάτη.
 *
 * Η διαδρομή `send` κρίνει ιδιοκτησία και διακλαδώνεται στο κανάλι. Εδώ μένει μόνο η μετάφραση «συνομιλία → πηγή →
 * γραφέας της πηγής»: σήμερα η μόνη πηγή είναι το παραστατικό (`subject.kind === 'invoice'`). Συνημμένα δεν
 * υποστηρίζονται ακόμη στη σελίδα πελάτη, άρα αρνούνται ρητά αντί να χαθούν σιωπηλά.
 *
 * @module app/api/conversations/[conversationId]/send/portal-reply
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { replyOnInvoicePortal } from '@/server/accounting/public-invoice/invoice-portal-reply';
import type { ConversationSubjectDoc } from '@/server/types/conversations.firestore';

import type { SendMessageResponse } from './types';

export interface PortalReplyRequest {
  readonly conversationId: string;
  readonly conversation: Readonly<Record<string, unknown>> | undefined;
  readonly caller: AuthContext;
  readonly text: string;
  readonly hasAttachments: boolean;
}

/** Η πηγή της συνομιλίας, μόνο αν είναι πλήρης. Χαλασμένο έγγραφο ⇒ `null`, ποτέ μαντεψιά. */
function invoiceSubjectOf(conversation: PortalReplyRequest['conversation']): ConversationSubjectDoc | null {
  const subject = conversation?.subject as Partial<ConversationSubjectDoc> | undefined;
  if (subject?.kind !== 'invoice') return null;
  const { invoiceId, shareId, reference } = subject;
  if (typeof invoiceId !== 'string' || typeof shareId !== 'string' || typeof reference !== 'string') return null;
  return { kind: 'invoice', invoiceId, shareId, reference };
}

export async function sendPortalReply(request: PortalReplyRequest): Promise<SendMessageResponse> {
  if (request.hasAttachments) throw new ApiError(400, 'Attachments are not supported on the customer page yet');
  if (request.text === '') throw new ApiError(400, 'Message text is required');
  const subject = invoiceSubjectOf(request.conversation);
  if (subject === null) throw new ApiError(422, 'Conversation has no customer-page subject');
  const companyId = typeof request.conversation?.companyId === 'string' ? request.conversation.companyId : request.caller.companyId;
  const outcome = await replyOnInvoicePortal({
    companyId, subject, text: request.text, agent: { uid: request.caller.uid, email: request.caller.email },
  });
  if (outcome.kind === 'invoice-absent') throw new ApiError(409, 'The document of this conversation no longer exists');
  if (outcome.kind === 'store-failed') throw new ApiError(500, 'Failed to store reply');
  return {
    success: true,
    messageId: outcome.messageDocId,
    providerMessageId: null,
    conversationId: request.conversationId,
    sentAt: nowISO(),
  };
}
