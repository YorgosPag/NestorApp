/**
 * =============================================================================
 * POST-REPLY ACTIONS — Channel-Specific Keyboards & CRM Storage
 * =============================================================================
 *
 * After the agentic loop sends its reply, these actions handle:
 * 1. CRM outbound message storage (Unified Inbox visibility)
 * 2. Duplicate contact inline keyboards
 * 3. Suggested actions keyboards (per channel)
 * 4. Feedback keyboards (per channel: Telegram, WhatsApp, Messenger, Instagram)
 *
 * All actions are NON-FATAL — failure must never break the pipeline.
 *
 * Extracted from pipeline-orchestrator.ts for SRP compliance (N.7.1).
 *
 * @module services/ai-pipeline/post-reply-actions
 * @see ADR-171 (Agentic Loop)
 * @see ADR-173 (AI Self-Improvement)
 * @see ADR-174 (Multi-Channel)
 */

import type { PipelineContext } from '@/types/ai-pipeline';
import type { AgenticResult } from './agentic-loop';
import { extractChannelIds } from './shared/channel-reply-dispatcher';
import { getFeedbackService } from './feedback-service';
import { createFeedbackKeyboard, createSuggestedActionsKeyboard } from './feedback-keyboard';
import type { DuplicateMatch } from './shared/contact-lookup';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const postReplyLogger = createModuleLogger('POST_REPLY_ACTIONS');

// ============================================================================
// PUBLIC API
// ============================================================================

export interface PostReplyParams {
  ctx: PipelineContext;
  agenticResult: AgenticResult;
  channelSenderId: string;
  userMessage: string;
  isFailedResponse: boolean;
}

/**
 * Execute all post-reply actions: CRM store, duplicate keyboard, feedback.
 * All actions are non-fatal — errors are logged but never propagated.
 */
export async function sendPostReplyActions(params: PostReplyParams): Promise<void> {
  const { ctx, agenticResult, channelSenderId, userMessage, isFailedResponse } = params;
  const channelIds = extractChannelIds(ctx);
  const { telegramChatId } = channelIds;

  // 1. Store outbound AI reply in CRM (conversations + messages collections)
  if (ctx.intake.channel === 'telegram' && telegramChatId) {
    await storeCrmOutboundMessage(ctx, agenticResult.answer, telegramChatId);
  }

  // 2. Duplicate contact inline keyboard
  if (ctx.intake.channel === 'telegram' && telegramChatId) {
    await sendDuplicateContactKeyboard(ctx, agenticResult, telegramChatId);
  }

  // 3. Feedback + suggestions (only for successful responses)
  if (!isFailedResponse) {
    await sendFeedbackAndSuggestions({
      ctx,
      agenticResult,
      channelSenderId,
      userMessage,
      channelIds,
    });
  }
}

// ============================================================================
// CRM OUTBOUND MESSAGE STORAGE
// ============================================================================

async function storeCrmOutboundMessage(
  ctx: PipelineContext,
  answer: string,
  telegramChatId: string
): Promise<void> {
  try {
    const { storeMessageInCRM } = await import(
      '@/app/api/communications/webhooks/telegram/crm/store'
    );
    const { BOT_IDENTITY } = await import('@/config/domain-constants');
    await storeMessageInCRM({
      from: { id: BOT_IDENTITY.ID, first_name: BOT_IDENTITY.DISPLAY_NAME },
      chat: { id: Number(telegramChatId) },
      text: answer,
      message_id: `agentic_${ctx.requestId}`,
    }, 'outbound');
  } catch {
    // Non-fatal: CRM store failure must never break the pipeline
  }
}

// ============================================================================
// DUPLICATE CONTACT KEYBOARD
// ============================================================================

async function sendDuplicateContactKeyboard(
  ctx: PipelineContext,
  agenticResult: AgenticResult,
  telegramChatId: string
): Promise<void> {
  try {
    const duplicateToolCall = agenticResult.toolCalls.find(
      tc => tc.name === 'create_contact' && tc.result.includes('"duplicateDetected":true')
    );
    if (!duplicateToolCall) return;

    const { storePendingContactAction, createDuplicateContactKeyboard } = await import(
      './duplicate-contact-keyboard'
    );
    const { sendTelegramMessage } = await import(
      '@/app/api/communications/webhooks/telegram/telegram/client'
    );

    const parsed = JSON.parse(duplicateToolCall.result) as {
      duplicateDetected?: boolean;
      requestedContact?: Record<string, unknown>;
      matches?: Array<Record<string, unknown>>;
    };

    if (!parsed.requestedContact || !parsed.matches) return;

    const rc = parsed.requestedContact;
    const pendingId = await storePendingContactAction({
      type: 'duplicate_contact',
      requestedContact: {
        firstName: String(rc.firstName ?? ''),
        lastName: String(rc.lastName ?? ''),
        email: rc.email ? String(rc.email) : null,
        phone: rc.phone ? String(rc.phone) : null,
        contactType: String(rc.contactType ?? 'individual'),
        companyName: rc.companyName ? String(rc.companyName) : null,
      },
      companyId: ctx.companyId,
      matches: parsed.matches as unknown as DuplicateMatch[],
      chatId: String(telegramChatId),
    });

    await sendTelegramMessage({
      chat_id: Number(telegramChatId),
      text: '\u0395\u03C0\u03AF\u03BB\u03B5\u03BE\u03B5 \u03B5\u03BD\u03AD\u03C1\u03B3\u03B5\u03B9\u03B1:',
      reply_markup: createDuplicateContactKeyboard(pendingId),
    });

    postReplyLogger.info('Duplicate contact keyboard sent', {
      requestId: ctx.requestId,
      pendingId,
      matchCount: parsed.matches?.length ?? 0,
    });
  } catch (kbError) {
    postReplyLogger.warn('Failed to send duplicate contact keyboard', {
      error: getErrorMessage(kbError),
    });
  }
}

// ============================================================================
// FEEDBACK & SUGGESTIONS (PER CHANNEL)
// ============================================================================

interface FeedbackParams {
  ctx: PipelineContext;
  agenticResult: AgenticResult;
  channelSenderId: string;
  userMessage: string;
  channelIds: ReturnType<typeof extractChannelIds>;
}

async function sendFeedbackAndSuggestions(params: FeedbackParams): Promise<void> {
  const { ctx, agenticResult, channelSenderId, userMessage, channelIds } = params;
  const { telegramChatId, whatsappPhone, messengerPsid, instagramIgsid } = channelIds;

  try {
    const feedbackDocId = await getFeedbackService().saveFeedbackSnapshot({
      requestId: ctx.requestId,
      channelSenderId,
      userQuery: userMessage,
      aiAnswer: agenticResult.answer,
      toolCalls: agenticResult.toolCalls,
      iterations: agenticResult.iterations,
      durationMs: agenticResult.totalDurationMs,
      suggestedActions: agenticResult.suggestions,
    });

    if (!feedbackDocId) return;

    // ── Telegram: Inline keyboards ──
    if (ctx.intake.channel === 'telegram' && telegramChatId) {
      await sendTelegramFeedback(telegramChatId, feedbackDocId, agenticResult);
    }

    // ── WhatsApp: Interactive Reply Buttons (ADR-174) ──
    if (ctx.intake.channel === 'whatsapp' && whatsappPhone) {
      await sendWhatsAppFeedback(whatsappPhone, feedbackDocId, agenticResult);
    }

    // ── Messenger: Quick Reply Buttons (ADR-174) ──
    if (ctx.intake.channel === 'messenger' && messengerPsid) {
      await sendMessengerFeedback(messengerPsid, feedbackDocId, agenticResult);
    }

    // ── Instagram: Text-based prompts (ADR-174) ──
    if (ctx.intake.channel === 'instagram' && instagramIgsid) {
      await sendInstagramFeedback(instagramIgsid, feedbackDocId, agenticResult);
    }
  } catch {
    // Non-fatal: feedback failure must never break the pipeline
  }
}

// ── Telegram ──
async function sendTelegramFeedback(
  chatId: string,
  feedbackDocId: string,
  agenticResult: AgenticResult
): Promise<void> {
  const { sendTelegramMessage } = await import(
    '@/app/api/communications/webhooks/telegram/telegram/client'
  );

  if (agenticResult.suggestions.length > 0) {
    await sendTelegramMessage({
      chat_id: Number(chatId),
      text: '\u{1F4A1} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03B5\u03C0\u03AF\u03C3\u03B7\u03C2 \u03BD\u03B1 \u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9\u03C2:',
      reply_markup: createSuggestedActionsKeyboard(feedbackDocId, agenticResult.suggestions),
    });
  }

  await sendTelegramMessage({
    chat_id: Number(chatId),
    text: '\u{1F4AC} \u0397\u03C4\u03B1\u03BD \u03C7\u03C1\u03AE\u03C3\u03B9\u03BC\u03B7 \u03B7 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7;',
    reply_markup: createFeedbackKeyboard(feedbackDocId),
  });
}

// ── WhatsApp (ADR-174) ──
async function sendWhatsAppFeedback(
  phone: string,
  feedbackDocId: string,
  agenticResult: AgenticResult
): Promise<void> {
  const { sendWhatsAppButtons } = await import(
    '@/app/api/communications/webhooks/whatsapp/whatsapp-client'
  );

  if (agenticResult.suggestions.length > 0) {
    const suggestionBtns = agenticResult.suggestions.slice(0, 3).map((s, i) => ({
      id: `sug_${feedbackDocId}_${i}`,
      title: s.substring(0, 20),
    }));
    await sendWhatsAppButtons(
      phone,
      '\u{1F4A1} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03B5\u03C0\u03AF\u03C3\u03B7\u03C2 \u03BD\u03B1 \u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9\u03C2:',
      suggestionBtns,
    );
  }

  await sendWhatsAppButtons(
    phone,
    '\u{1F4AC} \u0397\u03C4\u03B1\u03BD \u03C7\u03C1\u03AE\u03C3\u03B9\u03BC\u03B7 \u03B7 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7;',
    [
      { id: `fb_${feedbackDocId}_up`, title: '\u{1F44D}' },
      { id: `fb_${feedbackDocId}_down`, title: '\u{1F44E}' },
    ],
  );
}

// ── Messenger (ADR-174) ──
async function sendMessengerFeedback(
  psid: string,
  feedbackDocId: string,
  agenticResult: AgenticResult
): Promise<void> {
  const { sendMessengerQuickReplies } = await import(
    '@/app/api/communications/webhooks/messenger/messenger-client'
  );

  if (agenticResult.suggestions.length > 0) {
    const suggestionQRs = agenticResult.suggestions.slice(0, 3).map((s, i) => ({
      content_type: 'text' as const,
      title: s.substring(0, 20),
      payload: `sug_${feedbackDocId}_${i}`,
    }));
    await sendMessengerQuickReplies(
      psid,
      '\u{1F4A1} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03B5\u03C0\u03AF\u03C3\u03B7\u03C2 \u03BD\u03B1 \u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9\u03C2:',
      suggestionQRs,
    );
  }

  await sendMessengerQuickReplies(
    psid,
    '\u{1F4AC} \u0397\u03C4\u03B1\u03BD \u03C7\u03C1\u03AE\u03C3\u03B9\u03BC\u03B7 \u03B7 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7;',
    [
      { content_type: 'text', title: '\u{1F44D}', payload: `fb_${feedbackDocId}_up` },
      { content_type: 'text', title: '\u{1F44E}', payload: `fb_${feedbackDocId}_down` },
    ],
  );
}

// ── Instagram (ADR-174) ──
// Instagram DM API silently ignores quick_replies — buttons never render.
// Fallback: text prompts with emoji/number instructions.
// Handler detects 👍/👎 and 1-4 as feedback via getLatestFeedbackForChannel().
async function sendInstagramFeedback(
  igsid: string,
  feedbackDocId: string,
  agenticResult: AgenticResult
): Promise<void> {
  // feedbackDocId kept for future use when Instagram supports interactive elements
  void feedbackDocId;

  const { sendInstagramMessage } = await import(
    '@/app/api/communications/webhooks/instagram/instagram-client'
  );

  if (agenticResult.suggestions.length > 0) {
    const numberEmojis = ['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3'];
    const suggestionLines = agenticResult.suggestions
      .slice(0, 3)
      .map((s, i) => `${numberEmojis[i]} ${s}`)
      .join('\n');
    await sendInstagramMessage(
      igsid,
      `\u{1F4A1} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03B5\u03C0\u03AF\u03C3\u03B7\u03C2 \u03BD\u03B1 \u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9\u03C2:\n${suggestionLines}`,
    );
  }

  await sendInstagramMessage(
    igsid,
    '\u{1F4AC} \u0397\u03C4\u03B1\u03BD \u03C7\u03C1\u03AE\u03C3\u03B9\u03BC\u03B7 \u03B7 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7; \u0391\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B5 \u{1F44D} \u03AE \u{1F44E}',
  );
}
