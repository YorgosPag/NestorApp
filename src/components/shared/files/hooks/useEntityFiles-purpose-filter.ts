/**
 * useEntityFiles-purpose-filter — client-side purpose filter helpers.
 *
 * Extracted from useEntityFiles.ts to honour the Google file-size limit
 * (Hook ≤500 lines). Behavior preserved verbatim.
 *
 * ADR-293 Phase 7 Batch 29:
 * - META_PHOTO_PURPOSES describes tab-level meta purposes. When a caller
 *   passes one (e.g. 'photo', 'building-photo'), the upload entry-point
 *   selector writes sub-purposes ('interior', 'exterior', 'maintenance',
 *   'facade') that would otherwise be excluded at the view layer. With a
 *   meta purpose, category+domain scope already restricts the set and no
 *   sub-purpose discrimination is desired.
 * - The '*-floorplan' strict semantics (generic 'floorplan' matches any
 *   sub-category like 'project-floorplan') is preserved.
 *
 * @module components/shared/files/hooks/useEntityFiles-purpose-filter
 */

import type { FileRecord } from '@/types/file-record';

/**
 * Tab-level meta purposes — see module docstring.
 */
export const META_PHOTO_PURPOSES: ReadonlySet<string> = new Set([
  'photo',
  'building-photo',
  'parking-photo',
  'storage-photo',
]);

/**
 * Build a predicate that matches a FileRecord against the caller's purpose
 * filter. `undefined` purpose → no filter (accept all).
 */
export function buildPurposeFilter(
  purpose: string | undefined,
): (file: FileRecord) => boolean {
  return (file: FileRecord): boolean => {
    if (!purpose) return true;
    if (!file.purpose) return true;
    if (file.purpose === purpose) return true;
    if (META_PHOTO_PURPOSES.has(purpose)) return true;
    if (file.purpose === 'floorplan' && purpose.endsWith('-floorplan')) return true;
    return false;
  };
}
