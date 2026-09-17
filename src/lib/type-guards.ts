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
 * Reader for **stored** documents: the trimmed string, or `null` when absent / blank / not a string.
 *
 * ADR-862 Φ0 Β14 — the same private `text()` had been copied into seven readers, and the copies
 * disagreed on whether the value is trimmed. For an identifier read back from Firestore (a tenant,
 * a project, a team) a stray space is the difference between «same» and «foreign», so the ONE
 * answer trims. Use `isNonEmptyTrimmedString` when you only need the guard.
 */
export function trimmedStringOrNull(value: unknown): string | null {
  return isNonEmptyTrimmedString(value) ? value.trim() : null;
}

/**
 * Type guard: checks if value is a non-empty array.
 * Replaces scattered `Array.isArray(x) && x.length > 0` patterns.
 * Provides TypeScript type narrowing from `T[] | undefined | null` to `T[]`.
 * @see ADR-225
 */
export function isNonEmptyArray<T = unknown>(value: T[] | readonly T[] | null | undefined | unknown): value is T[] & { length: number; 0: T } {
  return Array.isArray(value) && value.length > 0;
}
