/**
 * =============================================================================
 * FEEDBACK KEYBOARD — Telegram Inline Keyboard for AI Response Rating
 * =============================================================================
 *
 * Creates inline keyboard buttons for thumbs up/down feedback on AI responses.
 * Uses compact callback data format to fit within Telegram's 64-byte limit.
 *
 * Callback data formats:
 *   Rating:   `fb:{p|n}:{feedbackDocId}`
 *   Category: `fb:c:{feedbackDocId}:{categoryCode}`
 *
 * Category codes (1 char to fit 64-byte limit):
 *   w = wrong_answer, d = wrong_data, u = not_understood, s = slow
 *
 * @module services/ai-pipeline/feedback-keyboard
 * @see ADR-173 (AI Self-Improvement System)
 */

import type { TelegramReplyMarkup } from '@/app/api/communications/webhooks/telegram/telegram/types';
import type { FeedbackRating, NegativeFeedbackCategory } from './feedback-service';

// ============================================================================
// CONSTANTS
// ============================================================================

const FEEDBACK_PREFIX = 'fb';
const POSITIVE_CODE = 'p';
const NEGATIVE_CODE = 'n';
const CATEGORY_CODE = 'c';

/** Phase 6C: Suggested action callback prefix */
const SUGGESTION_PREFIX = 'sa';

/**
 * Compact category codes for Telegram's 64-byte callback_data limit.
 */
const CATEGORY_MAP: Record<string, NegativeFeedbackCategory> = {
  w: 'wrong_answer',
  d: 'wrong_data',
  u: 'not_understood',
  s: 'slow',
};

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
 * Create a follow-up inline keyboard for negative feedback categories.
 * Shown after user clicks thumbs down (Phase 2: ChatGPT/Intercom pattern).
 *
 * @param feedbackDocId - Firestore document ID
 * @returns TelegramReplyMarkup with category buttons
 */
export function createNegativeCategoryKeyboard(feedbackDocId: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '\u274C \u039B\u03AC\u03B8\u03BF\u03C2 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7',
          callback_data: `${FEEDBACK_PREFIX}:${CATEGORY_CODE}:${feedbackDocId}:w`,
        },
        {
          text: '\u{1F4CA} \u039B\u03AC\u03B8\u03BF\u03C2 \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1',
          callback_data: `${FEEDBACK_PREFIX}:${CATEGORY_CODE}:${feedbackDocId}:d`,
        },
      ],
      [
        {
          text: '\u2753 \u0394\u03B5\u03BD \u03BA\u03B1\u03C4\u03AC\u03BB\u03B1\u03B2\u03B5',
          callback_data: `${FEEDBACK_PREFIX}:${CATEGORY_CODE}:${feedbackDocId}:u`,
        },
        {
          text: '\u{1F422} \u0391\u03C1\u03B3\u03CC',
          callback_data: `${FEEDBACK_PREFIX}:${CATEGORY_CODE}:${feedbackDocId}:s`,
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
 * Check if a callback_data string is a category callback.
 */
export function isCategoryCallback(data: string): boolean {
  return data.startsWith(`${FEEDBACK_PREFIX}:${CATEGORY_CODE}:`);
}

/**
 * Parse a feedback callback_data string (rating: thumbs up/down).
 *
 * @returns Parsed result or null if invalid
 */
export function parseFeedbackCallback(
  data: string
): { feedbackDocId: string; rating: FeedbackRating } | null {
  if (!isFeedbackCallback(data)) return null;
  // Don't parse category callbacks as rating callbacks
  if (isCategoryCallback(data)) return null;

  const parts = data.split(':');
  if (parts.length < 3) return null;

  const ratingCode = parts[1];
  const feedbackDocId = parts.slice(2).join(':');

  if (!feedbackDocId) return null;

  const rating: FeedbackRating = ratingCode === POSITIVE_CODE ? 'positive' : 'negative';
  return { feedbackDocId, rating };
}

/**
 * Parse a category callback_data string.
 * Format: `fb:c:{feedbackDocId}:{categoryCode}`
 *
 * @returns Parsed result or null if invalid
 */
export function parseCategoryCallback(
  data: string
): { feedbackDocId: string; category: NegativeFeedbackCategory } | null {
  if (!isCategoryCallback(data)) return null;

  const parts = data.split(':');
  // Expected: ['fb', 'c', feedbackDocId, categoryCode]
  if (parts.length < 4) return null;

  const feedbackDocId = parts[2];
  const categoryCode = parts[3];

  if (!feedbackDocId || !categoryCode) return null;

  const category = CATEGORY_MAP[categoryCode];
  if (!category) return null;

  return { feedbackDocId, category };
}

// ============================================================================
// PHASE 6C: SUGGESTED ACTIONS KEYBOARD
// ============================================================================

/**
 * Create an inline keyboard with context-aware suggested follow-up actions.
 * Displayed between the AI answer and the feedback keyboard.
 *
 * Callback format: `sa:{index}:{feedbackDocId}` (fits in 64 bytes)
 *
 * @param feedbackDocId - Firestore feedback doc ID (stores the suggestions array)
 * @param suggestions - 1-3 suggestion text strings (max 40 chars each)
 * @returns TelegramReplyMarkup with inline keyboard buttons
 */
export function createSuggestedActionsKeyboard(
  feedbackDocId: string,
  suggestions: string[]
): TelegramReplyMarkup {
  const buttons = suggestions.slice(0, 3).map((text, index) => ({
    text: `\u{1F4A1} ${text}`,
    callback_data: `${SUGGESTION_PREFIX}:${index}:${feedbackDocId}`,
  }));

  return {
    inline_keyboard: [buttons],
  };
}

/**
 * Check if a callback_data string is a suggestion action callback.
 */
export function isSuggestionCallback(data: string): boolean {
  return data.startsWith(`${SUGGESTION_PREFIX}:`);
}

/**
 * Parse a suggestion callback_data string.
 * Format: `sa:{index}:{feedbackDocId}`
 *
 * @returns Parsed result or null if invalid
 */
export function parseSuggestionCallback(
  data: string
): { index: number; feedbackDocId: string } | null {
  if (!isSuggestionCallback(data)) return null;

  const parts = data.split(':');
  // Expected: ['sa', index, feedbackDocId]
  if (parts.length < 3) return null;

  const index = parseInt(parts[1], 10);
  if (isNaN(index) || index < 0 || index > 2) return null;

  const feedbackDocId = parts.slice(2).join(':');
  if (!feedbackDocId) return null;

  return { index, feedbackDocId };
}
