/**
 * @fileoverview Feedback and duplicate-contact callback handlers (ADR-173, ADR-171)
 * @description Handles thumbs up/down, category selection, suggestion buttons,
 *              and duplicate contact resolution buttons.
 */

import type { TelegramSendPayload } from '../telegram/types';
import type { SuggestionCallbackResult } from './callback-query';
import {
  parseFeedbackCallback,
  parseCategoryCallback,
  parseSuggestionCallback,
  createNegativeCategoryKeyboard,
} from '@/services/ai-pipeline/feedback-keyboard';
import {
  parseDuplicateContactCallback,
  getPendingContactAction,
  deletePendingContactAction,
} from '@/services/ai-pipeline/duplicate-contact-keyboard';
import { getFeedbackService } from '@/services/ai-pipeline/feedback-service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('TelegramCallbackActions');

// ============================================================================
// SHARED: Remove feedback buttons
// ============================================================================

async function removeFeedbackButtons(
  chatId: number | string,
  messageId: number,
  replacementText?: string
): Promise<void> {
  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: replacementText ?? '✅ Feedback καταγράφηκε.',
          reply_markup: { inline_keyboard: [] },
        }),
      }
    );
  } catch {
    // Non-fatal: if edit fails, feedback was already recorded
  }
}

// ============================================================================
// FEEDBACK RATING (thumbs up/down)
// ============================================================================

export async function handleFeedbackRatingCallback(
  data: string,
  chatId: number | string,
  messageId: number
): Promise<TelegramSendPayload | null> {
  const parsed = parseFeedbackCallback(data);
  if (!parsed) return null;

  try {
    await getFeedbackService().updateRating(parsed.feedbackDocId, parsed.rating);

    if (parsed.rating === 'positive') {
      await removeFeedbackButtons(chatId, messageId, '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!');
      return null;
    }

    await removeFeedbackButtons(chatId, messageId, '\u{1F44E} \u0394\u03B5\u03BD \u03AE\u03C4\u03B1\u03BD \u03C7\u03C1\u03AE\u03C3\u03B9\u03BC\u03B7.');

    return {
      chat_id: chatId,
      text: '\u{1F44E} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03BD\u03B1 \u03BC\u03BF\u03C5 \u03C0\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03C0\u03AE\u03B3\u03B5 \u03BB\u03AC\u03B8\u03BF\u03C2;',
      reply_markup: createNegativeCategoryKeyboard(parsed.feedbackDocId),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// FEEDBACK CATEGORY
// ============================================================================

export async function handleCategoryCallback(
  data: string,
  chatId: number | string,
  messageId: number
): Promise<TelegramSendPayload | null> {
  const parsed = parseCategoryCallback(data);
  if (!parsed) return null;

  try {
    await getFeedbackService().updateNegativeCategory(parsed.feedbackDocId, parsed.category);
    await removeFeedbackButtons(chatId, messageId, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// SUGGESTION CALLBACK (Phase 6F)
// ============================================================================

export async function handleSuggestionCallback(
  data: string,
  chatId: number | string,
  userId: string
): Promise<SuggestionCallbackResult | null> {
  const parsed = parseSuggestionCallback(data);
  if (!parsed) return null;

  try {
    const suggestions = await getFeedbackService().getSuggestedActions(parsed.feedbackDocId);
    const suggestionText = suggestions[parsed.index];

    if (!suggestionText) {
      logger.warn('Suggestion index out of bounds', {
        feedbackDocId: parsed.feedbackDocId,
        index: parsed.index,
        available: suggestions.length,
      });
      return null;
    }

    logger.info('Suggestion callback resolved', {
      feedbackDocId: parsed.feedbackDocId,
      index: parsed.index,
      text: suggestionText,
    });

    return {
      type: 'suggestion',
      suggestionText,
      chatId,
      userId,
    };
  } catch (error) {
    logger.warn('Failed to handle suggestion callback', {
      error: getErrorMessage(error),
    });
    return null;
  }
}

// ============================================================================
// DUPLICATE CONTACT RESOLUTION (ADR-171)
// ============================================================================

export async function handleDuplicateContactCallback(
  data: string,
  chatId: number | string,
): Promise<TelegramSendPayload | null> {
  const parsed = parseDuplicateContactCallback(data);
  if (!parsed) {
    logger.warn('Invalid duplicate contact callback', { data });
    return null;
  }

  const { pendingId, action } = parsed;

  try {
    const pending = await getPendingContactAction(pendingId);

    if (!pending) {
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: '⏰ Η ενέργεια έληξε ή έχει ήδη εκτελεστεί. Δοκίμασε ξανά.',
      };
    }

    switch (action) {
      case 'cancel': {
        await deletePendingContactAction(pendingId);
        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: '❌ Η δημιουργία επαφής ακυρώθηκε.',
        };
      }

      case 'create_new': {
        const { createContactServerSide } = await import(
          '@/services/ai-pipeline/shared/contact-lookup'
        );

        const rc = pending.requestedContact;
        const result = await createContactServerSide({
          firstName: rc.firstName,
          lastName: rc.lastName,
          email: rc.email,
          phone: rc.phone,
          type: rc.contactType as 'individual' | 'company',
          companyId: pending.companyId,
          companyName: rc.companyName ?? undefined,
          createdBy: 'AI Agent (admin — button)',
          skipDuplicateCheck: true,
        });

        await deletePendingContactAction(pendingId);

        logger.info('Contact created via duplicate resolution button', {
          contactId: result.contactId,
          displayName: result.displayName,
          pendingId,
        });

        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: `✅ Δημιουργήθηκε νέα επαφή: ${result.displayName} (${result.contactId})`,
        };
      }

      case 'update': {
        const match = pending.matches[0];
        const matchInfo = match
          ? `${match.name}${match.phone ? ` (${match.phone})` : ''}${match.email ? ` — ${match.email}` : ''}`
          : 'Υπάρχουσα επαφή';

        await deletePendingContactAction(pendingId);

        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: `📝 Η υπάρχουσα επαφή: ${matchInfo}\nID: ${match?.contactId ?? 'N/A'}\n\nΓια ενημέρωση, στείλε μου τι θέλεις να αλλάξεις (π.χ. "ενημέρωσε email σε test@example.com").`,
        };
      }

      default:
        return null;
    }
  } catch (error) {
    logger.error('Duplicate contact callback error', {
      pendingId,
      action,
      error: getErrorMessage(error),
    });

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: `❌ Σφάλμα: ${getErrorMessage(error)}`,
    };
  }
}
