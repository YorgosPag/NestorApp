/**
 * 🧩 Τα κοινά βήματα του πρωτοκόλλου μιας **εντολής διαχειριστή** (UC module) — ΕΝΑ σημείο.
 *
 * Πρόταση μίας αυτόματα εγκρίσιμης ενέργειας · επιλογή της εγκεκριμένης ενέργειας στην εκτέλεση ·
 * επιβεβαίωση από τις παρενέργειες. Ήταν αυτολεξεί ίδια σε 13 modules· το CHECK 3.28 τα μέτρησε ως
 * κλώνους όταν αγγίχτηκαν τα uc-015/uc-016 (ADR-195, 2026-10-29). Τα υπόλοιπα modules περνούν εδώ
 * όταν αγγιχτούν (`pending-ratchet-work.md`, μπλοκ 🧩).
 *
 * @module services/ai-pipeline/shared/admin-command-protocol
 */

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import type { AcknowledgmentResult, PipelineAction, PipelineContext, Proposal } from '@/types/ai-pipeline';

/** Πρόταση ΜΙΑΣ ενέργειας, αυτόματα εγκρίσιμης — με το κανάλι της εντολής στα `params` (για την απάντηση). */
export function autoApprovedProposal(
  ctx: PipelineContext,
  type: string,
  params: Record<string, unknown>,
  summary: string,
): Proposal {
  return {
    messageId: ctx.intake.id,
    suggestedActions: [{
      type,
      params: {
        ...params,
        channel: ctx.intake.channel,
        telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
      },
    }],
    requiredApprovals: [],
    autoApprovable: true,
    summary,
    schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
  };
}

/** Η ενέργεια που εγκρίθηκε (ή, χωρίς τροποποίηση, η προταθείσα) — `undefined` αν λείπει. */
export function approvedAction(ctx: PipelineContext, type: string): PipelineAction | undefined {
  const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
  return actions.find((a) => a.type === type);
}

/** Η επιβεβαίωση στάλθηκε αν η εκτέλεση άφησε απάντηση ή την παρενέργεια επιτυχίας της εντολής. */
export function acknowledgeBySideEffect(ctx: PipelineContext, successPrefix: string): AcknowledgmentResult {
  const sent = ctx.executionResult?.sideEffects?.some(
    (se: string) => se.startsWith('confirm_sent:') || se.startsWith(successPrefix),
  ) ?? false;
  return { sent, channel: ctx.intake.channel };
}
