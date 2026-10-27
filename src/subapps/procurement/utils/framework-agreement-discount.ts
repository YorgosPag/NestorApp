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
import { majorFromMinor, minorFromMajor } from '@/lib/money/money';
import {
  applyDiscountSteps,
  basisPointsFromPercent,
  effectivePercent,
  stepsForBasis,
  type BasisPoints,
  type DiscountRule,
  type DiscountTier,
} from '@/lib/pricing/discount-rule';

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

/** Ποσοστό σύμβασης → αλυσίδα ενός βήματος· μη αναπαραστάσιμο ποσοστό ⇒ καμία έκπτωση, με διάγνωση. */
function stepsOfPercent(fa: FrameworkAgreementLike, percent: number): BasisPoints[] {
  const bp = basisPointsFromPercent(percent);
  if (bp === null) {
    logger.warn('Framework agreement has an unrepresentable discount percent — no discount applied', {
      agreementId: fa.id,
      percent,
    });
    return [];
  }
  return [bp];
}

/**
 * Η σύμβαση ως κανόνας της ΜΙΑΣ μηχανής εκπτώσεων (ADR-923 §5.11): `flat` = αλυσίδα ενός
 * βήματος · `volume_breakpoints` = κλίμακες πάνω στο **ποσό** (σε λεπτά).
 */
function faDiscountRule(fa: FrameworkAgreementLike): DiscountRule {
  if (fa.discountType === 'flat') {
    return { kind: 'chain', steps: stepsOfPercent(fa, fa.flatDiscountPercent ?? 0) };
  }
  const tiers: DiscountTier[] = [];
  for (const breakpoint of fa.volumeBreakpoints) {
    const min = minorFromMajor(breakpoint.thresholdEur);
    if (min !== null) tiers.push({ min, steps: stepsOfPercent(fa, breakpoint.discountPercent) });
  }
  return { kind: 'tiers', basis: 'amount', tiers };
}

/**
 * Compute discount amount and net total for a given FA and gross total.
 * Volume breakpoints: finds the highest applicable threshold.
 *
 * Προσαρμογέας πάνω στη μία μηχανή (`lib/pricing/discount-rule`): η αριθμητική γίνεται σε
 * ακέραια λεπτά, η υπογραφή σε ευρώ μένει για τους υπάρχοντες καλούντες.
 */
export function computeFaDiscount(
  fa: FrameworkAgreementLike,
  grossTotal: number,
): FADiscountResult {
  const grossMinor = minorFromMajor(grossTotal);
  if (grossMinor === null) return { discountPercent: 0, discountAmount: 0, netTotal: grossTotal };

  const steps = stepsForBasis(faDiscountRule(fa), grossMinor);
  const { discount, net } = applyDiscountSteps(grossMinor, steps);
  return {
    discountPercent: effectivePercent(steps),
    discountAmount: majorFromMinor(discount),
    netTotal: majorFromMinor(net),
  };
}
