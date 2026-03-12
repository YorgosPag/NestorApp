/**
 * Firestore Document ID & Query Helpers
 *
 * Centralizes sanitization and normalization for Firestore document keys
 * and projectId queries (ADR-209: ID Consistency Remediation).
 */

/**
 * Sanitize a raw string for use as a Firestore document ID.
 *
 * Firestore document IDs must not contain `/` and certain special characters
 * can cause issues. This replaces anything outside `[a-zA-Z0-9_-]` with `_`.
 */
export function sanitizeDocumentId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Normalize a projectId for Firestore queries.
 *
 * Firestore uses strict type matching — a field stored as `number` will NOT
 * match a `string` query and vice-versa. This utility returns the numeric
 * representation when the input is a valid number, otherwise the original string.
 */
export function normalizeProjectIdForQuery(projectId: string): string | number {
  const num = Number(projectId);
  return isNaN(num) ? projectId : num;
}
