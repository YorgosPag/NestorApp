/**
 * =============================================================================
 * CDC AUDIT: Ignored Fields (SSoT)
 * =============================================================================
 *
 * Field paths excluded from CDC deep-diff output. These are either:
 *   - System timestamps maintained by the platform
 *   - Search index metadata (rewritten on every update by index triggers)
 *   - The performer metadata fields themselves (read by the trigger,
 *     must not appear as their own audit entries)
 *   - Firestore internal metadata
 *
 * Adding a field here silences it globally across all CDC-audited
 * collections. Be precise — missing fields will show up as noisy diffs.
 *
 * @module functions/audit/ignored-fields
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

export const IGNORED_FIELDS: readonly string[] = [
  // System timestamps
  'createdAt',
  'updatedAt',
  'archivedAt',
  'trashedAt',
  'restoredAt',
  'deletedAt',
  'purgedAt',

  // Performer metadata — read by trigger, never audited as a change
  '_lastModifiedBy',
  '_lastModifiedByName',
  '_lastModifiedAt',

  // Search indexing metadata (rewritten by indexTriggers on every write)
  'searchTokens',
  'searchKeywords',
  'searchDocId',
  'searchIndexedAt',

  // Firestore internals
  '__name__',
];

/**
 * True if a dot-notation field path is in the ignored set,
 * either exactly or as a parent prefix (e.g. `searchTokens.foo`).
 */
export function isIgnoredField(path: string): boolean {
  for (const ignored of IGNORED_FIELDS) {
    if (path === ignored || path.startsWith(`${ignored}.`)) return true;
  }
  return false;
}
