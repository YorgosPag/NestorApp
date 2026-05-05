/**
 * =============================================================================
 * ADDRESS EDITOR — Field Diff Helper (ADR-332 Phase 1)
 * =============================================================================
 *
 * Compares a user-entered `ResolvedAddressFields` snapshot against the
 * Nominatim-resolved counterpart and produces a list of conflicts to feed
 * the Reconciliation Panel (Phase 2/4) and per-field badges (Phase 3).
 *
 * Comparison rules:
 *   - Case-insensitive (Greek + Latin) via `normalizeGreekText`.
 *   - Trim whitespace.
 *   - Ignore fields where either side is empty (handled by FieldMatchKind
 *     `unknown` / `not-provided`, not as conflicts).
 *
 * @module components/shared/addresses/editor/helpers/diffAddressFields
 * @see ADR-332 §3.5 Reconciliation logic
 */

import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import type { AddressFieldConflict, ResolvedAddressFields } from '../types';

const COMPARABLE_FIELDS: ReadonlyArray<keyof ResolvedAddressFields> = [
  'street',
  'number',
  'postalCode',
  'neighborhood',
  'city',
  'county',
  'region',
  'country',
];

function normalize(value: string | undefined): string {
  if (!value) return '';
  return normalizeGreekText(value.trim()).toLowerCase();
}

function isConflict(userValue: string | undefined, resolvedValue: string | undefined): boolean {
  const user = normalize(userValue);
  const resolved = normalize(resolvedValue);
  if (user.length === 0 || resolved.length === 0) return false;
  return user !== resolved;
}

/**
 * Returns one entry per field where user vs resolved disagree (both non-empty).
 * Empty user fields or empty resolved fields are NOT conflicts (different
 * semantic — handled by `unknown` / `not-provided` field-status badges).
 */
export function diffAddressFields(
  userInput: ResolvedAddressFields,
  resolved: ResolvedAddressFields,
): AddressFieldConflict[] {
  const conflicts: AddressFieldConflict[] = [];
  for (const field of COMPARABLE_FIELDS) {
    const userValue = userInput[field];
    const resolvedValue = resolved[field];
    if (isConflict(userValue, resolvedValue)) {
      conflicts.push({
        field,
        userValue: (userValue ?? '').trim(),
        resolvedValue: (resolvedValue ?? '').trim(),
      });
    }
  }
  return conflicts;
}

/**
 * Convenience predicate — true when at least one comparable field disagrees.
 */
export function hasFieldConflicts(
  userInput: ResolvedAddressFields,
  resolved: ResolvedAddressFields,
): boolean {
  return diffAddressFields(userInput, resolved).length > 0;
}
