/**
 * Quote-level validation (§5.Z.1–5.Z.2).
 * Checks line-sum vs grandTotal after user edits.
 *
 * @module subapps/procurement/utils/quote-validation
 */

import type { QuoteLine } from '@/subapps/procurement/types/quote';

export interface QuoteWarnings {
  linesSumMismatch?: { sum: number; stated: number };
}

export interface QuoteValidationResult {
  warnings: QuoteWarnings;
  hasWarnings: boolean;
}

const TOLERANCE = 0.01;

/**
 * Validates quote-level consistency (lines-sum vs vendor-stated grandTotal).
 * grandTotal is the value the vendor wrote on the document (extractedData.totalAmount).
 * Pass null/undefined if no stated total is available.
 */
export function validateQuote(
  lines: QuoteLine[],
  statedGrandTotal: number | null | undefined,
): QuoteValidationResult {
  const warnings: QuoteWarnings = {};

  if (statedGrandTotal != null) {
    const sum = parseFloat(lines.reduce((acc, l) => acc + l.lineTotal, 0).toFixed(2));
    if (Math.abs(sum - statedGrandTotal) > TOLERANCE) {
      warnings.linesSumMismatch = { sum, stated: statedGrandTotal };
    }
  }

  return {
    warnings,
    hasWarnings: Object.keys(warnings).length > 0,
  };
}

export function collectQuoteInconsistencies(warnings: QuoteWarnings): string[] {
  const out: string[] = [];
  if (warnings.linesSumMismatch) out.push('lines_sum_mismatch');
  return out;
}
