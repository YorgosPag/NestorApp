/**
 * Pure validation for quote line items (§5.Z.1–5.Z.2).
 * Returns hard errors (block save) and soft warnings (allow save-anyway).
 *
 * @module subapps/procurement/utils/line-validation
 */

import { isKnownUnit } from './units';
import { parseGreekDecimal } from '@/lib/number/greek-decimal';
import type { QuoteLine } from '@/subapps/procurement/types/quote';

export interface LineErrors {
  description?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  vatRate?: string;
}

export interface LineWarnings {
  totalMismatch?: { statedTotal: number; computedTotal: number };
  quantityMismatch?: { vendorQty: number; requestedQty: number };
  negativePrice?: true;
  zeroQuantityWithPrice?: true;
}

export interface LineValidationResult {
  errors: LineErrors;
  warnings: LineWarnings;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface LineValidationContext {
  /** vatIncluded on the quote — when true, vatRate is not required */
  vatIncluded?: boolean | null;
  /** Corresponding RFQ line quantity for mismatch detection */
  rfqQuantity?: number | null;
  /** Whether the lineTotal was overridden by the user vs auto-computed */
  totalOverridden?: boolean;
}

const TOLERANCE = 0.01;
const MAX_QTY_DECIMALS = 4;
const MAX_PRICE_DECIMALS = 6;
const VALID_VAT_RATES = new Set([0, 6, 13, 24]);

function countDecimals(n: number): number {
  const s = n.toString();
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function validateLine(
  line: QuoteLine,
  ctx: LineValidationContext = {},
): LineValidationResult {
  const errors: LineErrors = {};
  const warnings: LineWarnings = {};

  // --- Hard errors ---

  if (!line.description || line.description.trim().length === 0) {
    errors.description = 'rfqs.lineEdit.error.descriptionRequired';
  }

  const qty = parseGreekDecimal(String(line.quantity));
  if (qty === null || isNaN(qty) || qty < 0 || countDecimals(qty) > MAX_QTY_DECIMALS) {
    errors.quantity = 'rfqs.lineEdit.error.quantityInvalid';
  }

  if (!line.unit || line.unit.trim().length === 0) {
    errors.unit = 'rfqs.lineEdit.error.unitRequired';
  } else if (!isKnownUnit(line.unit) && line.unit.trim().length === 0) {
    errors.unit = 'rfqs.lineEdit.error.unitRequired';
  }

  const price = parseGreekDecimal(String(line.unitPrice));
  if (price === null || isNaN(price) || countDecimals(price) > MAX_PRICE_DECIMALS) {
    errors.unitPrice = 'rfqs.lineEdit.error.priceInvalid';
  }

  const needsVat = ctx.vatIncluded === false;
  if (needsVat && !VALID_VAT_RATES.has(line.vatRate)) {
    errors.vatRate = 'rfqs.lineEdit.error.vatRateRequired';
  }

  // --- Soft warnings ---

  const safeQty = qty ?? line.quantity;
  const safePrice = price ?? line.unitPrice;
  const computed = parseFloat((safeQty * safePrice).toFixed(2));

  if (ctx.totalOverridden && Math.abs(line.lineTotal - computed) > TOLERANCE) {
    warnings.totalMismatch = { statedTotal: line.lineTotal, computedTotal: computed };
  }

  if (
    ctx.rfqQuantity != null &&
    qty != null &&
    Math.abs(qty - ctx.rfqQuantity) > TOLERANCE
  ) {
    warnings.quantityMismatch = { vendorQty: qty, requestedQty: ctx.rfqQuantity };
  }

  if (price != null && price < 0) {
    warnings.negativePrice = true;
  }

  if (qty === 0 && safePrice > 0) {
    warnings.zeroQuantityWithPrice = true;
  }

  return {
    errors,
    warnings,
    hasErrors: Object.keys(errors).length > 0,
    hasWarnings: Object.keys(warnings).length > 0,
  };
}

export function collectInconsistencies(warnings: LineWarnings): string[] {
  const out: string[] = [];
  if (warnings.totalMismatch) out.push('totals_mismatch');
  if (warnings.quantityMismatch) out.push('quantity_mismatch');
  if (warnings.negativePrice) out.push('negative_price');
  if (warnings.zeroQuantityWithPrice) out.push('zero_quantity_with_price');
  return out;
}
