/**
 * =============================================================================
 * 🏢 ENTERPRISE: UC-005 GENERAL INQUIRY MODULE (CATCH-ALL)
 * =============================================================================
 *
 * Safety net module — handles `general_inquiry`, `status_inquiry`, and `unknown`
 * intents. Ensures every inbound message gets at least a polite acknowledgment
 * instead of falling into silent manual triage.
 *
 * Pipeline steps implemented:
 *   Step 3 LOOKUP      → Find sender contact + query sender history
 *   Step 4 PROPOSE     → Generate polite acknowledgment for operator review
 *   Step 6 EXECUTE     → Record inquiry in audit trail + send reply via channel dispatcher
 *   Step 7 ACKNOWLEDGE → Verify reply delivery status
 *
 * RULES:
 * - NEVER auto-approved — catch-all = always human review
 * - Reply tone: warm, professional, brief
 * - Always flags requiresManualFollowUp: true
 *
 * @module services/ai-pipeline/modules/uc-005-general-inquiry
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
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

const logger = createModuleLogger('UC_005_GENERAL_INQUIRY');

// ============================================================================
// LOOKUP TYPES
// ============================================================================

interface GeneralInquiryLookupData {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
  isKnownContact: boolean;
  originalSubject: string;
  inquirySummary: string;
  companyId: string;
  senderHistory: SenderHistoryResult | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a static fallback reply for general inquiry acknowledgment.
 * Used when AI generation fails.
 */
function buildGeneralInquiryReply(params: {
  senderName: string;
}): string {
  return [
    `Αγαπητέ/ή ${params.senderName},`,
    '',
    'Σας ευχαριστούμε για την επικοινωνία σας.',
    '',
    'Λάβαμε το μήνυμά σας και θα το εξετάσουμε σύντομα. Κάποιος από την ομάδα μας θα επικοινωνήσει μαζί σας το συντομότερο δυνατό.',
    '',
    'Παραμένουμε στη διάθεσή σας.',
    '',
    'Με εκτίμηση,',
  ].join('\n');
}

// ============================================================================
// UC-005 MODULE
// ============================================================================

export class GeneralInquiryModule implements IUCModule {
  readonly moduleId = 'UC-005';
  readonly displayName = 'Γενικό Αίτημα';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.GENERAL_INQUIRY,
    PipelineIntentType.STATUS_INQUIRY,
    PipelineIntentType.UNKNOWN,
  ];
  readonly requiredRoles: readonly string[] = ['salesManager'];

  // ── Step 3: LOOKUP ──────────────────────────────────────────────────────

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const { senderEmail, senderName, senderContact } = await lookupSender(ctx, 'UC-005', logger);

    const senderHistory = await querySenderHistory(ctx, 'UC-005', logger, senderEmail);

    const inquirySummary = ctx.intake.normalized.contentText?.slice(0, 500)
      ?? ctx.intake.normalized.subject
      ?? '';

    const lookupData: GeneralInquiryLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      originalSubject: ctx.intake.normalized.subject ?? '',
      inquirySummary,
      companyId: ctx.companyId,
      senderHistory,
    };

    logLookupComplete(ctx, 'UC-005', logger, { senderContact, senderHistory });

    return toLookupRecord(lookupData);
  }

  // ── Step 4: PROPOSE ─────────────────────────────────────────────────────

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = lookupOf<GeneralInquiryLookupData>(ctx);

    const senderDisplay = senderDisplayOf(lookup);
    const inquirySummary = lookup?.inquirySummary
      || ctx.intake.normalized.contentText?.slice(0, 300)
      || '';

    const summary = `Γενικό αίτημα από ${senderDisplay}: ${inquirySummary.slice(0, 100)}`;

    // Generate dynamic AI reply
    const aiReplyResult = await generateAIReply(
      {
        useCase: 'general_inquiry',
        senderName: senderDisplay,
        isKnownContact: lookup?.isKnownContact ?? false,
        originalMessage: ctx.intake.normalized.contentText?.slice(0, 1000) ?? '',
        originalSubject: lookup?.originalSubject ?? '',
        moduleContext: {
          inquirySummary: inquirySummary || null,
        },
        senderHistory: lookup?.senderHistory?.recentEmails,
        isReturningContact: lookup?.senderHistory?.isReturningContact,
      },
      () => buildGeneralInquiryReply({
        senderName: senderDisplay,
      }),
      ctx.requestId,
    );

    const draftReply = aiReplyResult.replyText;

    logger.info('UC-005 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      summary: summary.slice(0, 200),
      aiGenerated: aiReplyResult.aiGenerated,
      aiDurationMs: aiReplyResult.durationMs,
    });

    // ΚΑΝΟΝΑΣ: Catch-all ΠΑΝΤΑ ανθρώπινη έγκριση
    return humanApprovedProposal(ctx, 'acknowledge_inquiry', {
      senderEmail: lookup?.senderEmail ?? null,
      senderName: lookup?.senderName ?? null,
      contactId: lookup?.senderContact?.contactId ?? null,
      isKnownContact: lookup?.isKnownContact ?? false,
      inquirySummary: inquirySummary || summary,
      companyId: ctx.companyId,
      draftReply,
      aiGenerated: aiReplyResult.aiGenerated,
      requiresManualFollowUp: true,
    }, summary);
  }

  // ── Step 6: EXECUTE ─────────────────────────────────────────────────────

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-005 EXECUTE: Processing general inquiry acknowledgment', {
      requestId: ctx.requestId,
    });

    try {
      const ackAction = approvedAction(ctx, 'acknowledge_inquiry');

      if (!ackAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No acknowledge_inquiry action found in approved actions',
        };
      }

      const params = ackAction.params;

      // ── 1. Record inquiry in audit trail ──
      const inquiryRecord = {
        type: 'general_inquiry',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: requesterOf(params),
        inquirySummary: (params.inquirySummary as string) ?? null,
        requiresManualFollowUp: true,
        channel: ctx.intake.channel,
        status: 'pending_follow_up',
        ...approvalOf(ctx),
        createdAt: nowISO(),
      };

      const auditId = await recordPipelineAudit(inquiryRecord);

      const sideEffects = await sendRecordedReply({
        ctx,
        moduleId: 'UC-005',
        logger,
        params,
        auditId,
        defaultSubject: 'Αίτημα',
        recordedLabel: 'Inquiry',
        recordedEffect: `inquiry_recorded:${auditId}`,
        fallbackReply: (senderName) => buildGeneralInquiryReply({ senderName }),
      });

      // Inquiry recording is the primary action — reply failure is non-fatal
      return {
        success: true,
        sideEffects,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      logger.error('UC-005 EXECUTE: Failed', {
        requestId: ctx.requestId,
        error: errorMessage,
      });

      return {
        success: false,
        sideEffects: [],
        error: `Failed to process general inquiry: ${errorMessage}`,
      };
    }
  }

  // ── Step 7: ACKNOWLEDGE ─────────────────────────────────────────────────

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    return acknowledgeReply(ctx, 'UC-005', logger, 'Reply delivery status');
  }

  // ── Health Check ────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    return collectionHealthCheck(COLLECTIONS.AI_PIPELINE_AUDIT, 'UC-005', logger);
  }
}
