/**
 * =============================================================================
 * 🏢 ENTERPRISE: UC-004 COMPLAINT / DEFECT REPORT MODULE
 * =============================================================================
 *
 * Handles `complaint` and `defect_report` intents — customers reporting
 * issues, complaints, or defects about service, quality, or construction.
 *
 * Pipeline steps implemented:
 *   Step 3 LOOKUP      → Find sender contact + query sender history
 *   Step 4 PROPOSE     → Generate empathetic acknowledgment reply for operator review
 *   Step 6 EXECUTE     → Record complaint in audit trail + send reply via channel dispatcher
 *   Step 7 ACKNOWLEDGE → Verify reply delivery status
 *
 * RULES:
 * - NEVER auto-approved — always requires human review (salesManager)
 * - Reply tone: empathetic, professional, no excuses
 * - Complaint is recorded for tracking and follow-up
 *
 * @module services/ai-pipeline/modules/uc-004-complaint
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

const logger = createModuleLogger('UC_004_COMPLAINT');

// ============================================================================
// LOOKUP TYPES
// ============================================================================

interface ComplaintLookupData {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
  isKnownContact: boolean;
  originalSubject: string;
  complaintDescription: string;
  companyId: string;
  senderHistory: SenderHistoryResult | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a static fallback reply for complaint acknowledgment.
 * Used when AI generation fails.
 */
function buildComplaintReply(params: {
  senderName: string;
  description: string;
}): string {
  const { senderName, description } = params;

  const lines = [
    `Αγαπητέ/ή ${senderName},`,
    '',
    'Σας ευχαριστούμε που μας ενημερώσατε.',
    '',
    'Λάβαμε την αναφορά σας και κατανοούμε τη δυσαρέσκειά σας. Θα εξετάσουμε το θέμα με προτεραιότητα και θα επικοινωνήσουμε μαζί σας σύντομα.',
    '',
  ];

  if (description && description.length > 20) {
    lines.push(`Θέμα αναφοράς: ${description.slice(0, 200)}`, '');
  }

  lines.push(
    'Παραμένουμε στη διάθεσή σας για οποιαδήποτε διευκρίνιση.',
    '',
    'Με εκτίμηση,',
  );

  return lines.join('\n');
}

// ============================================================================
// UC-004 MODULE
// ============================================================================

export class ComplaintModule implements IUCModule {
  readonly moduleId = 'UC-004';
  readonly displayName = 'Αναφορά Παραπόνου/Βλάβης';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.COMPLAINT,
    PipelineIntentType.DEFECT_REPORT,
  ];
  readonly requiredRoles: readonly string[] = ['salesManager'];

  // ── Step 3: LOOKUP ──────────────────────────────────────────────────────

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const { senderEmail, senderName, senderContact } = await lookupSender(ctx, 'UC-004', logger);

    const senderHistory = await querySenderHistory(ctx, 'UC-004', logger, senderEmail);

    const complaintDescription = ctx.intake.normalized.contentText?.slice(0, 500)
      ?? ctx.intake.normalized.subject
      ?? '';

    const lookupData: ComplaintLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      originalSubject: ctx.intake.normalized.subject ?? '',
      complaintDescription,
      companyId: ctx.companyId,
      senderHistory,
    };

    logLookupComplete(ctx, 'UC-004', logger, { senderContact, senderHistory });

    return toLookupRecord(lookupData);
  }

  // ── Step 4: PROPOSE ─────────────────────────────────────────────────────

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = lookupOf<ComplaintLookupData>(ctx);

    const senderDisplay = senderDisplayOf(lookup);
    const description = lookup?.complaintDescription
      || ctx.intake.normalized.contentText?.slice(0, 500)
      || '';

    const summary = `Παράπονο/Βλάβη από ${senderDisplay}: ${description.slice(0, 100)}`;

    // Generate dynamic AI reply (falls back to static template on failure)
    const aiReplyResult = await generateAIReply(
      {
        useCase: 'complaint',
        senderName: senderDisplay,
        isKnownContact: lookup?.isKnownContact ?? false,
        originalMessage: ctx.intake.normalized.contentText?.slice(0, 1000) ?? '',
        originalSubject: lookup?.originalSubject ?? '',
        moduleContext: {
          complaintDescription: description || null,
        },
        senderHistory: lookup?.senderHistory?.recentEmails,
        isReturningContact: lookup?.senderHistory?.isReturningContact,
      },
      () => buildComplaintReply({
        senderName: senderDisplay,
        description,
      }),
      ctx.requestId,
    );

    const draftReply = aiReplyResult.replyText;

    logger.info('UC-004 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      summary: summary.slice(0, 200),
      aiGenerated: aiReplyResult.aiGenerated,
      aiDurationMs: aiReplyResult.durationMs,
    });

    // ΚΑΝΟΝΑΣ: Παράπονα ΠΑΝΤΑ ανθρώπινη έγκριση
    return humanApprovedProposal(ctx, 'acknowledge_complaint', {
      senderEmail: lookup?.senderEmail ?? null,
      senderName: lookup?.senderName ?? null,
      contactId: lookup?.senderContact?.contactId ?? null,
      isKnownContact: lookup?.isKnownContact ?? false,
      complaintDescription: description || summary,
      companyId: ctx.companyId,
      draftReply,
      aiGenerated: aiReplyResult.aiGenerated,
    }, summary);
  }

  // ── Step 6: EXECUTE ─────────────────────────────────────────────────────

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-004 EXECUTE: Processing complaint acknowledgment', {
      requestId: ctx.requestId,
    });

    try {
      const ackAction = approvedAction(ctx, 'acknowledge_complaint');

      if (!ackAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No acknowledge_complaint action found in approved actions',
        };
      }

      const params = ackAction.params;

      // ── 1. Record complaint in audit trail ──
      const complaintRecord = {
        type: 'complaint',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: requesterOf(params),
        complaintDescription: (params.complaintDescription as string) ?? null,
        channel: ctx.intake.channel,
        status: 'pending_review',
        ...approvalOf(ctx),
        createdAt: nowISO(),
      };

      const auditId = await recordPipelineAudit(complaintRecord);

      const sideEffects = await sendRecordedReply({
        ctx,
        moduleId: 'UC-004',
        logger,
        params,
        auditId,
        defaultSubject: 'Αναφορά',
        recordedLabel: 'Complaint',
        recordedEffect: `complaint_recorded:${auditId}`,
        fallbackReply: (senderName) => buildComplaintReply({ senderName, description: (params.complaintDescription as string) ?? '' }),
      });

      // Complaint recording is the primary action — reply failure is non-fatal
      return {
        success: true,
        sideEffects,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      logger.error('UC-004 EXECUTE: Failed', {
        requestId: ctx.requestId,
        error: errorMessage,
      });

      return {
        success: false,
        sideEffects: [],
        error: `Failed to process complaint: ${errorMessage}`,
      };
    }
  }

  // ── Step 7: ACKNOWLEDGE ─────────────────────────────────────────────────

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    return acknowledgeReply(ctx, 'UC-004', logger, 'Reply delivery status');
  }

  // ── Health Check ────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    return collectionHealthCheck(COLLECTIONS.AI_PIPELINE_AUDIT, 'UC-004', logger);
  }
}
