/**
 * 🛡️ PROPERTY FIELD LOCKING — Shared Utility (ADR-249 P0-2)
 *
 * Validates that locked fields on sold/rented/reserved properties cannot be modified.
 * Extracted from units/[id]/route.ts for reuse across multiple endpoints.
 *
 * Legal requirement: After sale/reservation, critical fields (cadastre, tax office,
 * contracts) must remain immutable.
 *
 * @module lib/firestore/property-field-locking
 * @enterprise ADR-249 SPEC-249A — Critical Server Guards
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  isEditorCommercialStatus,
  isTransactionOwnedCommercialStatus,
  normalizeCommercialStatus,
} from '@/constants/commercial-statuses';
// Η ΜΙΑ λίστα κλειδωμάτων — κοινή με τον πελάτη (ADR-898 Φ3β-3: ήταν δύο αντίγραφα «keep both in sync»).
import { lockedFieldsAttempted, REVERT_ALLOWED_FIELDS } from '@/lib/property/property-locked-fields';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validates that no locked fields are being modified on a property with a given commercialStatus.
 *
 * @param commercialStatus - Current commercialStatus of the property document
 * @param updateKeys - Keys present in the update payload (Object.keys(body))
 * @throws ApiError(403) if any locked field is present in updateKeys
 */
export function validatePropertyFieldLocking(
  commercialStatus: string | null | undefined,
  updateKeys: readonly string[]
): void {
  const attempted = lockedFieldsAttempted(commercialStatus, updateKeys);
  if (attempted.length > 0) {
    throw new ApiError(403, `Cannot modify locked fields on a ${commercialStatus} property: ${attempted.join(', ')}`);
  }
}

/**
 * Detects whether an incoming PATCH body represents the legitimate sale-revert
 * transition (reserved/sold → for-sale). Strict contract (mirrors client in
 * `services/property/property-mutation-gateway.ts#revertPropertySaleWithPolicy`):
 *   - Current status must be `reserved` or `sold`.
 *   - `body.commercialStatus` must equal `'for-sale'`.
 *   - All body keys must be in `REVERT_ALLOWED_FIELDS` ({ commercialStatus, commercial }).
 */
export function isPropertyRevertTransition(
  currentStatus: string | null | undefined,
  body: Record<string, unknown>,
): boolean {
  if (currentStatus !== 'reserved' && currentStatus !== 'sold') return false;
  if (body.commercialStatus !== 'for-sale') return false;

  const bodyKeys = Object.keys(body);
  if (bodyKeys.length === 0) return false;

  return bodyKeys.every((key) => REVERT_ALLOWED_FIELDS.has(key));
}

/**
 * 🛡️ **Έξοδος από συναλλαγή μόνο από τη δική της πράξη** (ADR-777 §8.60.20).
 *
 * Το `SOLD_LOCKED_FIELDS` κλειδώνει το `commercialStatus` για `sold`/`rented`, αλλά το
 * `RESERVED_LOCKED_FIELDS` **όχι** — άρα ως τις 2026-09-18 ένα PATCH `reserved → for-rent` ή
 * `→ unavailable` περνούσε, και το ακίνητο έβγαινε από την κράτηση **με τον αγοραστή ακόμη
 * γραμμένο**. Ο ίδιος κανόνας που φυλάει ήδη τους χώρους (`mapSpaceCommercialFields`, §8.60.18),
 * με τα **ίδια** κατηγορήματα — όχι δεύτερη λίστα.
 *
 * Επιτρέπονται: ίδια κατάσταση (ιδεμπότητα — `ChangePriceDialog`) · συναλλαγή → συναλλαγή
 * (`reserved → sold`, την ελέγχει το `validateCommercialTransaction`) · η επίσημη ακύρωση
 * (`isPropertyRevertTransition`, ελέγχεται **πριν** από εδώ).
 *
 * @throws ApiError(409) όταν μια φόρμα επιχειρεί να βγάλει μονάδα από συναλλαγή.
 */
export function validateTransactionExit(
  currentStatus: string | null | undefined,
  body: Record<string, unknown>,
): void {
  if (body.commercialStatus === undefined) return;
  const current = normalizeCommercialStatus(currentStatus);
  const requested = normalizeCommercialStatus(body.commercialStatus);
  if (!isTransactionOwnedCommercialStatus(current)) return;
  // Ίδια κατάσταση ή συναλλαγή → συναλλαγή: και τα δύο ΔΕΝ είναι κατάσταση επεξεργαστή ⇒ περνούν εδώ
  // (ένας ξεχωριστός έλεγχος «ίδια κατάσταση» ήταν περιττός — ισοδύναμη μετάλλαξη M14).
  if (!isEditorCommercialStatus(requested)) return;
  throw new ApiError(
    409,
    `Cannot move a ${current} property to ${requested} from an editor; revert the transaction first`,
  );
}

/**
 * Convenience wrapper: runs `validatePropertyFieldLocking` UNLESS the body
 * matches `isPropertyRevertTransition`. Keeps PATCH handlers concise while
 * preserving the defense-in-depth guard — the revert flow is the ONE
 * sanctioned way to flip `commercialStatus` on a locked property.
 */
export function validatePropertyFieldLockingUnlessRevert(
  currentStatus: string | null | undefined,
  body: Record<string, unknown>,
): void {
  if (isPropertyRevertTransition(currentStatus, body)) return;
  validatePropertyFieldLocking(currentStatus, Object.keys(body));
  validateTransactionExit(currentStatus, body);
}
