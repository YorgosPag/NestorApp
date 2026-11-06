/**
 * @fileoverview Entity Tax — ο ΕΝΑΣ υπολογισμός φόρου οντότητας (ΟΕ / ΕΠΕ / ΑΕ)
 * @description Pure helper: φόρος 22% επί του κέρδους της οντότητας, προκαταβολή με εξηγήσιμη βάση,
 *   τέλος επιτηδεύματος, και διανομή στους δικαιούχους με την παρακράτηση της μορφής/βιβλίων.
 *
 *   Ως τις 2026-11-06 η ΟΕ υπολογιζόταν **διαφανώς** (κάθε εταίρος με την κλίμακα φυσικών προσώπων, 55%)·
 *   ο νόμος τη φορολογεί ως **οντότητα** (ν.4172/2013 άρθρα 45 §1, 47, 58) με προκαταβολή 80% (άρθρο 71 §1).
 *   Τώρα οι τρεις μορφές περνούν από **αυτή** τη συνάρτηση — οι μέθοδοι του `TaxEngine` είναι προσαρμογείς
 *   ονομάτων (εταίροι / μέλη / μέτοχοι).
 *
 * @see ADR-ACC-009 · ADR-ACC-012 · ADR-ACC-014 · ADR-ACC-016 · ADR-ACC-024 §6
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import type {
  CorporateTaxResult,
  DistributionCoverage,
  EntityHolder,
  EntityTaxInput,
  EPETaxResult,
  LegalEntityType,
  MemberDividendResult,
} from '../../../types/tax';
import { roundToTwo } from '../../../utils/math';
import { isCompleteShareSum } from '../../../utils/share-sum';
import {
  getCorporateTaxRate,
  getDistributionWithholdingRate,
  getProfessionalTaxForEntity,
} from '../../config/tax-config';
import { resolvePrepayment } from '../../tax/prepayment-policy';

/** Διανομή σε έναν δικαιούχο — ουδέτερο σχήμα, ο `TaxEngine` το μεταφράζει σε εταίρο/μέλος/μέτοχο. */
export interface HolderDistribution {
  readonly holder: EntityHolder;
  readonly gross: number;
  readonly withholdingRate: number;
  readonly withholdingAmount: number;
  readonly net: number;
}

/** Πλήρες αποτέλεσμα φόρου οντότητας πριν από τη μετονομασία ανά μορφή. */
export interface EntityTaxComputation {
  readonly corporateTax: CorporateTaxResult;
  readonly profitAfterTax: number;
  readonly distributed: number;
  readonly retained: number;
  readonly distributions: readonly HolderDistribution[];
  readonly totalWithholding: number;
  readonly coverage: DistributionCoverage;
}

/** Ο φόρος της οντότητας: 22% · προκαταβολή κατά την έναρξη · τέλος επιτηδεύματος. */
function corporateTaxOf(entityType: LegalEntityType, input: EntityTaxInput): CorporateTaxResult {
  const corporateTaxRate = getCorporateTaxRate();
  const professionalTax = getProfessionalTaxForEntity(entityType);
  const prepaymentBasis = resolvePrepayment(entityType, input.fiscalYear, input.businessStart);

  const taxableIncome = Math.max(0, input.totalIncome - input.totalExpenses - input.deductibleEfka);
  const corporateTaxAmount = roundToTwo(taxableIncome * (corporateTaxRate / 100));
  const prepaymentAmount = roundToTwo(corporateTaxAmount * (prepaymentBasis.rate / 100));

  return {
    fiscalYear: input.fiscalYear,
    grossIncome: input.totalIncome,
    deductibleExpenses: input.totalExpenses,
    efkaContributions: input.deductibleEfka,
    taxableIncome,
    corporateTaxRate,
    corporateTaxAmount,
    professionalTax,
    prepaymentRate: prepaymentBasis.rate,
    prepaymentAmount,
    prepaymentBasis,
    totalObligation: roundToTwo(corporateTaxAmount + professionalTax + prepaymentAmount),
  };
}

/** Μερίδιο κάθε δικαιούχου από τα διανεμόμενα, με την παρακράτηση της μορφής/βιβλίων. */
function distributionsOf(
  distributed: number,
  withholdingRate: number,
  holders: readonly EntityHolder[],
): HolderDistribution[] {
  return holders.map((holder) => {
    const gross = roundToTwo(distributed * (holder.sharePercent / 100));
    const withholdingAmount = roundToTwo(gross * (withholdingRate / 100));
    return { holder, gross, withholdingRate, withholdingAmount, net: roundToTwo(gross - withholdingAmount) };
  });
}

/** Πόσο από τη διανομή καλύπτουν οι δηλωμένοι δικαιούχοι — βλ. `DistributionCoverage`. */
function distributionCoverageOf(holders: readonly EntityHolder[]): DistributionCoverage {
  if (holders.length === 0) return { status: 'none', declaredPercent: 0 };
  const declaredPercent = roundToTwo(holders.reduce((sum, h) => sum + h.sharePercent, 0));
  return { status: isCompleteShareSum(declaredPercent) ? 'complete' : 'partial', declaredPercent };
}

/** Ο ΕΝΑΣ υπολογισμός φόρου οντότητας — ΟΕ, ΕΠΕ, ΑΕ. */
export function computeEntityTax(
  entityType: LegalEntityType,
  input: EntityTaxInput,
  holders: readonly EntityHolder[],
): EntityTaxComputation {
  const corporateTax = corporateTaxOf(entityType, input);
  const profitAfterTax = roundToTwo(corporateTax.taxableIncome - corporateTax.corporateTaxAmount);
  const distributed = roundToTwo(profitAfterTax * ((input.distributionPercent ?? 100) / 100));
  const withholdingRate = getDistributionWithholdingRate(entityType, input.bookCategory);
  const distributions = distributionsOf(distributed, withholdingRate, holders);

  return {
    corporateTax,
    profitAfterTax,
    distributed,
    retained: roundToTwo(profitAfterTax - distributed),
    distributions,
    totalWithholding: roundToTwo(distributions.reduce((sum, d) => sum + d.withholdingAmount, 0)),
    coverage: distributionCoverageOf(holders),
  };
}

// ============================================================================
// ΜΕΡΙΣΜΑΤΑ ΚΕΦΑΛΑΙΟΥΧΙΚΩΝ (ΕΠΕ / ΑΕ) — κοινό σχήμα αποτελέσματος
// ============================================================================

/** Τα πεδία μερίσματος ενός δικαιούχου — κοινά σε μέλος ΕΠΕ και μέτοχο ΑΕ (διαφέρουν μόνο id/όνομα). */
export type DividendFields = Omit<MemberDividendResult, 'memberId' | 'memberName'>;

/** Το κέλυφος αποτελέσματος μερισμάτων — κοινό σε ΕΠΕ και ΑΕ (διαφέρει μόνο η λίστα δικαιούχων). */
export type DividendResultShell = Omit<EPETaxResult, 'memberDividends'>;

/** Διανομή → πεδία μερίσματος (ο `TaxEngine` προσθέτει μόνο id/όνομα μέλους ή μετόχου). */
export function dividendFieldsOf(d: HolderDistribution): DividendFields {
  return {
    dividendSharePercent: d.holder.sharePercent,
    grossDividend: d.gross,
    dividendTaxRate: d.withholdingRate,
    dividendTaxAmount: d.withholdingAmount,
    netDividend: d.net,
  };
}

/** Υπολογισμός οντότητας → κέλυφος αποτελέσματος μερισμάτων (ΕΠΕ / ΑΕ). */
export function dividendResultShellOf(result: EntityTaxComputation): DividendResultShell {
  return {
    corporateTax: result.corporateTax,
    profitAfterTax: result.profitAfterTax,
    distributedDividends: result.distributed,
    retainedEarnings: result.retained,
    totalDividendTax: result.totalWithholding,
    distributionCoverage: result.coverage,
  };
}
