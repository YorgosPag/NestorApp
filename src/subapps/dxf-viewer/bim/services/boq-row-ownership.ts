/**
 * @module bim/services/boq-row-ownership
 * @description Who owns which field of a BIM-managed BOQ row (ADR-917 Λ10 · ADR-363 §6.1).
 *
 * The model owns what it can MEASURE or DERIVE: identity, context, category/title/unit, quantity, grouping.
 * Everything the base row can only fill with a constant default (`buildBoqBaseRow`: zero prices, `null`
 * links, `status: 'draft'`, …) is something the model does NOT know — it belongs to the human once the row
 * exists. Revit does the same: a type/instance parameter typed by the user survives every change of the
 * geometry that drives the quantities.
 *
 * 🔴 Before this module every sync wrote the WHOLE default row (`setDoc` without merge) ⇒ a unit price typed
 * on a wall layer vanished at the next move of the wall, and a `submitted` row fell back to `draft`.
 *
 * Exception (Ε2): on a SUMMARY parent the prices are not the human's — the parent's cost IS the sum of its
 * layers (Autodesk Build: «subitems contribute to the total of the parent»). The model writes them (0), so a
 * legacy price left on a summary is cleaned by the next sync instead of being preserved.
 */

import type { BoqBaseRow } from './boq-base-row';

/** Fields the model cannot know — kept from the stored row on every sync. */
export const HUMAN_OWNED_BOQ_FIELDS = [
  'linkedUnitId',
  'linkedUnitIds',
  'costAllocationMethod',
  'customAllocations',
  'subCategoryCode',
  'description',
  'actualQuantity',
  'wasteFactor',
  'wastePolicy',
  'materialUnitCost',
  'laborUnitCost',
  'equipmentUnitCost',
  'priceAuthority',
  'linkedPhaseId',
  'linkedTaskId',
  'linkedInvoiceId',
  'linkedContractorId',
  'status',
  'qaStatus',
  'notes',
  'createdBy',
  'approvedBy',
] as const satisfies readonly (keyof BoqBaseRow)[];

/** The price of a summary parent is DERIVED from its layers (Ε2) — never preserved as the human's. */
export const SUMMARY_DERIVED_PRICE_FIELDS = ['materialUnitCost', 'laborUnitCost', 'equipmentUnitCost'] as const;

const SUMMARY_DERIVED: ReadonlySet<string> = new Set(SUMMARY_DERIVED_PRICE_FIELDS);

/**
 * The payload the sync writes: the model's freshly built row, with every human-owned field taken from the
 * stored row when it exists. No stored row ⇒ the payload as built (the defaults ARE the starting point).
 */
export function withHumanOwnedFields(
  payload: Record<string, unknown>,
  stored: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!stored) return payload;
  const isSummary = payload.groupRole === 'summary';
  const merged: Record<string, unknown> = { ...payload };
  for (const field of HUMAN_OWNED_BOQ_FIELDS) {
    if (isSummary && SUMMARY_DERIVED.has(field)) continue;
    if (Object.prototype.hasOwnProperty.call(stored, field) && stored[field] !== undefined) merged[field] = stored[field];
  }
  return merged;
}
