/**
 * Framework Agreement discount computation — ADR-330 Phase 5.5
 *
 * Deterministic functions. No state, no hooks. Η μόνη παρενέργεια είναι
 * διαγνωστικό `logger.warn` όταν μια συμφωνία έχει μη αναγνώσιμο εύρος ισχύος
 * (ADR-218 §Phase 4) — δεν επηρεάζει το αποτέλεσμα, δεν φτάνει στον χρήστη.
 * Used by usePOFrameworkAgreement to resolve and compute discounts.
 */

import type { FrameworkAgreementLike } from '../types/framework-agreement';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FrameworkAgreementDiscount');

export interface FADiscountResult {
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
}

/**
 * Find the first active Framework Agreement matching vendor + project scope.
 * Validates: status=active, date range, project scope, not deleted.
 */
export function resolveActiveFa(
  agreements: readonly FrameworkAgreementLike[],
  supplierId: string,
  projectId: string,
): FrameworkAgreementLike | null {
  if (!supplierId || !projectId) return null;

  const now = Date.now();

  return (
    agreements.find((fa) => {
      if (fa.status !== 'active') return false;
      if (fa.isDeleted) return false;
      if (fa.vendorContactId !== supplierId) return false;

      // ⚠️ ADR-218 §Phase 4 — μη αναγνώσιμο εύρος ισχύος ΔΕΝ σημαίνει «ισχύει».
      // Πριν, το `toMs()` επέστρεφε `NaN` και οι δύο συγκρίσεις παρακάτω έβγαζαν
      // `false` (κάθε σύγκριση με NaN είναι false) ⇒ η συμφωνία περνούσε ως
      // **μονίμως ενεργή** και εφαρμοζόταν έκπτωση που έπρεπε να έχει λήξει.
      const from = normalizeToMillisOrNull(fa.validFrom);
      const until = normalizeToMillisOrNull(fa.validUntil);
      if (from === null || until === null) {
        logger.warn('Framework agreement has an unreadable validity range — treated as not active', {
          agreementId: fa.id,
          validFrom: String(fa.validFrom),
          validUntil: String(fa.validUntil),
        });
        return false;
      }
      if (now < from || now > until) return false;

      // null = all projects; [] = no projects; list = specific projects
      if (
        fa.applicableProjectIds !== null &&
        fa.applicableProjectIds.length > 0 &&
        !fa.applicableProjectIds.includes(projectId)
      ) {
        return false;
      }

      return true;
    }) ?? null
  );
}

/**
 * Compute discount amount and net total for a given FA and gross total.
 * Volume breakpoints: finds the highest applicable threshold.
 */
export function computeFaDiscount(
  fa: FrameworkAgreementLike,
  grossTotal: number,
): FADiscountResult {
  let discountPercent = 0;

  if (fa.discountType === 'flat') {
    discountPercent = fa.flatDiscountPercent ?? 0;
  } else {
    const sorted = [...fa.volumeBreakpoints].sort(
      (a, b) => a.thresholdEur - b.thresholdEur,
    );
    for (const bp of sorted) {
      if (grossTotal >= bp.thresholdEur) {
        discountPercent = bp.discountPercent;
      }
    }
  }

  const discountAmount = Math.round(grossTotal * (discountPercent / 100) * 100) / 100;
  const netTotal = Math.round((grossTotal - discountAmount) * 100) / 100;

  return { discountPercent, discountAmount, netTotal };
}
