/**
 * =============================================================================
 * UC-014: ADMIN FALLBACK MODULE — ADR-145
 * =============================================================================
 *
 * Catch-all for unrecognized admin commands.
 * Sends a helpful message listing available commands.
 *
 * IMPORTANT: This module only activates when `isAdminCommand === true`.
 * Non-admin unknown intents are handled by UC-005 (General Inquiry).
 *
 * @module services/ai-pipeline/modules/uc-014-admin-fallback
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { sendChannelReply } from '../../shared/channel-reply-dispatcher';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

const logger = createModuleLogger('UC_014_ADMIN_FALLBACK');

// ============================================================================
// CONSTANTS
// ============================================================================

const ADMIN_HELP_TEXT = [
  'Δεν κατάλαβα ακριβώς την εντολή.',
  '',
  'Δοκιμάστε:',
  '  "Βρες [όνομα]" — Αναζήτηση στοιχείων επαφής',
  '  "Δημιούργησε επαφή [όνομα], [email]" — Νέα επαφή',
  '  "Πρόσθεσε τηλέφωνο 697... στον [όνομα]" — Ενημέρωση επαφής',
  '  "Βάλε ΑΦΜ 123456789 στον [όνομα]" — Ενημέρωση ΑΦΜ',
  '  "Τι γίνεται με [έργο];" — Κατάσταση έργου',
  '  "Στείλε email στον [όνομα] ότι..." — Αποστολή email',
  '  "Πόσα ακίνητα έχουμε;" — Στατιστικά units',
].join('\n');

// ============================================================================
// MODULE
// ============================================================================

export class AdminFallbackModule implements IUCModule {
  readonly moduleId = 'UC-014';
  readonly displayName = 'Admin: Fallback';

  /**
   * This module does NOT register for any intent globally.
   * It is invoked explicitly by the orchestrator when:
   * - isAdminCommand === true AND no other admin module matches
   *
   * See the custom routing logic in the pipeline worker.
   */
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(_ctx: PipelineContext): Promise<Record<string, unknown>> {
    return {};
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_fallback_reply',
          params: {
            helpText: ADMIN_HELP_TEXT,
            channel: ctx.intake.channel,
            telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
          },
        },
      ],
      requiredApprovals: [],
      autoApprovable: true,
      summary: 'Admin: Εντολή δεν αναγνωρίστηκε — αποστολή βοηθητικού μηνύματος',
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ──

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const action = actions.find(a => a.type === 'admin_fallback_reply');
      const helpText = (action?.params.helpText as string) ?? ADMIN_HELP_TEXT;

      const telegramChatId = (action?.params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        subject: 'Admin Assistant',
        textBody: helpText,
        requestId: ctx.requestId,
      });

      return {
        success: true,
        sideEffects: replyResult.success
          ? [`reply_sent:${replyResult.messageId ?? 'unknown'}`]
          : [`reply_failed:${replyResult.error ?? 'unknown'}`],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('UC-014 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;
    return { sent: replySent, channel: ctx.intake.channel };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
