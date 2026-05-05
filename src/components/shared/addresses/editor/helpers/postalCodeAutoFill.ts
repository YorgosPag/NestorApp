/**
 * =============================================================================
 * postalCodeAutoFill — derive admin geography from Greek postal code (ADR-332 §4 Phase 9)
 * =============================================================================
 *
 * Pure resolver that maps a 5-digit Greek postal code to the lowest unique
 * administrative chain. Powers the "type postal code → city auto-fills"
 * UX (ADR-332 §4 Phase 9 deliverable, Google Address Autocomplete equivalent).
 *
 * Implementation:
 *   - Looks up settlements (level 8) whose `postalCode` matches the input.
 *   - Walks the parent chain to gather city / regional unit / region.
 *   - When multiple settlements share the same postal code (common in rural
 *     regions of Greece), the helper still returns the chain that is *common*
 *     to every match — i.e. if all 4 settlements roll up to the same
 *     municipality, that municipality is reported; otherwise the field is
 *     left empty so the user can disambiguate manually.
 *
 * Pure / testable. Real data injected via `HierarchyLookup` (see
 * `hierarchyLookup.ts`).
 *
 * @module components/shared/addresses/editor/helpers/postalCodeAutoFill
 * @see ADR-332 §4 Phase 9
 */

import type { AdminEntity } from '@/hooks/useAdministrativeHierarchy';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import { ADMIN_LEVELS, type HierarchyLookup } from './hierarchyLookup';

export interface PostalCodeAutoFillResult {
  postalCode: string;
  /** Settlement-level matches (may be >1 for shared postal codes). */
  settlementCandidates: readonly AdminEntity[];
  /** Address fields safe to auto-fill (only common ancestors). */
  fields: Partial<Pick<ResolvedAddressFields, 'city' | 'county' | 'region' | 'country'>>;
}

/** Minimal validity check for a Greek postal code (5 digits, first digit 1-9). */
export function isValidGreekPostalCode(postalCode: string): boolean {
  return /^[1-9]\d{4}$/.test(postalCode);
}

/**
 * Resolve a postal code to its administrative chain, returning only ancestors
 * shared by every settlement that matches. Returns `null` if the postal code
 * is malformed or no settlement matches.
 */
export function autoFillFromPostalCode(
  postalCode: string,
  lookup: HierarchyLookup,
): PostalCodeAutoFillResult | null {
  if (!isValidGreekPostalCode(postalCode)) return null;

  const settlements = lookup.findSettlementsByPostalCode(postalCode);
  if (settlements.length === 0) return null;

  const ancestorChains = settlements.map((s) => lookup.resolveAncestors(s.id));
  const common = intersectAncestors(ancestorChains);

  return {
    postalCode,
    settlementCandidates: settlements,
    fields: {
      ...(pick(common, ADMIN_LEVELS.MUNICIPALITY) && { city: pick(common, ADMIN_LEVELS.MUNICIPALITY)!.name }),
      ...(pick(common, ADMIN_LEVELS.REGIONAL_UNIT) && { county: pick(common, ADMIN_LEVELS.REGIONAL_UNIT)!.name }),
      ...(pick(common, ADMIN_LEVELS.REGION) && { region: pick(common, ADMIN_LEVELS.REGION)!.name }),
      country: 'Ελλάδα',
    },
  };
}

function intersectAncestors(chains: readonly (readonly AdminEntity[])[]): AdminEntity[] {
  if (chains.length === 0) return [];
  const [first, ...rest] = chains;
  return first.filter((entity) =>
    rest.every((chain) => chain.some((e) => e.id === entity.id)),
  );
}

function pick(chain: readonly AdminEntity[], level: number): AdminEntity | undefined {
  return chain.find((e) => e.level === level);
}
