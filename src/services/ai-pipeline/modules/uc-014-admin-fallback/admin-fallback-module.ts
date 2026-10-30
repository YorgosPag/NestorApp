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

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { generateAdminConversationalReply } from '../../shared/ai-reply-generator';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';
import { acknowledgeBySideEffect, approvedAction, autoApprovedProposal, failedExecution, sendCommandReply } from '../../shared/admin-command-protocol';

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
  '  "Δείξε μου τα έργα" — Λίστα όλων των έργων',
  '  "Ποια έργα έχουν gantt;" — Αναζήτηση με κριτήριο',
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
    return autoApprovedProposal(ctx, 'admin_fallback_reply', {
      helpText: ADMIN_HELP_TEXT,
    }, 'Admin: Εντολή δεν αναγνωρίστηκε — αποστολή βοηθητικού μηνύματος');
  }

  // ── Step 6: EXECUTE ──

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    try {
      const action = approvedAction(ctx, 'admin_fallback_reply');

      // ── Conversational AI: check pre-generated reply from tool calling first ──
      const originalMessage = ctx.intake.normalized.contentText ?? '';
      let replyText = ADMIN_HELP_TEXT;
      const sideEffects: string[] = [];

      // Tool calling: AI already generated a conversational reply (no 2nd API call needed)
      const preGeneratedReply = (ctx.understanding?.entities?.conversationalReply as string) ?? null;

      if (preGeneratedReply) {
        replyText = preGeneratedReply;
        sideEffects.push('ai_conversational_pregenerated');
      } else if (originalMessage.length > 0) {
        // Fallback: generate via separate OpenAI call
        const aiResult = await generateAdminConversationalReply(originalMessage, ctx.requestId);
        if (aiResult.replyText) {
          replyText = aiResult.replyText;
          sideEffects.push(`ai_conversational:${aiResult.durationMs}ms`);
        } else {
          sideEffects.push('ai_conversational_fallback');
        }
      }

      return await sendCommandReply(ctx, 'Admin Assistant', replyText, sideEffects);
    } catch (error) {
      return failedExecution(ctx, 'UC-014', logger, error);
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    return acknowledgeBySideEffect(ctx, 'reply_sent:');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
