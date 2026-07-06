/**
 * Locale-aware number parsing building blocks (el-GR + multi-locale bank formats).
 *
 * SINGLE SOURCE OF TRUTH for interpreting user- / file-supplied numeric strings
 * that mix `.` and `,` as decimal / thousands separators. Every app consumer
 * (property price fields, accounting CSV import, procurement search, building-code
 * form) and the el-GR wrapper `parseGreekDecimal` are thin consumers of these.
 *
 * Semantics (confirmed with the product owner):
 *  - A user only ever types ONE separator as the decimal mark; the system renders
 *    the thousands grouping. So a SINGLE `.` or `,` is always the decimal.
 *  - When BOTH `.` and `,` are present (e.g. a rendered "1.200,50" pasted back, or
 *    a US "1,200.50"), the LAST-occurring separator is the decimal and the other
 *    is the thousands grouping.
 *  - The same separator repeated (e.g. "1.200.000") is thousands grouping.
 *  - Fixed-locale mode (`decimalSeparator` option) is for known formats such as a
 *    bank CSV column, where the non-decimal separator is unambiguously thousands.
 *
 * @module lib/number/locale-number
 */

export type DecimalSeparator = '.' | ',';

export interface LocaleNumberOptions {
  /**
   * Fixed decimal separator (known-locale mode, e.g. a bank CSV column). When set,
   * the OTHER separator is treated as a thousands grouping mark and stripped.
   * Omit for auto-detection (the default el-GR / multi-locale behaviour above).
   */
  decimalSeparator?: DecimalSeparator;
}

const OTHER_SEPARATOR: Record<DecimalSeparator, DecimalSeparator> = {
  '.': ',',
  ',': '.',
};

/**
 * Detect which of `.` / `,` acts as the decimal separator in an (unsigned) string.
 * Returns `null` when there is no decimal part (all separators are thousands marks).
 */
function detectDecimalSeparator(value: string): DecimalSeparator | null {
  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    return lastComma > lastDot ? ',' : '.';
  }
  if (lastComma !== -1) {
    return value.indexOf(',') === lastComma ? ',' : null;
  }
  if (lastDot !== -1) {
    return value.indexOf('.') === lastDot ? '.' : null;
  }
  return null;
}

/** Strip the thousands grouping and unify the decimal mark to `.`. */
function applyDecimalSeparator(value: string, decimalSep: DecimalSeparator | null): string {
  if (decimalSep === null) {
    return value.replace(/[.,]/g, '');
  }
  const noThousands = value.split(OTHER_SEPARATOR[decimalSep]).join('');
  return decimalSep === '.' ? noThousands : noThousands.split(',').join('.');
}

/**
 * Normalize a raw numeric string to a canonical machine-decimal string
 * (`.` as the decimal mark, thousands grouping removed). Preserves a leading `-`
 * and in-progress input such as "12," → "12.". Empty input → "".
 *
 * Does NOT strip currency symbols or letters — callers that need a number should
 * use {@link parseLocaleNumber}; string consumers (controlled inputs) validate the
 * result themselves.
 */
export function normalizeDecimalString(raw: string, opts: LocaleNumberOptions = {}): string {
  const value = String(raw ?? '').trim();
  if (value === '') return '';

  const sign = value.startsWith('-') ? '-' : '';
  const unsigned = sign ? value.slice(1) : value;
  const decimalSep = opts.decimalSeparator ?? detectDecimalSeparator(unsigned);

  return sign + applyDecimalSeparator(unsigned, decimalSep);
}

/**
 * Parse a locale-formatted numeric string to a number, or `null` when it is empty
 * or unparseable. Currency symbols, whitespace and any other non-numeric noise are
 * stripped first (keeps digits, `.`, `,` and a leading `-`).
 *
 *   "1.200,50"  → 1200.5      "1,200.50"  → 1200.5      "12,50" → 12.5
 *   "€ 12.50"   → 12.5        "$1200"     → 1200        "-125,5" → -125.5
 *   ""          → null        "abc"       → null        "-"      → null
 */
export function parseLocaleNumber(raw: string, opts: LocaleNumberOptions = {}): number | null {
  const stripped = String(raw ?? '').replace(/[^\d.,-]/g, '');
  const normalized = normalizeDecimalString(stripped, opts);
  if (normalized === '' || normalized === '-') return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
