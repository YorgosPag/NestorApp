/**
 * Greek locale decimal helpers.
 * parseGreekDecimal handles Greek keyboard input (comma as decimal, dot as thousands).
 * formatEuro always renders EUR in el-GR locale — use only for procurement-specific display
 * where currency is always EUR and locale is always Greek.
 *
 * @module lib/number/greek-decimal
 */

/**
 * Parse a number from user input that may be Greek-formatted:
 *   "1.200,50" → 1200.5
 *   "12,50"    → 12.5
 *   "12.50"    → 12.5
 *   "1200"     → 1200
 *   ""         → null
 */
export function parseGreekDecimal(input: string): number | null {
  const cleaned = String(input ?? '').replace(/[€\s]/g, '').trim();
  if (cleaned === '') return null;

  // Both . and , present → . = thousands sep, , = decimal sep (Greek style)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  // Only , → decimal (Greek: "12,50")
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const n = Number(cleaned.replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  // Only . or neither → standard JS
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Format a number as EUR in el-GR locale.
 * e.g. 1200.5 → "1.200,50 €"
 */
export function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
