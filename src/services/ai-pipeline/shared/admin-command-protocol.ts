/**
 * 🧩 Τα κοινά βήματα του πρωτοκόλλου ενός **UC module** — εντολής διαχειριστή **ή** αιτήματος πελάτη — ΕΝΑ σημείο.
 *
 * Πρόταση μίας ενέργειας · επιλογή της εγκεκριμένης ενέργειας στην εκτέλεση · επιβεβαίωση από τις παρενέργειες.
 * Ήταν αυτολεξεί ίδια σε 13 modules· το CHECK 3.28 τα μέτρησε ως κλώνους όταν αγγίχτηκαν τα uc-015/uc-016
 * (ADR-195, 2026-10-29) και τα 11 υπόλοιπα πέρασαν εδώ 2026-10-30.
 *
 * 🔑 Η **πολιτική έγκρισης** είναι η μόνη πραγματική διαφορά, και δηλώνεται στο όνομα της κλήσης:
 * εντολή διαχειριστή ⇒ {@link autoApprovedProposal}· αίτημα πελάτη ⇒ {@link humanApprovedProposal} (ΠΟΤΕ αυτόματο).
 * Η άγκυρα `shared/__tests__/admin-command-protocol.test.ts` (Π5) κρατά κάθε module πάνω σε αυτά.
 *
 * @module services/ai-pipeline/shared/admin-command-protocol
 */

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { getErrorMessage } from '@/lib/error-utils';
import type { Logger } from '@/lib/telemetry/Logger';
import type {
  AcknowledgmentResult, ExecutionResult, PipelineAction, PipelineContext, Proposal,
} from '@/types/ai-pipeline';
import { extractChannelIds, sendChannelReply } from './channel-reply-dispatcher';

/** Ο ρόλος που εγκρίνει κάθε απάντηση σε πελάτη — ΕΝΑ σημείο (ήταν γραμμένος σε 5 modules). */
export const SALES_MANAGER_APPROVAL: readonly string[] = ['salesManager'];

interface ApprovalPolicy {
  readonly requiredApprovals: readonly string[];
  readonly autoApprovable: boolean;
}

/** Πρόταση ΜΙΑΣ ενέργειας — με το κανάλι της εντολής στα `params` (για την απάντηση). */
function singleActionProposal(
  ctx: PipelineContext,
  type: string,
  params: Record<string, unknown>,
  summary: string,
  policy: ApprovalPolicy,
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
    requiredApprovals: [...policy.requiredApprovals],
    autoApprovable: policy.autoApprovable,
    summary,
    schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
  };
}

/** Εντολή διαχειριστή: πρόταση ΜΙΑΣ ενέργειας, αυτόματα εγκρίσιμης. */
export function autoApprovedProposal(
  ctx: PipelineContext,
  type: string,
  params: Record<string, unknown>,
  summary: string,
): Proposal {
  return singleActionProposal(ctx, type, params, summary, { requiredApprovals: [], autoApprovable: true });
}

/** Αίτημα πελάτη: πρόταση ΜΙΑΣ ενέργειας που περιμένει **ανθρώπινη** έγκριση — ΠΟΤΕ αυτόματη. */
export function humanApprovedProposal(
  ctx: PipelineContext,
  type: string,
  params: Record<string, unknown>,
  summary: string,
): Proposal {
  return singleActionProposal(ctx, type, params, summary, {
    requiredApprovals: SALES_MANAGER_APPROVAL,
    autoApprovable: false,
  });
}

/**
 * Τροποποίησε ο χειριστής την πρόταση; **Μόνο** μη κενή λίστα είναι τροποποίηση — ο ίδιος ορισμός με το inbox
 * (`operator-inbox-service`: `decision = 'modified'` μόνο αν `length > 0`). Πριν (2026-10-30) η εκτέλεση έλεγε
 * `modifiedActions ?? suggested`: ένα `[]` (που ο route δέχεται) καταγραφόταν «εγκρίθηκε όπως προτάθηκε» αλλά
 * εκτελούσε **καμία** ενέργεια.
 */
export function hasModifiedActions(ctx: PipelineContext): boolean {
  return (ctx.approval?.modifiedActions?.length ?? 0) > 0;
}

/** Οι ενέργειες που εγκρίθηκαν — οι τροποποιημένες, αλλιώς οι προταθείσες. */
export function approvedActions(ctx: PipelineContext): PipelineAction[] {
  const modified = ctx.approval?.modifiedActions;
  return modified && modified.length > 0 ? modified : ctx.proposal?.suggestedActions ?? [];
}

/** Η ενέργεια που εγκρίθηκε (ή, χωρίς τροποποίηση, η προταθείσα) — `undefined` αν λείπει. */
export function approvedAction(ctx: PipelineContext, type: string): PipelineAction | undefined {
  return approvedActions(ctx).find((a) => a.type === type);
}

/** Η επιβεβαίωση στάλθηκε αν η εκτέλεση άφησε απάντηση ή την παρενέργεια επιτυχίας της εντολής. */
export function acknowledgeBySideEffect(ctx: PipelineContext, successPrefix: string): AcknowledgmentResult {
  const sent = ctx.executionResult?.sideEffects?.some(
    (se: string) => se.startsWith('confirm_sent:') || se.startsWith(successPrefix),
  ) ?? false;
  return { sent, channel: ctx.intake.channel };
}

/** Το ΕΝΑ λεξιλόγιο της παρενέργειας μιας απάντησης — `reply_sent:<id>` ή `reply_failed:<λόγος>` (το διαβάζει η επιβεβαίωση). */
export function replySideEffect(result: { readonly success: boolean; readonly messageId?: string; readonly error?: string }): string {
  return result.success ? `reply_sent:${result.messageId ?? 'unknown'}` : `reply_failed:${result.error ?? 'unknown'}`;
}

/** Εντολή διαχειριστή: η απάντηση στο κανάλι της εντολής· οι `priorEffects` (π.χ. AI) προηγούνται. */
export async function sendCommandReply(
  ctx: PipelineContext,
  subject: string,
  textBody: string,
  priorEffects: readonly string[] = [],
): Promise<ExecutionResult> {
  const replyResult = await sendChannelReply({
    channel: ctx.intake.channel,
    ...extractChannelIds(ctx),
    subject,
    textBody,
    requestId: ctx.requestId,
  });
  return { success: true, sideEffects: [...priorEffects, replySideEffect(replyResult)] };
}

/** Το execute απέτυχε: καταγραφή στο κανάλι του module + αποτέλεσμα αποτυχίας χωρίς παρενέργειες. */
export function failedExecution(ctx: PipelineContext, moduleId: string, logger: Logger, error: unknown): ExecutionResult {
  const message = getErrorMessage(error);
  logger.error(`${moduleId} EXECUTE: Failed`, { requestId: ctx.requestId, error: message });
  return { success: false, sideEffects: [], error: message };
}
