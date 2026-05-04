/**
 * =============================================================================
 * PROCUREMENT: Server-Side Framework Agreement Discount Recomputation
 * =============================================================================
 *
 * Authoritative server-side computation of the four FA discount fields stored
 * on a Purchase Order: `appliedFaId`, `faDiscountPercent`, `faDiscountAmount`,
 * `netTotal`. The PO form sends client-side values for live UX preview, but
 * those values are discarded server-side and replaced with values computed
 * here from the canonical Framework Agreement collection.
 *
 * This is the tamper-proof guarantee for ADR-330 Phase 5.5: a malicious client
 * cannot save a PO with `faDiscountPercent: 50` when the active FA only
 * grants 10%. The CF-variant alternative (Firestore `onWrite` trigger) was
 * rejected during Phase C planning (2026-05-04) because:
 *   - SAP / Oracle / Procore all do request-time validation
 *   - There is exactly one write path (this API), so a CF would be redundant
 *   - Request-time validation gives the user instant feedback on save
 *
 * Pure math + override semantics live in `recompute-fa-discount-pure.ts` so
 * they can be unit-tested without booting Firebase Admin.
 *
 * @module lib/procurement/recompute-fa-discount
 * @enterprise ADR-330 Phase 5.5 (server-side validation, 2026-05-04)
 */

import 'server-only';

import { listFrameworkAgreements } from '@/subapps/procurement/services/framework-agreement-service';
import type { AuthContext } from '@/lib/auth';
import {
  computeFaDiscountFields,
  EMPTY_FA_RESULT,
  type FaDiscountFields,
} from './recompute-fa-discount-pure';

export {
  computeGrossTotal,
  computeFaDiscountFields,
  type FaDiscountFields,
} from './recompute-fa-discount-pure';

/**
 * Loads the supplier's framework agreements from Firestore and returns the
 * authoritative FA discount fields for the given (supplier, project, total).
 *
 * Filters the query at DB level by `vendorContactId` to keep the in-memory
 * working set small. Status / project / date validity is applied in memory
 * via `resolveActiveFa()`.
 */
export async function loadAndComputeFaDiscount(
  ctx: AuthContext,
  supplierId: string | null | undefined,
  projectId: string | null | undefined,
  grossTotal: number,
): Promise<FaDiscountFields> {
  if (!supplierId || !projectId || grossTotal <= 0) {
    return EMPTY_FA_RESULT;
  }

  const agreements = await listFrameworkAgreements(ctx, {
    vendorContactId: supplierId,
  });
  return computeFaDiscountFields(agreements, supplierId, projectId, grossTotal);
}
