/**
 * =============================================================================
 * AGENTIC PATH EXECUTOR (ADR-171)
 * =============================================================================
 *
 * Executes the autonomous AI agent path for admin commands and messaging
 * channel conversations. Uses multi-step tool calling instead of hardcoded
 * UC modules.
 *
 * Extracted from pipeline-orchestrator.ts for SRP compliance (N.7.1).
 *
 * @module services/ai-pipeline/agentic-path-executor
 * @see ADR-171 (Autonomous AI Agent)
 * @see ADR-174 (Multi-Channel Agentic)
 * @see ADR-259A (AI Usage Tracking + Cost Protection)
 */

import type { PipelineContext, PipelineStateValue } from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';
import type { PipelineAuditService } from './audit-service';
import type { PipelineExecutionResult } from './pipeline-types';
// ===== TOGGLE: Vercel AI SDK vs Legacy Agentic Loop =========================
// Για να γυρίσεις στο ΠΑΛΙΟ σύστημα (rollback):
//   1. Uncomment τις 2 γραμμές LEGACY παρακάτω
//   2. Comment/delete τις 2 γραμμές ACTIVE
// LEGACY: import { executeAgenticLoop } from './agentic-loop';
// LEGACY: import type { ChatMessage } from './agentic-loop';
// ACTIVE (Vercel AI SDK — 2026-03-29):
import { executeAgenticLoop } from './vercel-ai-engine';
import type { ChatMessage } from './vercel-ai-engine';
// ===== END TOGGLE ============================================================
import { getChatHistoryService } from './chat-history-service';
import { AGENTIC_TOOL_DEFINITIONS } from './tools/agentic-tool-definitions';
import type { AgenticContext } from './tools/agentic-tool-executor';
import { sendChannelReply, extractChannelIds } from './shared/channel-reply-dispatcher';
import { AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { checkDailyCap, recordUsage } from './ai-usage.service';
import { sendPostReplyActions } from './post-reply-actions';
import { extractAttachments } from './tools/executor-shared';
import { enrichWithDocumentPreview } from './agentic-reply-utils';
import type { DocumentPreviewData } from './agentic-reply-utils';
import {
  downloadAndValidateFile,
  previewDocumentFromBuffer,
  isVisionSupportedMime,
  MAX_PREVIEWS_PER_MESSAGE,
} from './document-preview-service';
import { extractInvoiceEntitiesFromHistory } from './invoice-auto-enrichment';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const agenticLogger = createModuleLogger('AGENTIC_PATH');

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticPathDeps {
  auditService: PipelineAuditService;
  transitionState: (ctx: PipelineContext, to: PipelineStateValue) => PipelineContext;
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute the agentic path for admin commands and messaging channels.
 * Uses multi-step tool calling instead of hardcoded UC modules.
 *
 * Flow:
 * 1. Fetch chat history for context
 * 2. Build agentic context (companyId, permissions)
 * 3. Execute agentic loop (AI + tools iteratively)
 * 4. Save messages to chat history
 * 5. Send reply via channel dispatcher
 * 6. Post-reply actions (CRM, keyboards, feedback)
 * 7. Audit the execution
 */
export async function executeAgenticPath(
  ctx: PipelineContext,
  deps: AgenticPathDeps
): Promise<PipelineExecutionResult> {
  const { auditService, transitionState } = deps;
  const chatHistoryService = getChatHistoryService();

  try {
    const channelSenderId = buildChannelSenderId(ctx);
    const userMessage = ctx.intake.normalized.contentText || ctx.intake.normalized.subject || '';

    // 1. Fetch chat history (filter out failed responses to prevent AI from giving up)
    const rawHistory: ChatMessage[] = await chatHistoryService.getRecentHistory(channelSenderId);
    const history = rawHistory.filter(msg => {
      if (msg.role !== 'assistant') return true;
      const failurePatterns = [
        '\u03C4\u03B5\u03C7\u03BD\u03B9\u03BA\u03AC \u03C0\u03C1\u03BF\u03B2\u03BB\u03AE\u03BC\u03B1\u03C4\u03B1',
        '\u039E\u03B5\u03C0\u03AD\u03C1\u03B1\u03C3\u03B1 \u03C4\u03BF \u03BC\u03AD\u03B3\u03B9\u03C3\u03C4\u03BF',
        '\u03B1\u03BD\u03C4\u03B9\u03BC\u03B5\u03C4\u03CE\u03C0\u03B9\u03C3\u03B1 \u03AD\u03BD\u03B1 \u03C0\u03C1\u03CC\u03B2\u03BB\u03B7\u03BC\u03B1',
        '\u03C0\u03BF\u03BB\u03CD \u03C7\u03C1\u03CC\u03BD\u03BF',
      ];
      return !failurePatterns.some(p => msg.content.includes(p));
    });

    // 2. Build agentic context (RBAC: proper isAdmin from adminCommandMeta)
    const agenticCtx: AgenticContext = {
      companyId: ctx.companyId,
      isAdmin: ctx.adminCommandMeta?.isAdminCommand === true,
      channel: ctx.intake.channel,
      channelSenderId,
      requestId: ctx.requestId,
      telegramChatId: ctx.intake.normalized.sender.telegramId
        ?? ctx.intake.rawPayload?.chatId as string
        ?? undefined,
      contactMeta: ctx.contactMeta ?? null,
      attachments: extractAttachments(ctx.intake.normalized.attachments),
    };

    // 2b. ADR-259A: Daily cap check (customers only — admin unlimited)
    if (!agenticCtx.isAdmin) {
      const capCheck = await checkDailyCap(channelSenderId, ctx.intake.channel);
      if (!capCheck.allowed) {
        agenticLogger.info('Daily cap exceeded', {
          requestId: ctx.requestId,
          channelSenderId,
          used: capCheck.used,
          limit: capCheck.limit,
        });
        await sendChannelReply({
          ...extractChannelIds(ctx),
          channel: ctx.intake.channel,
          textBody: `\u039E\u03B5\u03C0\u03B5\u03C1\u03AC\u03C3\u03B1\u03C4\u03B5 \u03C4\u03BF \u03B7\u03BC\u03B5\u03C1\u03AE\u03C3\u03B9\u03BF \u03CC\u03C1\u03B9\u03BF \u03BC\u03B7\u03BD\u03C5\u03BC\u03AC\u03C4\u03C9\u03BD (${capCheck.limit}). \u0394\u03BF\u03BA\u03B9\u03BC\u03AC\u03C3\u03C4\u03B5 \u03BE\u03B1\u03BD\u03AC \u03B1\u03CD\u03C1\u03B9\u03BF.`,
          requestId: ctx.requestId,
        });
        ctx = transitionState(ctx, PipelineState.UNDERSTOOD);
        ctx = transitionState(ctx, PipelineState.AUDITED);
        await auditService.record(ctx, 'auto_processed', 'ADR-259A-daily-cap');
        return {
          success: true,
          requestId: ctx.requestId,
          finalState: ctx.state,
          context: ctx,
        };
      }
    }

    // 2c. ADR-259C: Empty linkedUnitIds early-exit (customers only)
    if (!agenticCtx.isAdmin && agenticCtx.contactMeta?.linkedUnitIds?.length === 0) {
      agenticLogger.info('No linked units — early exit', {
        requestId: ctx.requestId,
        channelSenderId,
        contactId: agenticCtx.contactMeta?.contactId ?? 'unknown',
      });

      const channelIds = extractChannelIds(ctx);
      if (channelIds.telegramChatId) {
        const { sendTelegramMessage } = await import(
          '@/app/api/communications/webhooks/telegram/telegram/client'
        );
        const { createNoLinkedUnitsResponse } = await import(
          '@/app/api/communications/webhooks/telegram/message/responses'
        );
        await sendTelegramMessage(createNoLinkedUnitsResponse(Number(channelIds.telegramChatId)));
      }

      ctx = transitionState(ctx, PipelineState.UNDERSTOOD);
      ctx = transitionState(ctx, PipelineState.AUDITED);
      await auditService.record(ctx, 'auto_processed', 'ADR-259C-no-linked-units');
      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
      };
    }

    // 2d. ADR-264 + ADR-265: Document Preview + Vision-in-the-Loop
    const previewResult = await handleDocumentPreviewIfNeeded(
      userMessage,
      agenticCtx.attachments
    );
    const enrichedMessage = previewResult.previews.length > 0
      ? enrichWithDocumentPreview(userMessage, previewResult.previews)
      : userMessage;

    // 2e. ADR-265: Pass document images to agentic loop (AI sees actual document)
    if (previewResult.documentImages.length > 0) {
      agenticCtx.documentImages = previewResult.documentImages;
    }

    // 2e2. File-only detection: user sent document without text command.
    // Guardrail A (write-claim without tools) should NOT fire — describing a document IS correct behavior.
    const isFileOnly = previewResult.previews.length > 0 && !userMessage.trim();
    if (isFileOnly) {
      agenticCtx.isDocumentPreviewOnly = true;
    }

    // 2f. Auto-enrichment fallback from chat history (Phase 2 no longer runs)
    const historyEntities = extractInvoiceEntitiesFromHistory(history);
    agenticCtx.invoiceEntities = historyEntities ?? null;

    // 3. Execute agentic loop
    agenticLogger.info('Starting agentic path', {
      requestId: ctx.requestId,
      channelSenderId,
      messageLength: enrichedMessage.length,
      historyCount: history.length,
      documentPreviews: previewResult.previews.length,
    });

    const agenticResult = await executeAgenticLoop(
      enrichedMessage,
      history,
      AGENTIC_TOOL_DEFINITIONS,
      agenticCtx
    );

    // 3b. ADR-259A: Record token usage (fire-and-forget, non-fatal)
    if (agenticResult.totalUsage.total_tokens > 0) {
      recordUsage(
        channelSenderId,
        ctx.intake.channel,
        agenticResult.totalUsage,
      ).catch(() => { /* non-fatal */ });
    }

    // 4. Save to chat history — ONLY if the agentic loop succeeded
    const now = new Date().toISOString();
    const maxIter = agenticCtx.isAdmin
      ? AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS
      : AI_COST_CONFIG.LIMITS.CUSTOMER_MAX_ITERATIONS;
    const isFailedResponse = agenticResult.answer.includes('\u039E\u03B5\u03C0\u03AD\u03C1\u03B1\u03C3\u03B1 \u03C4\u03BF \u03BC\u03AD\u03B3\u03B9\u03C3\u03C4\u03BF')
      || agenticResult.answer.includes('\u03C0\u03BF\u03BB\u03CD \u03C7\u03C1\u03CC\u03BD\u03BF')
      || agenticResult.answer.includes('\u0394\u03B5\u03BD \u03BC\u03C0\u03CC\u03C1\u03B5\u03C3\u03B1')
      || agenticResult.iterations >= maxIter;

    if (!isFailedResponse) {
      await chatHistoryService.addMessage(channelSenderId, {
        role: 'user',
        content: enrichedMessage,
        timestamp: now,
      });
      await chatHistoryService.addMessage(channelSenderId, {
        role: 'assistant',
        content: agenticResult.answer,
        timestamp: now,
        toolCalls: agenticResult.toolCalls,
      });
    }

    // 5. Send reply via channel dispatcher (SSoT: extractChannelIds)
    const channelIds = extractChannelIds(ctx);

    await sendChannelReply({
      ...channelIds,
      channel: ctx.intake.channel,
      textBody: agenticResult.answer,
      requestId: ctx.requestId,
    });

    // 5a. Post-reply actions (CRM store, duplicate keyboard, feedback)
    await sendPostReplyActions({
      ctx,
      agenticResult,
      channelSenderId,
      userMessage,
      isFailedResponse,
    });

    // 6. Update pipeline context
    ctx.executionResult = { success: true, sideEffects: ['agentic_loop_completed'] };
    ctx = transitionState(ctx, PipelineState.UNDERSTOOD);
    ctx = transitionState(ctx, PipelineState.PROPOSED);
    const approverLabel = ctx.adminCommandMeta?.isAdminCommand
      ? `super_admin:${ctx.adminCommandMeta.adminIdentity.displayName}`
      : `AI-auto:${ctx.intake.channel}`;
    ctx.approval = {
      decision: 'approved',
      approvedBy: approverLabel,
      decidedAt: now,
    };
    ctx = transitionState(ctx, PipelineState.APPROVED);
    ctx = transitionState(ctx, PipelineState.EXECUTED);
    ctx = transitionState(ctx, PipelineState.AUDITED);

    // 7. Audit
    const auditId = await auditService.record(ctx, 'auto_processed', 'ADR-171-agentic');

    agenticLogger.info('Agentic path completed', {
      requestId: ctx.requestId,
      iterations: agenticResult.iterations,
      toolCalls: agenticResult.toolCalls.length,
      durationMs: agenticResult.totalDurationMs,
      auditId,
    });

    return {
      success: true,
      requestId: ctx.requestId,
      finalState: ctx.state,
      context: ctx,
      auditId,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    agenticLogger.error('Agentic path failed', {
      requestId: ctx.requestId,
      error: errorMessage,
    });

    ctx.errors.push({
      step: 'agentic_path',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      retryable: false,
    });
    ctx = deps.transitionState(ctx, PipelineState.FAILED);
    const auditId = await deps.auditService.record(ctx, 'failed', 'ADR-171-agentic');

    // Send error reply to user (SSoT: extractChannelIds)
    try {
      await sendChannelReply({
        ...extractChannelIds(ctx),
        channel: ctx.intake.channel,
        textBody: '\u03A3\u03C5\u03B3\u03B3\u03BD\u03CE\u03BC\u03B7, \u03B1\u03BD\u03C4\u03B9\u03BC\u03B5\u03C4\u03CE\u03C0\u03B9\u03C3\u03B1 \u03AD\u03BD\u03B1 \u03C0\u03C1\u03CC\u03B2\u03BB\u03B7\u03BC\u03B1 \u03BA\u03B1\u03C4\u03AC \u03C4\u03B7\u03BD \u03B5\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03B1\u03C3\u03AF\u03B1. \u0394\u03BF\u03BA\u03AF\u03BC\u03B1\u03C3\u03B5 \u03BE\u03B1\u03BD\u03AC.',
        requestId: ctx.requestId,
      });
    } catch {
      // Non-fatal — don't let error reply failure mask the original error
    }

    return {
      success: false,
      requestId: ctx.requestId,
      finalState: ctx.state,
      context: ctx,
      auditId,
      error: errorMessage,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** ADR-265: Return type for document preview + vision images */
interface DocumentPreviewWithImages {
  previews: DocumentPreviewData[];
  documentImages: NonNullable<AgenticContext['documentImages']>;
}

/**
 * ADR-264 + ADR-265: Detect "file without command" → Phase 1 preview + capture base64.
 * Phase 2 (invoice extraction) REMOVED — the agentic loop sees the actual document via vision.
 */
async function handleDocumentPreviewIfNeeded(
  userMessage: string,
  attachments?: AgenticContext['attachments']
): Promise<DocumentPreviewWithImages> {
  const empty: DocumentPreviewWithImages = { previews: [], documentImages: [] };
  if (!attachments || attachments.length === 0) return empty;

  const trimmed = userMessage.trim();
  const isEmptyOrTrivial = !trimmed
    || trimmed === '(χωρίς κείμενο)'
    || trimmed.length < 5;

  if (!isEmptyOrTrivial) return empty;

  const previews: DocumentPreviewData[] = [];
  const documentImages: NonNullable<AgenticContext['documentImages']> = [];
  const candidates = attachments
    .filter(a => isVisionSupportedMime(a.contentType) && a.storageUrl)
    .slice(0, MAX_PREVIEWS_PER_MESSAGE);

  for (const att of candidates) {
    try {
      // Phase 1: Download + general preview (classifier)
      const fileBuffer = await downloadAndValidateFile({
        fileRecordId: att.fileRecordId,
        downloadUrl: att.storageUrl,
        filename: att.filename,
        contentType: att.contentType,
      });
      if (!fileBuffer) continue;

      const preview = await previewDocumentFromBuffer(fileBuffer, {
        fileRecordId: att.fileRecordId,
        filename: att.filename,
        contentType: att.contentType,
      });
      if (!preview) continue;

      // ADR-265: Store base64 for vision-in-the-loop (AI sees actual document)
      // NOTE: Chat Completions API only supports image/* MIME types in image_url.
      // PDFs are NOT supported — they get Phase 1 text enrichment only.
      const isImage = att.contentType.startsWith('image/');
      if (isImage) {
        const base64 = fileBuffer.toString('base64');
        documentImages.push({
          base64DataUri: `data:${att.contentType};base64,${base64}`,
          filename: att.filename,
          contentType: att.contentType,
          fileRecordId: att.fileRecordId,
        });
      }

      previews.push({
        fileRecordId: att.fileRecordId,
        filename: att.filename,
        summary: preview.summary,
        documentType: preview.documentType,
        suggestedActions: preview.suggestedActions,
        confidence: preview.confidence,
        extractedNames: preview.extractedNames,
      });
    } catch {
      agenticLogger.warn('Document preview failed', {
        fileRecordId: att.fileRecordId,
        filename: att.filename,
      });
    }
  }

  return { previews, documentImages };
}

/**
 * Build channel+sender ID for chat history keying
 */
export function buildChannelSenderId(ctx: PipelineContext): string {
  const channel = ctx.intake.channel;
  const sender = ctx.intake.normalized.sender;
  const senderId = sender.firebaseUid
    ?? sender.telegramId
    ?? sender.whatsappPhone
    ?? sender.messengerUserId
    ?? sender.instagramUserId
    ?? sender.email
    ?? sender.phone;

  if (!senderId) {
    throw new Error(`No sender identifier for channel ${channel}`);
  }

  return `${channel}_${senderId}`;
}
