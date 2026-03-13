/**
 * Shared type guard functions — centralized, zero dependencies
 *
 * @module lib/type-guards
 * @see ADR-213 Phase 10 — isRecord deduplication
 * @see ADR-225 — isNonEmptyString, isNonEmptyTrimmedString, isNonEmptyArray
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

/**
 * Type guard: checks if value is a non-empty string.
 * Replaces scattered `typeof x === 'string' && x.length > 0` patterns.
 * @see ADR-225
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard: checks if value is a non-empty string after trimming whitespace.
 * Stricter version — rejects whitespace-only strings.
 * @see ADR-225
 */
export function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard: checks if value is a non-empty array.
 * Replaces scattered `Array.isArray(x) && x.length > 0` patterns.
 * Provides TypeScript type narrowing from `T[] | undefined | null` to `T[]`.
 * @see ADR-225
 */
export function isNonEmptyArray<T>(value: T[] | readonly T[] | null | undefined): value is T[] & { length: number; 0: T } {
  return Array.isArray(value) && value.length > 0;
}
