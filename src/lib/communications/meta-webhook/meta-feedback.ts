/**
 * =============================================================================
 * META WEBHOOK FEEDBACK PAYLOAD PARSING + PERSISTENCE — SHARED SSoT
 * =============================================================================
 *
 * Single Source of Truth for decoding the feedback button / quick-reply payloads
 * that Messenger and WhatsApp send, and for persisting the resulting rating /
 * category to the feedback service. Both platforms encode payloads identically:
 *
 *   fb_{feedbackDocId}_{up|down}     → thumbs up / down rating
 *   fbc_{feedbackDocId}_{w|d|u|s}    → negative-feedback category
 *
 * Only the *reply rendering* differs per platform (WhatsApp buttons vs Messenger
 * quick replies vs Instagram plain text) — that stays in each handler. This
 * module owns the parsing + Firestore writes, which were duplicated verbatim.
 *
 * @module lib/communications/meta-webhook/meta-feedback
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import type { NegativeFeedbackCategory } from '@/services/ai-pipeline/feedback-service';

/** Category code (as encoded in the payload suffix) → Firestore category value. */
export const CATEGORY_MAP: Record<string, NegativeFeedbackCategory> = {
  w: 'wrong_answer',
  d: 'wrong_data',
  u: 'not_understood',
  s: 'slow',
};

/** Decoded `fb_{id}_{up|down}` feedback-rating payload. */
export interface ParsedFeedbackPayload {
  feedbackDocId: string;
  isPositive: boolean;
}

/** Decoded `fbc_{id}_{w|d|u|s}` negative-category payload. */
export interface ParsedCategoryPayload {
  feedbackDocId: string;
  category: NegativeFeedbackCategory;
}

/**
 * Parse a feedback-rating payload of the form `fb_{feedbackDocId}_{up|down}`.
 * `feedbackDocId` may itself contain underscores, so it is the middle segment.
 *
 * @returns The decoded payload, or null if malformed.
 */
export function parseFeedbackPayload(payload: string): ParsedFeedbackPayload | null {
  const parts = payload.split('_');
  const sentiment = parts[parts.length - 1]; // 'up' or 'down'
  const feedbackDocId = parts.slice(1, -1).join('_');

  if (!feedbackDocId || !sentiment) {
    return null;
  }

  return { feedbackDocId, isPositive: sentiment === 'up' };
}

/**
 * Parse a negative-category payload of the form `fbc_{feedbackDocId}_{w|d|u|s}`.
 *
 * @returns The decoded payload, or null if malformed / unknown category code.
 */
export function parseCategoryPayload(payload: string): ParsedCategoryPayload | null {
  const parts = payload.split('_');
  const categoryCode = parts[parts.length - 1];
  const feedbackDocId = parts.slice(1, -1).join('_');

  if (!feedbackDocId || !categoryCode) {
    return null;
  }

  const category = CATEGORY_MAP[categoryCode];
  if (!category) {
    return null;
  }

  return { feedbackDocId, category };
}

/**
 * Persist a thumbs up / down rating for a feedback doc.
 * Uses dynamic import to avoid circular dependency issues.
 */
export async function applyFeedbackRating(feedbackDocId: string, isPositive: boolean): Promise<void> {
  const { getFeedbackService } = await import('@/services/ai-pipeline/feedback-service');
  await getFeedbackService().updateRating(feedbackDocId, isPositive ? 'positive' : 'negative');
}

/**
 * Persist a negative-feedback category for a feedback doc.
 * Uses dynamic import to avoid circular dependency issues.
 */
export async function applyNegativeCategory(
  feedbackDocId: string,
  category: NegativeFeedbackCategory
): Promise<void> {
  const { getFeedbackService } = await import('@/services/ai-pipeline/feedback-service');
  await getFeedbackService().updateNegativeCategory(feedbackDocId, category);
}
