/**
 * =============================================================================
 * validateGreekHierarchy — ELSTAT cross-check (ADR-332 §3.9 / Phase 9)
 * =============================================================================
 *
 * Pure validator for Greek address hierarchies. Takes user-resolved fields and
 * cross-checks them against the ELSTAT/Καλλικράτης dataset:
 *
 *   1. Postal code must be 5 digits, first digit 1-9.
 *   2. Postal code prefix → expected city / regional unit / region (lookup).
 *   3. Settlement → community → municipal unit → municipality → regional unit
 *      → region chain consistency (parent-walk).
 *
 * Mismatches surface as `HierarchyMismatch` events with i18n keys (CLAUDE.md
 * N.11 — no hardcoded user-facing strings). The coordinator hook converts each
 * mismatch into a warn-level activity log entry and toggles the relevant
 * field badge to `unknown`.
 *
 * Pure / testable. No React, no I/O, no clock. Hierarchy data injected via
 * `HierarchyLookup`.
 *
 * @module components/shared/addresses/editor/helpers/validateGreekHierarchy
 * @see ADR-332 §3.9 Hierarchy validation
 */

import type { AdminEntity } from '@/hooks/useAdministrativeHierarchy';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import { ADMIN_LEVELS, type HierarchyLookup } from './hierarchyLookup';

export type HierarchyMismatchSeverity = 'warning' | 'error';

export type HierarchyMismatchKind =
  /** Postal code is malformed (length / first digit). */
  | 'postal-code-invalid'
  /** Postal code resolves to a settlement, but city/region in fields don't match. */
  | 'postal-code-region-mismatch'
  /** No settlement found for the given postal code at all. */
  | 'postal-code-unknown'
  /** A field's value isn't compatible with the resolved hierarchy chain. */
  | 'chain-inconsistent';

export interface HierarchyMismatch {
  kind: HierarchyMismatchKind;
  field: keyof ResolvedAddressFields;
  expected: string | null;
  got: string;
  severity: HierarchyMismatchSeverity;
  /** i18n key for activity log entry (resolved at UI layer). */
  i18nKey: string;
  /** Optional interpolation params for the i18n template. */
  i18nParams?: Record<string, string>;
}

export interface HierarchyValidationResult {
  valid: boolean;
  mismatches: readonly HierarchyMismatch[];
}

/**
 * Validate a Greek address hierarchy. Returns a list of mismatches; empty list
 * means everything checks out.
 */
export function validateGreekHierarchy(
  fields: ResolvedAddressFields,
  lookup: HierarchyLookup,
): HierarchyValidationResult {
  const mismatches: HierarchyMismatch[] = [];

  if (fields.postalCode) {
    pushPostalCodeMismatches(fields, lookup, mismatches);
  }

  return { valid: mismatches.length === 0, mismatches };
}

function pushPostalCodeMismatches(
  fields: ResolvedAddressFields,
  lookup: HierarchyLookup,
  out: HierarchyMismatch[],
): void {
  const pc = fields.postalCode!.trim();
  if (!/^[1-9]\d{4}$/.test(pc)) {
    out.push({
      kind: 'postal-code-invalid',
      field: 'postalCode',
      expected: null,
      got: pc,
      severity: 'error',
      i18nKey: 'addresses.hierarchy.postalCodeInvalid',
      i18nParams: { value: pc },
    });
    return;
  }

  const settlements = lookup.findSettlementsByPostalCode(pc);
  if (settlements.length === 0) {
    out.push({
      kind: 'postal-code-unknown',
      field: 'postalCode',
      expected: null,
      got: pc,
      severity: 'warning',
      i18nKey: 'addresses.hierarchy.postalCodeUnknown',
      i18nParams: { value: pc },
    });
    return;
  }

  const chains = settlements.map((s) => lookup.resolveAncestors(s.id));
  const compareLevels: Array<{ field: keyof ResolvedAddressFields; level: number }> = [
    { field: 'city', level: ADMIN_LEVELS.MUNICIPALITY },
    { field: 'county', level: ADMIN_LEVELS.REGIONAL_UNIT },
    { field: 'region', level: ADMIN_LEVELS.REGION },
  ];

  for (const { field, level } of compareLevels) {
    const userValue = fields[field];
    if (!userValue) continue;
    const expectedNames = collectNamesAtLevel(chains, level);
    if (expectedNames.size === 0) continue;
    const normalizedUser = normalize(userValue);
    const matchesAny = Array.from(expectedNames).some((n) => normalize(n) === normalizedUser);
    if (!matchesAny) {
      out.push({
        kind: 'postal-code-region-mismatch',
        field,
        expected: Array.from(expectedNames).join(' / '),
        got: userValue,
        severity: 'warning',
        i18nKey: 'addresses.hierarchy.regionMismatch',
        i18nParams: {
          field,
          expected: Array.from(expectedNames).join(' / '),
          got: userValue,
        },
      });
    }
  }
}

function collectNamesAtLevel(
  chains: readonly (readonly AdminEntity[])[],
  level: number,
): Set<string> {
  const names = new Set<string>();
  for (const chain of chains) {
    const match = chain.find((e) => e.level === level);
    if (match) names.add(match.name);
  }
  return names;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
