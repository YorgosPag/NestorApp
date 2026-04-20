/**
 * =============================================================================
 * CDC AUDIT: Action classifier (pure)
 * =============================================================================
 *
 * Classifies a Firestore write into a semantic audit action verbatim
 * matching the service-layer writer's action strings, so the UI dedup can
 * collapse the dual-write pair on `(entityId, action)` within the 30s
 * window.
 *
 * Extracted from `contact-audit-trigger.ts` so the classifier can be unit
 * tested without dragging in the firebase-admin/firebase-functions runtime.
 *
 * @module functions/audit/resolve-action
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

type DocData = Record<string, unknown>;

/**
 * Classify a Firestore write into a semantic action. Order matters:
 * structural events (create/delete) take precedence over state transitions.
 *
 * Contract:
 *   - `before === null && after !== null`            → `'created'`
 *   - `before !== null && after === null`            → `'deleted'`
 *   - `status: active → deleted` (ADR-281)           → `'soft_deleted'`
 *   - `status: deleted → !deleted`                   → `'restored'`
 *   - legacy `isDeleted: false → true`               → `'trashed'`
 *   - legacy `isDeleted: true → false`               → `'restored'`
 *   - `archivedAt` toggled                           → `'archived' | 'unarchived'`
 *   - any other `status` transition                  → `'status_changed'`
 *   - everything else                                → `'updated'`
 */
export function resolveAction(
  before: DocData | null,
  after: DocData | null,
): string {
  if (!before && after) return 'created';
  if (before && !after) return 'deleted';
  if (!before || !after) return 'updated';

  // Soft-delete lifecycle via `status` string transitions (ADR-281 —
  // canonical soft-delete engine uses `status: 'deleted'` + `previousStatus`,
  // not an `isDeleted` boolean). Must precede the generic status_changed
  // branch so the CDC entry matches the service-layer action verbatim.
  if (before.status !== 'deleted' && after.status === 'deleted') {
    return 'soft_deleted';
  }
  if (before.status === 'deleted' && after.status !== 'deleted') {
    return 'restored';
  }

  // Legacy boolean lifecycle — kept as fallback for entities that haven't
  // migrated to the status-string pattern yet.
  if (after.isDeleted === true && before.isDeleted !== true) return 'trashed';
  if (after.isDeleted !== true && before.isDeleted === true) return 'restored';
  if (after.archivedAt && !before.archivedAt) return 'archived';
  if (after.archivedAt === null && before.archivedAt) return 'unarchived';
  if (before.status !== after.status) return 'status_changed';

  return 'updated';
}
