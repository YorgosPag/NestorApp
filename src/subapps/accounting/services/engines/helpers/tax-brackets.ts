/**
 * @fileoverview Tax Brackets — Progressive Tax Calculator
 * @description Pure helper για κλιμακωτό υπολογισμό φόρου εισοδήματος.
 *   Extracted from tax-engine.ts (SRP split, ADR-314 Phase C.5).
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-04-18
 * @see ADR-ACC-009 Tax Engine
 */

import type { TaxScaleConfig, TaxBracketResult } from '../../../types/tax';
import { roundToTwo } from '../../../utils/math';

/**
 * Κλιμακωτός υπολογισμός φόρου εισοδήματος.
 *
 * Εφαρμόζει τα brackets του `scale` στο `taxableIncome` διαδοχικά.
 * Κάθε bracket γεμίζει πλήρως πριν περάσει στο επόμενο.
 *
 * @param taxableIncome - Καθαρό φορολογητέο εισόδημα (€)
 * @param scale         - Φορολογική κλίμακα έτους
 * @returns Per-bracket breakdown + συνολικός φόρος (rounded to 2dp)
 */
export function calculateBracketTax(
  taxableIncome: number,
  scale: TaxScaleConfig
): { bracketBreakdown: TaxBracketResult[]; incomeTax: number } {
  const bracketBreakdown: TaxBracketResult[] = [];
  let remainingIncome = taxableIncome;
  let totalTax = 0;

  for (const bracket of scale.brackets) {
    if (remainingIncome <= 0) break;

    const bracketWidth = bracket.to !== null ? bracket.to - bracket.from + 1 : Infinity;
    const taxableAmount = Math.min(remainingIncome, bracketWidth);
    const taxAmount = roundToTwo(taxableAmount * (bracket.rate / 100));

    bracketBreakdown.push({
      bracket,
      taxableAmount,
      taxAmount,
    });

    totalTax += taxAmount;
    remainingIncome -= taxableAmount;
  }

  return {
    bracketBreakdown,
    incomeTax: roundToTwo(totalTax),
  };
}
