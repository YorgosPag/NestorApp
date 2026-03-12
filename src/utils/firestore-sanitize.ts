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
