/**
 * Vendor suggestion ranking for the invite multi-select dialog.
 * §5.Y.3 — category-based suggestions with graceful fallback.
 *
 * Uses VendorContactOption (id + displayName + email) as returned by
 * useVendorInvites. Tag-based suggestions require richer contact data;
 * graceful fallback (flat alphabetical) fires when tags are absent.
 *
 * @module subapps/procurement/utils/vendor-suggestions
 * @see ADR-328 §5.Y.3
 */

import type { VendorContactOption } from '@/subapps/procurement/hooks/useVendorInvites';

export interface VendorBucket {
  suggested: VendorContactOption[];
  others: VendorContactOption[];
}

// Contacts with optional tag data (richer fetch, future extension)
interface TaggedVendor extends VendorContactOption {
  tags?: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function byName(a: VendorContactOption, b: VendorContactOption): number {
  return a.displayName.localeCompare(b.displayName, 'el');
}

function tagMatchesCategory(tag: string, category: string): boolean {
  const t = tag.toLowerCase().trim();
  const c = category.toLowerCase().trim();
  return t.includes(c) || c.includes(t);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Rank vendors into 'suggested' (category match) and 'others' (rest).
 * Excludes already-invited vendor IDs.
 * When no category or no tag data → all vendors go to 'others' (flat alphabetical).
 */
export function rankVendors(
  rfqCategory: string | null | undefined,
  allVendors: VendorContactOption[],
  alreadyInvitedIds: Set<string>,
): VendorBucket {
  const eligible = allVendors.filter((v) => !alreadyInvitedIds.has(v.id));

  const taggedVendors = eligible as TaggedVendor[];
  if (!rfqCategory || !taggedVendors.some((v) => v.tags?.length)) {
    return { suggested: [], others: eligible.sort(byName) };
  }

  const matches = taggedVendors.filter((v) =>
    v.tags?.some((tag) => tagMatchesCategory(tag, rfqCategory)),
  );

  return {
    suggested: matches.sort(byName),
    others: eligible.filter((v) => !matches.find((m) => m.id === v.id)).sort(byName),
  };
}
