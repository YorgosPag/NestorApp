/**
 * Pure helpers for ADR-330 Phase 5.5 server-side FA discount validation.
 *
 * Lives in its own module — with no `server-only` import and no Firebase
 * Admin dependency — so the math can be unit-tested under jest's jsdom
 * environment. The server wrapper `recompute-fa-discount.ts` imports from
 * here and adds the Firestore-loading layer.
 *
 * Pattern mirrors `functions/src/procurement/material-price-sync-pure.ts`.
 *
 * @module lib/procurement/recompute-fa-discount-pure
 * @enterprise ADR-330 Phase 5.5
 */

import {
  resolveActiveFa,
  computeFaDiscount,
} from '@/subapps/procurement/utils/framework-agreement-discount';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

export interface FaDiscountFields {
  appliedFaId: string | null;
  faDiscountPercent: number | null;
  faDiscountAmount: number | null;
  netTotal: number | null;
}

export const EMPTY_FA_RESULT: FaDiscountFields = {
  appliedFaId: null,
  faDiscountPercent: null,
  faDiscountAmount: null,
  netTotal: null,
};

/**
 * Compute the gross total (subtotal + tax) for a PO from items + tax rate.
 * Mirrors the formula used in `procurement-repository.createPurchaseOrder`
 * and `procurement-service.updatePO` so the FA discount applies to the same
 * value the user sees in the form.
 */
export function computeGrossTotal(
  items: ReadonlyArray<{ quantity: number; unitPrice: number }>,
  taxRate: number,
): number {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  return Math.round((subtotal + taxAmount) * 100) / 100;
}

/**
 * Pure computation of the four FA discount fields given a pre-loaded
 * agreements list. Returns empty/null fields when:
 *   - `supplierId` or `projectId` is missing
 *   - `grossTotal` is non-positive
 *   - no active FA matches the (supplier, project) pair
 *
 * Exported for unit tests. Production callers should use the server wrapper
 * `loadAndComputeFaDiscount()` which fetches the agreements list itself.
 */
export function computeFaDiscountFields(
  agreements: FrameworkAgreement[],
  supplierId: string | null | undefined,
  projectId: string | null | undefined,
  grossTotal: number,
): FaDiscountFields {
  if (!supplierId || !projectId || grossTotal <= 0) {
    return EMPTY_FA_RESULT;
  }
  const fa = resolveActiveFa(agreements, supplierId, projectId);
  if (!fa) return EMPTY_FA_RESULT;

  const { discountPercent, discountAmount, netTotal } = computeFaDiscount(
    fa,
    grossTotal,
  );
  return {
    appliedFaId: fa.id,
    faDiscountPercent: discountPercent,
    faDiscountAmount: discountAmount,
    netTotal,
  };
}
