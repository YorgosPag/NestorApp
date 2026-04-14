/**
 * Storage Rules Test Coverage — Operations & Outcomes
 *
 * Canonical operation + outcome enums used by the Storage coverage manifest
 * and the matrix-driven test harness. See ADR-301 §3.2.
 *
 * @module tests/storage-rules/_registry/operations
 * @since 2026-04-14 (ADR-301 Phase A)
 */

/**
 * Storage operations exercised against storage.rules.
 *
 * `read`   → ref.getMetadata() — tests `allow read`
 * `write`  → ref.put(data)     — tests `allow write`
 * `delete` → ref.delete()      — tests `allow delete`
 *
 * Note: `list` is a Firestore concept; Storage uses path-based access only.
 */
export type StorageOperation = 'read' | 'write' | 'delete';

/** Expected rule outcome for a (persona × operation) cell. */
export type Outcome = 'allow' | 'deny';

/**
 * Deterministic failure reason tag.
 *
 * Used to document *why* a deny should happen — a rule regression that still
 * denies but for the wrong reason is a silent contract break.
 */
export type StorageReason =
  | 'missing_claim'   // unauthenticated or no companyId claim
  | 'cross_tenant'    // authed but wrong companyId custom claim
  | 'not_owner'       // authed but uid does not match path userId
  | 'file_too_large'  // file exceeds 50 MB (isValidFileSize gate)
  | 'invalid_type';   // contentType rejected by isAllowedContentType

/** All known operations — iteration helper. */
export const ALL_STORAGE_OPERATIONS: readonly StorageOperation[] = [
  'read',
  'write',
  'delete',
] as const;
