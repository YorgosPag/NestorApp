/**
 * 🔍 TELEGRAM BOT SEARCH DETECTION
 *
 * Detects if user message is a property search query.
 * Uses centralized keyword catalog (zero hardcoded lists).
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import {
  isPropertySearchQuery as checkSearchQuery,
  getSearchScore
} from '../catalogs/type-catalog';

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if text is a property search query
 * Uses score-based detection from centralized catalog
 *
 * @param text - User input text
 * @param threshold - Minimum score to consider as search (default: 10)
 * @returns Promise<boolean> - True if search query detected
 */
export async function isPropertySearchQuery(
  text: string,
  threshold: number = 10
): Promise<boolean> {
  return checkSearchQuery(text, threshold);
}

/**
 * Get search confidence score
 * Higher score = more likely to be a property search
 *
 * @param text - User input text
 * @returns number - Search confidence score
 */
export function getQueryScore(text: string): number {
  return getSearchScore(text);
}

/**
 * Check if query is too generic (low specificity)
 *
 * @param text - User input text
 * @returns boolean - True if query is too generic
 */
export function isQueryTooGeneric(text: string): boolean {
  const score = getSearchScore(text);
  // Score between 5-15 indicates generic query (some keywords but not specific enough)
  return score > 5 && score < 15;
}

/**
 * Check if query has high specificity
 *
 * @param text - User input text
 * @returns boolean - True if query is specific enough
 */
export function isQuerySpecific(text: string): boolean {
  const score = getSearchScore(text);
  return score >= 15;
}
