/**
 * Centralized safe JSON parsing utilities.
 * Replaces 35+ scattered try-catch JSON.parse patterns across the codebase.
 * @see ADR-223
 */

/**
 * Safe JSON.parse with fallback — replaces scattered try-catch patterns.
 * Returns the parsed value on success, or the fallback on failure.
 */
export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON.parse with validation. Returns fallback if parse fails OR validator rejects.
 */
export function safeJsonParseWith<T>(
  input: string,
  fallback: T,
  validator: (parsed: unknown) => parsed is T
): T {
  try {
    const parsed: unknown = JSON.parse(input);
    return validator(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
