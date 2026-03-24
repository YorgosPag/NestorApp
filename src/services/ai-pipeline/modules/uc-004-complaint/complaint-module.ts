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

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generatePipelineAuditId } from '@/services/enterprise-id.service';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { findContactByEmail, type ContactMatch } from '../../shared/contact-lookup';
import { getSenderHistory, type SenderHistoryResult } from '../../shared/sender-history';
import { generateAIReply } from '../../shared/ai-reply-generator';
import { sendChannelReply, extractChannelIds } from '../../shared/channel-reply-dispatcher';
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
    const senderEmail = ctx.intake.normalized.sender.email ?? '';
    const senderName = ctx.intake.normalized.sender.name ?? senderEmail;

    logger.info('UC-004 LOOKUP: Searching for sender contact', {
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
        const msg = getErrorMessage(error);
        logger.warn('UC-004 LOOKUP: Contact search failed (non-fatal)', {
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
      const msg = getErrorMessage(error);
      logger.warn('UC-004 LOOKUP: Sender history query failed (non-fatal)', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

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

    logger.info('UC-004 LOOKUP: Complete', {
      requestId: ctx.requestId,
      isKnownContact: lookupData.isKnownContact,
      contactId: senderContact?.contactId,
      isReturningContact: senderHistory?.isReturningContact,
      previousEmails: senderHistory?.totalPreviousEmails,
    });

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ─────────────────────────────────────────────────────

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as ComplaintLookupData | undefined;

    const senderDisplay = lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
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

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'acknowledge_complaint',
          params: {
            senderEmail: lookup?.senderEmail ?? null,
            senderName: lookup?.senderName ?? null,
            contactId: lookup?.senderContact?.contactId ?? null,
            isKnownContact: lookup?.isKnownContact ?? false,
            complaintDescription: description || summary,
            companyId: ctx.companyId,
            draftReply,
            aiGenerated: aiReplyResult.aiGenerated,
            channel: ctx.intake.channel,
            telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
          },
        },
      ],
      requiredApprovals: ['salesManager'],
      autoApprovable: false, // ΚΑΝΟΝΑΣ: Παράπονα ΠΑΝΤΑ ανθρώπινη έγκριση
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ─────────────────────────────────────────────────────

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-004 EXECUTE: Processing complaint acknowledgment', {
      requestId: ctx.requestId,
    });

    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const ackAction = actions.find(a => a.type === 'acknowledge_complaint');

      if (!ackAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No acknowledge_complaint action found in approved actions',
        };
      }

      const params = ackAction.params;

      // ── 1. Record complaint in audit trail ──
      const adminDb = getAdminFirestore();
      const complaintRecord = {
        type: 'complaint',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: {
          email: (params.senderEmail as string) ?? null,
          name: (params.senderName as string) ?? null,
          contactId: (params.contactId as string) ?? null,
          isKnownContact: (params.isKnownContact as boolean) ?? false,
        },
        complaintDescription: (params.complaintDescription as string) ?? null,
        channel: ctx.intake.channel,
        status: 'pending_review',
        approvedBy: ctx.approval?.approvedBy ?? null,
        approvedAt: ctx.approval?.decidedAt ?? null,
        createdAt: new Date().toISOString(),
      };

      const auditId = generatePipelineAuditId();
      await adminDb
        .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
        .doc(auditId)
        .set(complaintRecord);

      logger.info('UC-004 EXECUTE: Complaint recorded', {
        requestId: ctx.requestId,
        auditId,
      });

      // ── 2. Send reply via channel dispatcher ──
      const draftReply = (params.draftReply as string) ?? '';
      const senderEmail = (params.senderEmail as string) ?? '';
      const originalSubject = ctx.intake.normalized.subject ?? 'Αναφορά';

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
        subject: `Re: ${originalSubject}`,
        textBody: draftReply || buildComplaintReply({
          senderName: (params.senderName as string) ?? senderEmail,
          description: (params.complaintDescription as string) ?? '',
        }),
        requestId: ctx.requestId,
      });

      // Build side effects list
      const sideEffects = [`complaint_recorded:${auditId}`];

      if (replyResult.success) {
        sideEffects.push(`reply_sent:${replyResult.messageId ?? 'unknown'}`);
        logger.info('UC-004 EXECUTE: Reply sent', {
          requestId: ctx.requestId,
          channel: replyResult.channel,
          messageId: replyResult.messageId,
        });
      } else {
        sideEffects.push(`reply_failed:${replyResult.error ?? 'unknown'}`);
        logger.warn('UC-004 EXECUTE: Reply send failed (complaint still recorded)', {
          requestId: ctx.requestId,
          channel: replyResult.channel,
          error: replyResult.error,
        });
      }

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
    const channel = ctx.intake.channel;

    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;

    logger.info('UC-004 ACKNOWLEDGE: Reply delivery status', {
      requestId: ctx.requestId,
      channel,
      replySent,
    });

    return {
      sent: replySent,
      channel,
    };
  }

  // ── Health Check ────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const adminDb = getAdminFirestore();
      await adminDb.collection(COLLECTIONS.AI_PIPELINE_AUDIT).limit(1).get();
      return true;
    } catch (error) {
      const msg = getErrorMessage(error);
      logger.error('UC-004 HEALTH CHECK: Failed', { error: msg });
      return false;
    }
  }
}
