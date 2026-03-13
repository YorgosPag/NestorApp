/**
 * Centralized error message extraction utility.
 * Replaces scattered `err instanceof Error ? err.message : '...'` patterns.
 *
 * @see ADR-221 — Error Message Extraction Centralization
 */

/**
 * Extract a human-readable message from an unknown catch parameter.
 *
 * Handles: string errors, Error instances, plain objects with `.message` or `.error`,
 * and falls back to a configurable default.
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  if (error !== null && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }

  return fallback;
}
