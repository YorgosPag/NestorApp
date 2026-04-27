/**
 * Quote Analyzer Validation — ADR-327 §6.5.
 *
 * Self-consistency loop (Google Document AI pattern):
 * - Component math: unitPrice × qty × (1 - discount/100) ≈ lineTotal
 * - Row consistency: Σ(components.lineTotal) ≈ rowSubtotal
 * - Quote subtotal: Σ(rowSubtotal) ≈ subtotal
 * - Totals integrity: subtotal + vatAmount ≈ totalAmount
 *
 * Generic — zero template-specific knowledge.
 */

import type { RawExtractedQuote } from './quote-analyzer.schemas';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

const TOLERANCE = 0.02;

function approxEqual(a: number, b: number, tol = TOLERANCE): boolean {
  const ref = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / ref <= tol;
}

export function validateExtraction(raw: RawExtractedQuote): ValidationResult {
  const issues: string[] = [];

  for (const row of raw.lineItems ?? []) {
    const components = Array.isArray(row.components) ? row.components : [];
    const sumComponents = components.reduce((s, c) => s + (c.lineTotal ?? 0), 0);
    if (row.rowSubtotal != null && components.length > 0 && !approxEqual(sumComponents, row.rowSubtotal)) {
      const r = row.rowNumber ?? '?';
      issues.push(`Γραμμή ${r}: Σ(αξίες εξαρτημάτων) = ${sumComponents.toFixed(2)} αλλά σύνολο γραμμής = ${row.rowSubtotal.toFixed(2)} (αναντιστοιχία).`);
    }
    for (const c of components) {
      if (c.unitPrice != null && c.quantity != null && c.lineTotal != null) {
        const discount = c.discountPercent ?? 0;
        const expected = c.unitPrice * c.quantity * (1 - discount / 100);
        if (!approxEqual(expected, c.lineTotal)) {
          const r = row.rowNumber ?? '?';
          const desc = (c.description ?? '').slice(0, 30);
          issues.push(`Γραμμή ${r} "${desc}": τιμή(${c.unitPrice}) × τμχ(${c.quantity}) × (1 - ${discount}%) = ${expected.toFixed(2)} αλλά αξία γραμμής = ${c.lineTotal.toFixed(2)}.`);
        }
      }
    }
  }

  if (raw.subtotal != null && raw.lineItems?.length > 0) {
    const sumRows = raw.lineItems.reduce((s, r) => s + (r.rowSubtotal ?? 0), 0);
    if (sumRows > 0 && !approxEqual(sumRows, raw.subtotal)) {
      issues.push(`Σ(σύνολα γραμμών) = ${sumRows.toFixed(2)} αλλά καθαρό σύνολο = ${raw.subtotal.toFixed(2)} (αναντιστοιχία).`);
    }
  }

  if (raw.subtotal != null && raw.vatAmount != null && raw.totalAmount != null) {
    if (!approxEqual(raw.subtotal + raw.vatAmount, raw.totalAmount)) {
      issues.push(`καθαρό(${raw.subtotal}) + ΦΠΑ(${raw.vatAmount}) = ${(raw.subtotal + raw.vatAmount).toFixed(2)} αλλά σύνολο = ${raw.totalAmount.toFixed(2)}.`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function buildRetryFeedback(issues: string[]): string {
  return [
    'Η προηγούμενη εξαγωγή είχε αριθμητικές ασυνέπειες. Διόρθωσε:',
    ...issues.slice(0, 8).map((i) => `• ${i}`),
    '',
    'Ξανακοίταξε ΠΡΟΣΕΚΤΙΚΑ την οριζόντια ευθυγράμμιση των στηλών στην tabella. Κάθε αριθμός πρέπει να αντιστοιχεί στη ΣΩΣΤΗ σειρά. Επιστρέψε ΞΑΝΑ ολόκληρο το JSON σύμφωνα με το schema.',
  ].join('\n');
}
