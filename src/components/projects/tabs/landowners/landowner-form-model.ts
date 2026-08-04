/**
 * Landowners tab — form model (pure, no React).
 *
 * Extracted from `ProjectLandownersTab` when it crossed 500 lines (N.7.1), but the
 * split earns its keep on its own: these four functions carry the invariants Σ1–Σ4
 * of ADR-745 Φ3α, and they are provable without rendering a component.
 *
 * @module components/projects/tabs/landowners/landowner-form-model
 * @enterprise ADR-244 (Landowners) · ADR-745 Φ3α
 */

import { isAcquisitionStatus } from '@/lib/ownership/landowner-acquisition';
import { allocateMillesimalsFromPercentages } from '@/lib/ownership/millesimal-apportionment';
import {
  type AcquisitionStatus,
  type LandownerEntry,
  type PropertyOwnerEntry,
} from '@/types/ownership-table';

/**
 * Acquisition status per landowner, keyed by `contactId` (ADR-745 Φ3α).
 *
 * Deliberately kept **outside** `PropertyOwnerEntry`: that type also describes
 * buyers in the sales domain (SellDialog, PaymentTab, …), which has no business
 * knowing about land acquisition. Keying by `contactId` is safe because a row
 * without a selected contact cannot carry a status — there is no person yet.
 */
export type AcquisitionStatusMap = Readonly<Record<string, AcquisitionStatus>>;

/**
 * LandownerEntry → PropertyOwnerEntry for OwnersList consumption.
 * Maps landOwnershipPct → ownershipPct, adds role + paymentPlanId.
 */
export function toPropertyOwners(entries: readonly LandownerEntry[]): PropertyOwnerEntry[] {
  return entries.map(e => ({
    contactId: e.contactId,
    name: e.name,
    ownershipPct: e.landOwnershipPct,
    role: 'landowner' as const,
    paymentPlanId: null,
  }));
}

/**
 * PropertyOwnerEntry → LandownerEntry for Firestore save.
 * Maps ownershipPct → landOwnershipPct, computes allocatedShares, and re-attaches
 * the acquisition status held alongside in `statuses`.
 *
 * The status key is omitted entirely when undeclared — absence is the signal
 * (ADR-745 Φ3α), and `stripUndefinedDeep` would drop an explicit `undefined` anyway.
 *
 * 🔴 `allocatedShares` is apportioned across the WHOLE list in one pass, never
 * row by row. Rounding each row on its own turned three siblings holding a third
 * each into 333 + 333 + 333 = 999‰ — a mismatch nobody typed, written straight
 * into Firestore. The apportionment itself is shared with the ownership tables
 * (`lib/ownership/millesimal-apportionment`), which is also where it is spelled
 * out why the target must follow the declared total instead of being pinned at
 * 1000: an incomplete declaration has to stay incomplete.
 */
export function toLandownerEntries(
  owners: readonly PropertyOwnerEntry[],
  statuses: AcquisitionStatusMap,
): LandownerEntry[] {
  const shares = allocateMillesimalsFromPercentages(owners.map(o => o.ownershipPct));
  return owners.map((o, index) => {
    const status = statuses[o.contactId];
    return {
      contactId: o.contactId,
      name: o.name,
      landOwnershipPct: o.ownershipPct,
      allocatedShares: shares[index],
      ...(status ? { acquisitionStatus: status } : {}),
    };
  });
}

/**
 * Σ3 — drop status entries whose contact is no longer in the list.
 *
 * Without this, `handleContactSelect` — which swaps `contactId` in place — leaves
 * an orphan key behind; if that contact is picked again later the old status
 * silently reappears on a row nobody declared. Returns the same object when
 * nothing was pruned, so React skips a needless re-render.
 */
export function pruneStatuses(
  statuses: AcquisitionStatusMap,
  owners: readonly PropertyOwnerEntry[],
): AcquisitionStatusMap {
  const live = new Set(owners.map(o => o.contactId).filter(Boolean));
  const keys = Object.keys(statuses);
  if (keys.every(id => live.has(id))) return statuses;

  const next: Record<string, AcquisitionStatus> = {};
  for (const id of keys) {
    if (live.has(id)) next[id] = statuses[id];
  }
  return next;
}

/**
 * Σ2 — check if the form has unsaved changes compared to persisted data.
 *
 * Includes acquisition status: without it, changing only a status leaves
 * `isDirty === false`, the Save button stays disabled, and the change is visible
 * on screen but impossible to persist.
 */
export function hasChanges(
  currentOwners: readonly PropertyOwnerEntry[],
  persistedEntries: readonly LandownerEntry[],
  formBartex: number | null,
  persistedBartex: number | null,
  currentStatuses: AcquisitionStatusMap,
): boolean {
  if (formBartex !== persistedBartex) return true;
  if (currentOwners.length !== persistedEntries.length) return true;
  return currentOwners.some((o, i) => {
    const pe = persistedEntries[i];
    return o.contactId !== pe?.contactId
      || o.name !== pe?.name
      || o.ownershipPct !== pe?.landOwnershipPct
      || currentStatuses[o.contactId] !== pe?.acquisitionStatus;
  });
}

/**
 * Σ4 — did anything change that the **ownership tables** care about?
 *
 * Deliberately ASYMMETRIC with {@link hasChanges}. This drives the impact dialog
 * warning that ownership-table snapshots have gone stale; acquisition status
 * touches neither percentages nor millesimals, so it must NOT appear here —
 * otherwise every status change raises a warning that does not apply.
 *
 * Naming it, instead of leaving it inline next to `hasChanges`, is the point: two
 * adjacent comparisons that look alike and must differ are exactly the kind of pair
 * someone later "fixes" into agreement.
 */
export function landownersMateriallyChanged(
  currentOwners: readonly PropertyOwnerEntry[],
  persistedEntries: readonly LandownerEntry[],
): boolean {
  if (currentOwners.length !== persistedEntries.length) return true;
  return currentOwners.some((o, i) => {
    const pe = persistedEntries[i];
    return o.contactId !== pe?.contactId || o.ownershipPct !== pe?.landOwnershipPct;
  });
}

/**
 * Σ1 — rebuild the status map from what was actually stored.
 *
 * 🔴 Without this the map starts empty on every page load, and the NEXT save —
 * even an unrelated one, e.g. changing only the bartex % — rewrites the whole
 * `landowners` array without any status. Firestore replaces array fields wholesale
 * (no per-element merge), so signatures already recorded would vanish with no
 * error and no message.
 *
 * Lives here rather than inline in the effect so it can be proven directly.
 */
export function rehydrateStatuses(
  entries: readonly LandownerEntry[],
): AcquisitionStatusMap {
  const rehydrated: Record<string, AcquisitionStatus> = {};
  for (const entry of entries) {
    if (entry.contactId && isAcquisitionStatus(entry.acquisitionStatus)) {
      rehydrated[entry.contactId] = entry.acquisitionStatus;
    }
  }
  return rehydrated;
}
