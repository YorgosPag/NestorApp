/**
 * Pure helpers for the Material Price Sync trigger.
 *
 * Lives in its own module — with no `firebase-functions` / `firebase-admin`
 * imports — so the helpers can be unit-tested under jest's jsdom environment
 * without booting the Cloud Functions runtime. The CF module imports from here.
 *
 * Pattern mirrors `functions/src/audit/resolve-action.ts`.
 *
 * @module functions/procurement/material-price-sync-pure
 * @enterprise ADR-330 Phase 4.5 (Cloud Function variant)
 */

export type POStatus =
  | 'draft'
  | 'approved'
  | 'ordered'
  | 'partially_delivered'
  | 'delivered'
  | 'closed'
  | 'cancelled';

/**
 * Decides whether a Firestore `onUpdate` payload represents a `* → delivered`
 * transition. Returns `false` if the PO was already delivered (no retrigger).
 */
export function shouldTriggerSync(
  beforeStatus: POStatus | null | undefined,
  afterStatus: POStatus | null | undefined,
): boolean {
  return beforeStatus !== 'delivered' && afterStatus === 'delivered';
}

/**
 * Rolling-mean update for material avgPrice. First purchase seeds the average
 * with the new unit price; subsequent purchases blend 50/50 with the previous
 * average. Result is rounded to 2 decimals (cents).
 */
export function computeNewAvgPrice(
  currentAvg: number | null,
  newUnitPrice: number,
): number {
  if (currentAvg == null) return newUnitPrice;
  return Math.round(((currentAvg + newUnitPrice) / 2) * 100) / 100;
}
