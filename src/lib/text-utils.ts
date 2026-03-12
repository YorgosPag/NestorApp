/**
 * Shared text utilities.
 * Promoted from obligations/text-utils.ts for cross-module reuse.
 *
 * @see ADR-205 Phase 4 — truncateText promotion
 */

/**
 * Truncate text to a maximum length, appending ellipsis when truncated.
 *
 * @param text — input string
 * @param maxLength — character limit (default: 150)
 * @returns truncated string with '...' suffix, or original if within limit
 */
export function truncateText(text: string, maxLength = 150): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}
