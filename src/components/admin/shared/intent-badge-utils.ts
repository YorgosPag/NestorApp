/**
 * =============================================================================
 * INTENT BADGE UTILS — SSoT for AI pipeline badge styling
 * =============================================================================
 *
 * Shared across AI Inbox, Operator Inbox, and ProposalReviewCard.
 * Maps pipeline intents and confidence scores to semantic badge variants.
 *
 * @module intent-badge-utils
 * @see ADR-080 (Pipeline Implementation)
 * @enterprise Google SSoT — single source of truth, zero duplicates
 */

import type { PipelineIntentTypeValue } from '@/types/ai-pipeline';

// ============================================================================
// TYPES
// ============================================================================

export type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// ============================================================================
// INTENT → BADGE VARIANT
// ============================================================================

/** Intents that indicate a positive/action-oriented request */
const POSITIVE_INTENTS = new Set<string>([
  'invoice',
  'payment_notification',
  'delivery',
  'appointment',
]);

/** Intents that indicate a problem or complaint */
const NEGATIVE_INTENTS = new Set<string>([
  'defect_report',
  'issue',
  'complaint',
]);

/** Intents that indicate informational/neutral actions */
const NEUTRAL_INTENTS = new Set<string>([
  'appointment_request',
  'property_search',
  'payment',
  'info_update',
  'document_request',
  'general_inquiry',
  'status_inquiry',
]);

/**
 * Maps AI intent type to a semantic badge variant.
 * Unified resolver for both AI Inbox (legacy intent names) and
 * Operator Inbox (PipelineIntentTypeValue).
 *
 * @param intent - The classified intent string
 * @returns Badge variant for visual differentiation
 */
export const getIntentBadgeVariant = (intent?: string | PipelineIntentTypeValue): IntentBadgeVariant => {
  if (!intent) return 'outline';
  if (POSITIVE_INTENTS.has(intent)) return 'default';
  if (NEGATIVE_INTENTS.has(intent)) return 'destructive';
  if (NEUTRAL_INTENTS.has(intent)) return 'secondary';
  return 'outline';
};

// ============================================================================
// CONFIDENCE → BADGE VARIANT
// ============================================================================

/**
 * Maps AI confidence score (0–1) to a semantic badge variant.
 * Used by AI Inbox for Badge component variant prop.
 *
 * @param confidence - Score from 0 to 1
 * @returns Badge variant: default >= 0.8, secondary >= 0.6, destructive < 0.6
 */
export const getConfidenceBadgeVariant = (confidence?: number): IntentBadgeVariant => {
  if (!confidence) return 'outline';
  return confidence >= 0.8 ? 'default' : confidence >= 0.6 ? 'secondary' : 'destructive';
};

// ============================================================================
// CONFIDENCE → COLOR CLASS
// ============================================================================

/**
 * Maps AI confidence score (0–100) to a Tailwind color class.
 * Used by Operator Inbox for text coloring (not Badge variant).
 *
 * @param confidence - Score from 0 to 100
 * @returns Tailwind color class string
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return 'text-green-600 dark:text-green-400';
  if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};
