/**
 * @fileoverview Firestore Sanitization — Shared utility
 * @description Replaces `undefined` values with `null` before Firestore writes (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 *
 * Promoted from: src/subapps/accounting/services/repository/firestore-helpers.ts
 *
 * CRITICAL (per MEMORY.md): Firestore accepts `null` but REJECTS `undefined`.
 * This function MUST be called on every write operation.
 */

/**
 * Recursively replaces `undefined` values with `null` in a plain object.
 *
 * - Shallow keys with `undefined` become `null`
 * - Nested plain objects are recursively sanitized
 * - Arrays, Dates, and other non-plain-object values are passed through unchanged
 *
 * @param data - The object to sanitize
 * @returns A shallow copy with all `undefined` values replaced by `null`
 */
export function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      sanitized[key] = null;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      sanitized[key] = sanitizeForFirestore(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

// ============================================================================
// STRIP UNDEFINED (DEEP) — removes keys with undefined values
// ============================================================================

/**
 * Recursively removes keys whose value is `undefined`.
 *
 * Unlike `sanitizeForFirestore` (which converts undefined → null),
 * this function **deletes** the key entirely.
 *
 * - Handles nested objects, arrays, and Date instances
 * - Filters out `undefined` elements from arrays
 * - Passes through primitives, Dates, and null unchanged
 *
 * @param value - Any value to strip undefined keys from
 * @returns A deep copy with all undefined keys/elements removed
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (typeof value === 'object') {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedDeep(item)]);

    return Object.fromEntries(sanitizedEntries) as T;
  }

  return value;
}

// ============================================================================
// STRIP NULL VALUES (DEEP) — removes keys with null values
// ============================================================================

/**
 * Recursively removes keys whose value is `null`.
 *
 * Primary use-case: OpenAI strict mode returns `null` for optional fields,
 * but Zod `.optional()` expects the key to be **omitted** rather than null.
 *
 * - Handles nested plain objects
 * - Arrays are passed through unchanged (null elements are NOT removed)
 * - Dates and other non-plain-object values are passed through
 *
 * @param obj - The object to strip null keys from
 * @returns A deep copy with all null keys removed
 */
export function stripNullValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = stripNullValues(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
