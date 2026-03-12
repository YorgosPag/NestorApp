/**
 * @module async-utils
 * @description Canonical async utilities — Single Source of Truth (ADR-212 Phase 9)
 *
 * ALL sleep/delay usage in the app MUST import from here.
 */

// ============================================================================
// SLEEP / DELAY
// ============================================================================

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Use for rate limiting, backoff delays, polling intervals, etc.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
