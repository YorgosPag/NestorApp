/**
 * =============================================================================
 * ENTERPRISE: UC-006 DOCUMENT & FINANCIAL REQUEST MODULE
 * =============================================================================
 *
 * Unified module for document, invoice, and report requests.
 * Handles `invoice`, `document_request`, and `report_request` intents.
 *
 * All three intents share the same pipeline flow:
 *   Step 3 LOOKUP      -> Find sender contact + query sender history
 *   Step 4 PROPOSE     -> Generate acknowledgment for operator review
 *   Step 6 EXECUTE     -> Record request in audit trail + send reply via channel dispatcher
 *   Step 7 ACKNOWLEDGE -> Verify reply delivery status
 *
 * RULES:
 * - NEVER auto-approved -- always human review (documents need manual preparation)
 * - Reply tone: professional, acknowledges specific request type
 * - Always flags requiresManualFollowUp: true
 *
 * @module services/ai-pipeline/modules/uc-006-document-request
 * @see ADR-145 (UC-006 Document & Financial Requests)
 * @see IUCModule interface (src/types/ai-pipeline.ts)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { findContactByEmail, type ContactMatch } from '../../shared/contact-lookup';
import { getSenderHistory, type SenderHistoryResult } from '../../shared/sender-history';
import { generateAIReply } from '../../shared/ai-reply-generator';
import { sendChannelReply } from '../../shared/channel-reply-dispatcher';
import {
  PipelineIntentType,
} from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('UC_006_DOCUMENT_REQUEST');

// ============================================================================
// REQUEST TYPE MAPPING
// ============================================================================

type DocumentRequestType = 'invoice' | 'document' | 'report';

/** Map pipeline intent to human-readable request type */
function getRequestType(intent?: PipelineIntentTypeValue): DocumentRequestType {
  switch (intent) {
    case PipelineIntentType.INVOICE:
      return 'invoice';
    case PipelineIntentType.REPORT_REQUEST:
      return 'report';
    case PipelineIntentType.DOCUMENT_REQUEST:
    default:
      return 'document';
  }
}

/** Greek labels for request types */
const REQUEST_TYPE_LABELS: Record<DocumentRequestType, string> = {
  invoice: 'Τιμολόγιο',
  document: 'Έγγραφο',
  report: 'Αναφορά',
};

// ============================================================================
// LOOKUP TYPES
// ============================================================================

interface DocumentRequestLookupData {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
  isKnownContact: boolean;
  originalSubject: string;
  requestDescription: string;
  requestType: DocumentRequestType;
  companyId: string;
  senderHistory: SenderHistoryResult | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a static fallback reply for document/invoice/report request.
 * Used when AI generation fails.
 */
function buildDocumentRequestReply(params: {
  senderName: string;
  requestType: DocumentRequestType;
}): string {
  const typeLabel = REQUEST_TYPE_LABELS[params.requestType];

  return [
    `Αγαπητέ/ή ${params.senderName},`,
    '',
    `Σας ευχαριστούμε για την επικοινωνία σας σχετικά με το αίτημα ${typeLabel.toLowerCase()}.`,
    '',
    `Λάβαμε το αίτημά σας και η αρμόδια ομάδα θα το επεξεργαστεί σύντομα. Θα επικοινωνήσουμε μαζί σας μόλις είναι έτοιμο.`,
    '',
    'Παραμένουμε στη διάθεσή σας.',
    '',
    'Με εκτίμηση,',
  ].join('\n');
}

// ============================================================================
// UC-006 MODULE
// ============================================================================

export class DocumentRequestModule implements IUCModule {
  readonly moduleId = 'UC-006';
  readonly displayName = 'Αίτημα Εγγράφου/Τιμολογίου';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.INVOICE,
    PipelineIntentType.DOCUMENT_REQUEST,
    PipelineIntentType.REPORT_REQUEST,
  ];
  readonly requiredRoles: readonly string[] = ['salesManager'];

  // -- Step 3: LOOKUP --------------------------------------------------------

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const senderEmail = ctx.intake.normalized.sender.email ?? '';
    const senderName = ctx.intake.normalized.sender.name ?? senderEmail;

    logger.info('UC-006 LOOKUP: Searching for sender contact', {
      requestId: ctx.requestId,
      senderEmail,
      companyId: ctx.companyId,
    });

    // Find sender in contacts collection
    let senderContact: ContactMatch | null = null;
    if (senderEmail) {
      try {
        senderContact = await findContactByEmail(senderEmail, ctx.companyId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-006 LOOKUP: Contact search failed (non-fatal)', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    // Query sender history
    let senderHistory: SenderHistoryResult | null = null;
    try {
      senderHistory = await getSenderHistory(
        senderEmail,
        ctx.companyId,
        ctx.intake.id,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('UC-006 LOOKUP: Sender history query failed (non-fatal)', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    const requestDescription = ctx.intake.normalized.contentText?.slice(0, 500)
      ?? ctx.intake.normalized.subject
      ?? '';

    const requestType = getRequestType(ctx.understanding?.intent);

    const lookupData: DocumentRequestLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      originalSubject: ctx.intake.normalized.subject ?? '',
      requestDescription,
      requestType,
      companyId: ctx.companyId,
      senderHistory,
    };

    logger.info('UC-006 LOOKUP: Complete', {
      requestId: ctx.requestId,
      isKnownContact: lookupData.isKnownContact,
      contactId: senderContact?.contactId,
      requestType,
      isReturningContact: senderHistory?.isReturningContact,
      previousEmails: senderHistory?.totalPreviousEmails,
    });

    return lookupData as unknown as Record<string, unknown>;
  }

  // -- Step 4: PROPOSE -------------------------------------------------------

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as DocumentRequestLookupData | undefined;

    const senderDisplay = lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
    const requestDescription = lookup?.requestDescription
      || ctx.intake.normalized.contentText?.slice(0, 300)
      || '';
    const requestType = lookup?.requestType ?? getRequestType(ctx.understanding?.intent);
    const typeLabel = REQUEST_TYPE_LABELS[requestType];

    const summary = `Αίτημα ${typeLabel.toLowerCase()} από ${senderDisplay}: ${requestDescription.slice(0, 100)}`;

    // Generate dynamic AI reply
    const aiReplyResult = await generateAIReply(
      {
        useCase: 'document_request',
        senderName: senderDisplay,
        isKnownContact: lookup?.isKnownContact ?? false,
        originalMessage: ctx.intake.normalized.contentText?.slice(0, 1000) ?? '',
        originalSubject: lookup?.originalSubject ?? '',
        moduleContext: {
          requestType: typeLabel,
          requestDescription: requestDescription || null,
        },
        senderHistory: lookup?.senderHistory?.recentEmails,
        isReturningContact: lookup?.senderHistory?.isReturningContact,
      },
      () => buildDocumentRequestReply({
        senderName: senderDisplay,
        requestType,
      }),
      ctx.requestId,
    );

    const draftReply = aiReplyResult.replyText;

    logger.info('UC-006 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      summary: summary.slice(0, 200),
      requestType,
      aiGenerated: aiReplyResult.aiGenerated,
      aiDurationMs: aiReplyResult.durationMs,
    });

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'acknowledge_document_request',
          params: {
            senderEmail: lookup?.senderEmail ?? null,
            senderName: lookup?.senderName ?? null,
            contactId: lookup?.senderContact?.contactId ?? null,
            isKnownContact: lookup?.isKnownContact ?? false,
            requestType,
            requestTypeLabel: typeLabel,
            requestDescription: requestDescription || summary,
            companyId: ctx.companyId,
            draftReply,
            aiGenerated: aiReplyResult.aiGenerated,
            requiresManualFollowUp: true,
            channel: ctx.intake.channel,
            telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
          },
        },
      ],
      requiredApprovals: ['salesManager'],
      autoApprovable: false, // Documents/invoices ALWAYS need human preparation
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // -- Step 6: EXECUTE -------------------------------------------------------

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-006 EXECUTE: Processing document request acknowledgment', {
      requestId: ctx.requestId,
    });

    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const ackAction = actions.find(a => a.type === 'acknowledge_document_request');

      if (!ackAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No acknowledge_document_request action found in approved actions',
        };
      }

      const params = ackAction.params;

      // -- 1. Record request in audit trail --
      const adminDb = getAdminFirestore();
      const requestRecord = {
        type: 'document_request',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: {
          email: (params.senderEmail as string) ?? null,
          name: (params.senderName as string) ?? null,
          contactId: (params.contactId as string) ?? null,
          isKnownContact: (params.isKnownContact as boolean) ?? false,
        },
        requestType: (params.requestType as string) ?? 'document',
        requestTypeLabel: (params.requestTypeLabel as string) ?? null,
        requestDescription: (params.requestDescription as string) ?? null,
        requiresManualFollowUp: true,
        channel: ctx.intake.channel,
        status: 'pending_preparation',
        approvedBy: ctx.approval?.approvedBy ?? null,
        approvedAt: ctx.approval?.decidedAt ?? null,
        createdAt: new Date().toISOString(),
      };

      const docRef = await adminDb
        .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
        .add(requestRecord);

      logger.info('UC-006 EXECUTE: Request recorded', {
        requestId: ctx.requestId,
        auditId: docRef.id,
        requestType: params.requestType,
      });

      // -- 2. Send reply via channel dispatcher --
      const draftReply = (params.draftReply as string) ?? '';
      const senderEmail = (params.senderEmail as string) ?? '';
      const originalSubject = ctx.intake.normalized.subject ?? 'Αίτημα';
      const channel = ctx.intake.channel;
      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const requestType = (params.requestType as DocumentRequestType) ?? 'document';

      const replyResult = await sendChannelReply({
        channel,
        recipientEmail: senderEmail || undefined,
        telegramChatId: telegramChatId || undefined,
        subject: `Re: ${originalSubject}`,
        textBody: draftReply || buildDocumentRequestReply({
          senderName: (params.senderName as string) ?? senderEmail,
          requestType,
        }),
        requestId: ctx.requestId,
      });

      // Build side effects list
      const sideEffects = [`document_request_recorded:${docRef.id}`];

      if (replyResult.success) {
        sideEffects.push(`reply_sent:${replyResult.messageId ?? 'unknown'}`);
        logger.info('UC-006 EXECUTE: Reply sent', {
          requestId: ctx.requestId,
          channel: replyResult.channel,
          messageId: replyResult.messageId,
        });
      } else {
        sideEffects.push(`reply_failed:${replyResult.error ?? 'unknown'}`);
        logger.warn('UC-006 EXECUTE: Reply send failed (request still recorded)', {
          requestId: ctx.requestId,
          channel: replyResult.channel,
          error: replyResult.error,
        });
      }

      // Request recording is the primary action -- reply failure is non-fatal
      return {
        success: true,
        sideEffects,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('UC-006 EXECUTE: Failed', {
        requestId: ctx.requestId,
        error: errorMessage,
      });

      return {
        success: false,
        sideEffects: [],
        error: `Failed to process document request: ${errorMessage}`,
      };
    }
  }

  // -- Step 7: ACKNOWLEDGE ---------------------------------------------------

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const channel = ctx.intake.channel;

    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;

    logger.info('UC-006 ACKNOWLEDGE: Reply delivery status', {
      requestId: ctx.requestId,
      channel,
      replySent,
    });

    return {
      sent: replySent,
      channel,
    };
  }

  // -- Health Check ----------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    try {
      const adminDb = getAdminFirestore();
      await adminDb.collection(COLLECTIONS.AI_PIPELINE_AUDIT).limit(1).get();
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('UC-006 HEALTH CHECK: Failed', { error: msg });
      return false;
    }
  }
}
