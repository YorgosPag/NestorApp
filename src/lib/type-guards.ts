/**
 * Shared type guard functions — centralized, zero dependencies
 *
 * @module lib/type-guards
 * @see ADR-213 Phase 10 — isRecord deduplication
 */

/**
 * Type guard: checks if a value is a non-null object (Record<string, unknown>).
 *
 * Used extensively for safe property access on unknown payloads
 * (e.g. OpenAI API responses, Firestore documents).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
