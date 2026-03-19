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

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
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
    const senderEmail = ctx.intake.normalized.sender.email ?? '';
    const senderName = ctx.intake.normalized.sender.name ?? senderEmail;

    logger.info('UC-005 LOOKUP: Searching for sender contact', {
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
        logger.warn('UC-005 LOOKUP: Contact search failed (non-fatal)', {
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
      logger.warn('UC-005 LOOKUP: Sender history query failed (non-fatal)', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

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

    logger.info('UC-005 LOOKUP: Complete', {
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
    const lookup = ctx.lookupData as unknown as GeneralInquiryLookupData | undefined;

    const senderDisplay = lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
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

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'acknowledge_inquiry',
          params: {
            senderEmail: lookup?.senderEmail ?? null,
            senderName: lookup?.senderName ?? null,
            contactId: lookup?.senderContact?.contactId ?? null,
            isKnownContact: lookup?.isKnownContact ?? false,
            inquirySummary: inquirySummary || summary,
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
      autoApprovable: false, // ΚΑΝΟΝΑΣ: Catch-all ΠΑΝΤΑ ανθρώπινη έγκριση
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ─────────────────────────────────────────────────────

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-005 EXECUTE: Processing general inquiry acknowledgment', {
      requestId: ctx.requestId,
    });

    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const ackAction = actions.find(a => a.type === 'acknowledge_inquiry');

      if (!ackAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No acknowledge_inquiry action found in approved actions',
        };
      }

      const params = ackAction.params;

      // ── 1. Record inquiry in audit trail ──
      const adminDb = getAdminFirestore();
      const inquiryRecord = {
        type: 'general_inquiry',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: {
          email: (params.senderEmail as string) ?? null,
          name: (params.senderName as string) ?? null,
          contactId: (params.contactId as string) ?? null,
          isKnownContact: (params.isKnownContact as boolean) ?? false,
        },
        inquirySummary: (params.inquirySummary as string) ?? null,
        requiresManualFollowUp: true,
        channel: ctx.intake.channel,
        status: 'pending_follow_up',
        approvedBy: ctx.approval?.approvedBy ?? null,
        approvedAt: ctx.approval?.decidedAt ?? null,
        createdAt: new Date().toISOString(),
      };

      const docRef = await adminDb
        .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
        .add(inquiryRecord);

      logger.info('UC-005 EXECUTE: Inquiry recorded', {
        requestId: ctx.requestId,
        auditId: docRef.id,
      });

      // ── 2. Send reply via channel dispatcher ──
      const draftReply = (params.draftReply as string) ?? '';
      const senderEmail = (params.senderEmail as string) ?? '';
      const originalSubject = ctx.intake.normalized.subject ?? 'Αίτημα';
      const channel = ctx.intake.channel;
      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const replyResult = await sendChannelReply({
        channel,
        recipientEmail: senderEmail || undefined,
        telegramChatId: telegramChatId || undefined,
        inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
        subject: `Re: ${originalSubject}`,
        textBody: draftReply || buildGeneralInquiryReply({
          senderName: (params.senderName as string) ?? senderEmail,
        }),
        requestId: ctx.requestId,
      });

      // Build side effects list
      const sideEffects = [`inquiry_recorded:${docRef.id}`];

      if (replyResult.success) {
        sideEffects.push(`reply_sent:${replyResult.messageId ?? 'unknown'}`);
        logger.info('UC-005 EXECUTE: Reply sent', {
          requestId: ctx.requestId,
          channel: replyResult.channel,
          messageId: replyResult.messageId,
        });
      } else {
        sideEffects.push(`reply_failed:${replyResult.error ?? 'unknown'}`);
        logger.warn('UC-005 EXECUTE: Reply send failed (inquiry still recorded)', {
          requestId: ctx.requestId,
          channel: replyResult.channel,
          error: replyResult.error,
        });
      }

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
    const channel = ctx.intake.channel;

    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;

    logger.info('UC-005 ACKNOWLEDGE: Reply delivery status', {
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
      logger.error('UC-005 HEALTH CHECK: Failed', { error: msg });
      return false;
    }
  }
}
