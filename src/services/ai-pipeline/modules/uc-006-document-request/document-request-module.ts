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

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { ContactMatch } from '../../shared/contact-lookup';
import {
  acknowledgeReply,
  approvalOf,
  collectionHealthCheck,
  logLookupComplete,
  lookupOf,
  lookupSender,
  querySenderHistory,
  recordPipelineAudit,
  requesterOf,
  sendRecordedReply,
  senderDisplayOf,
  toLookupRecord,
} from '../../shared/customer-request-protocol';
import type { SenderHistoryResult } from '../../shared/sender-history';
import { generateAIReply } from '../../shared/ai-reply-generator';
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
import { nowISO } from '@/lib/date-local';
import { approvedAction, humanApprovedProposal } from '../../shared/admin-command-protocol';

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
    const { senderEmail, senderName, senderContact } = await lookupSender(ctx, 'UC-006', logger);

    const senderHistory = await querySenderHistory(ctx, 'UC-006', logger, senderEmail);

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

    logLookupComplete(ctx, 'UC-006', logger, { senderContact, senderHistory }, { requestType });

    return toLookupRecord(lookupData);
  }

  // -- Step 4: PROPOSE -------------------------------------------------------

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = lookupOf<DocumentRequestLookupData>(ctx);

    const senderDisplay = senderDisplayOf(lookup);
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

    // Documents/invoices ALWAYS need human preparation
    return humanApprovedProposal(ctx, 'acknowledge_document_request', {
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
    }, summary);
  }

  // -- Step 6: EXECUTE -------------------------------------------------------

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-006 EXECUTE: Processing document request acknowledgment', {
      requestId: ctx.requestId,
    });

    try {
      const ackAction = approvedAction(ctx, 'acknowledge_document_request');

      if (!ackAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No acknowledge_document_request action found in approved actions',
        };
      }

      const params = ackAction.params;

      // -- 1. Record request in audit trail --
      const requestRecord = {
        type: 'document_request',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: requesterOf(params),
        requestType: (params.requestType as string) ?? 'document',
        requestTypeLabel: (params.requestTypeLabel as string) ?? null,
        requestDescription: (params.requestDescription as string) ?? null,
        requiresManualFollowUp: true,
        channel: ctx.intake.channel,
        status: 'pending_preparation',
        ...approvalOf(ctx),
        createdAt: nowISO(),
      };

      const auditId = await recordPipelineAudit(requestRecord);

      const sideEffects = await sendRecordedReply({
        ctx,
        moduleId: 'UC-006',
        logger,
        params,
        auditId,
        defaultSubject: 'Αίτημα',
        recordedLabel: 'Request',
        recordedExtra: { requestType: params.requestType },
        recordedEffect: `document_request_recorded:${auditId}`,
        fallbackReply: (senderName) => buildDocumentRequestReply({ senderName, requestType: (params.requestType as DocumentRequestType) ?? 'document' }),
      });

      // Request recording is the primary action -- reply failure is non-fatal
      return {
        success: true,
        sideEffects,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

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
    return acknowledgeReply(ctx, 'UC-006', logger, 'Reply delivery status');
  }

  // -- Health Check ----------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    return collectionHealthCheck(COLLECTIONS.AI_PIPELINE_AUDIT, 'UC-006', logger);
  }
}
