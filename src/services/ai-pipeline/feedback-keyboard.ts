/**
 * =============================================================================
 * FEEDBACK KEYBOARD — Telegram Inline Keyboard for AI Response Rating
 * =============================================================================
 *
 * Creates inline keyboard buttons for thumbs up/down feedback on AI responses.
 * Uses compact callback data format to fit within Telegram's 64-byte limit.
 *
 * Callback data format: `fb:{p|n}:{feedbackDocId}`
 *   - fb: prefix to identify feedback callbacks
 *   - p/n: positive/negative rating
 *   - feedbackDocId: Firestore document ID (auto-generated, ~20 chars)
 *
 * @module services/ai-pipeline/feedback-keyboard
 * @see ADR-173 (AI Self-Improvement System)
 */

import type { TelegramReplyMarkup } from '@/app/api/communications/webhooks/telegram/telegram/types';
import type { FeedbackRating } from './feedback-service';

// ============================================================================
// CONSTANTS
// ============================================================================

const FEEDBACK_PREFIX = 'fb';
const POSITIVE_CODE = 'p';
const NEGATIVE_CODE = 'n';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create an inline keyboard with thumbs up/down buttons.
 *
 * @param feedbackDocId - Firestore document ID from saveFeedbackSnapshot()
 * @returns TelegramReplyMarkup with inline keyboard
 */
export function createFeedbackKeyboard(feedbackDocId: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '\u{1F44D}',
          callback_data: `${FEEDBACK_PREFIX}:${POSITIVE_CODE}:${feedbackDocId}`,
        },
        {
          text: '\u{1F44E}',
          callback_data: `${FEEDBACK_PREFIX}:${NEGATIVE_CODE}:${feedbackDocId}`,
        },
      ],
    ],
  };
}

/**
 * Check if a callback_data string is a feedback callback.
 */
export function isFeedbackCallback(data: string): boolean {
  return data.startsWith(`${FEEDBACK_PREFIX}:`);
}

/**
 * Parse a feedback callback_data string.
 *
 * @returns Parsed result or null if invalid
 */
export function parseFeedbackCallback(
  data: string
): { feedbackDocId: string; rating: FeedbackRating } | null {
  if (!isFeedbackCallback(data)) return null;

  const parts = data.split(':');
  if (parts.length < 3) return null;

  const ratingCode = parts[1];
  const feedbackDocId = parts.slice(2).join(':'); // Handle edge case of colons in ID

  if (!feedbackDocId) return null;

  const rating: FeedbackRating = ratingCode === POSITIVE_CODE ? 'positive' : 'negative';
  return { feedbackDocId, rating };
}
