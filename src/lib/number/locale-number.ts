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

/**
 * Διάβασε αριθμό **μόνο** αν το κείμενο είναι εξ ολοκλήρου αριθμός (ADR-759 §2β.5).
 *
 * Δέχεται ελληνική υποδιαστολή και ομαδοποίηση χιλιάδων. Επιστρέφει `null` για κενό,
 * για πρόζα (`«κατά ΝΟΚ»`) και για αριθμό με μονάδα (`«11 μ.»`) — το κενό **δεν**
 * γίνεται ποτέ `0`.
 *
 * 🔑 **Γιατί ΟΧΙ το {@link parseLocaleNumber}**: εκείνο **αφαιρεί πρώτα τον θόρυβο**
 * (το πεδίο του είναι το νόμισμα: `«€ 12,50»` → `12.5`). Σε δεδομένα τοπογραφικού,
 * πιστοποιητικού ή σώματος εγγράφου το ίδιο συμβόλαιο θα ήταν **σφάλμα τιμής**: το
 * `«11 μ.»` θα γινόταν `11` και το `«κατά ΝΟΚ»` θα έμοιαζε συγκρίσιμο. Ένας εύλογος
 * αριθμός σε λάθος θέση είναι χειρότερος από κανέναν. Άρα καταναλώνεται μόνο το
 * {@link normalizeDecimalString} (η διάκριση υποδιαστολής/χιλιάδων) και η **άρνηση**
 * μένει ρητή.
 *
 * ⚠️ Ζούσε στο `lib/survey-record/survey-number.ts`, ενώ το καταναλώνουν πέντε τομείς
 * (τοπογραφικό, πεδία σύνδεσης, σώμα εγγράφου, ΠΕΑ, συμφιλίωση) — μετακόμισε εδώ,
 * στο σπίτι του αναλυτή αριθμών (ADR-923 §23.2 K2).
 *
 * 🔴 **Η άρνηση είναι ΓΡΑΜΜΑΤΙΚΗ** ({@link strictDecimalString}), όχι το `Number()`: ως
 * 2026-11-06 το `Number("0x10")` έδινε 16 και το `"1e3"` 1000 — αριθμοί που κανείς δεν έγραψε.
 *
 *   "1.364,05" → 1364.05 · "12,5" → 12.5 · "−3,5" → -3.5 · "11 μ." → null · "1e3" → null · "" → null
 */
export function parseStrictDecimal(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const machine = strictDecimalString(text);
  if (machine === null) return null;
  const parsed = Number(machine);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * **Η ΜΙΑ γραμματική** αριθμού γραμμένου από άνθρωπο ή έγγραφο: πρόσημο (`-`, `+` ή το
 * τυπογραφικό U+2212) · ψηφία, με ή χωρίς ομαδοποίηση ανά τρία · προαιρετικό δεκαδικό μέρος.
 * Ό,τι άλλο (`0x10`, `1e3`, `,5`, `2,`, `Infinity`, `12 345`, μονάδα) δεν είναι αριθμός.
 */
const STRICT_DECIMAL = /^[-−+]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?$/;

/**
 * Κείμενο → **μηχανική** δεκαδική συμβολοσειρά (`"-1200.50"`), ή `null` αν δεν ταιριάζει
 * στη γραμματική. Τα τελικά μηδενικά **μένουν** (ο κατάλογος κρατά την ακρίβεια του
 * προμηθευτή). Τη διάκριση υποδιαστολής/χιλιάδων τη λέει ο ένας κανόνας,
 * {@link normalizeDecimalString}. Καταναλωτές: {@link parseStrictDecimal} και τα ποσά του
 * καταλόγου (`subapps/catalog/values/decimal-amount.ts`).
 */
export function strictDecimalString(text: string): string | null {
  const trimmed = text.trim();
  if (!STRICT_DECIMAL.test(trimmed)) return null;
  const negative = /^[-−]/.test(trimmed);
  const signless = trimmed.replace(/^[-−+]/, '');
  return normalizeDecimalString(`${negative ? '-' : ''}${signless}`);
}

/** How a number should be written back out — the mirror of what {@link parseLocaleNumber} reads. */
export interface LocaleNumberFormat {
  readonly decimalSeparator: DecimalSeparator;
  readonly decimals: number;
  /** Thousands grouping with the *other* separator: `1.200,50`. */
  readonly grouped: boolean;
}

/**
 * 🔴 ADR-828 §3 — The **inverse** of {@link parseLocaleNumber}: number → text, in the
 * separator the author was already using.
 *
 * This module has always been able to *read* `12,50` and had no way to *write* it back. The
 * gap mattered the moment AutoFill had to continue a series: a seed of `10,5` stepping by
 * `0,5` would emit `11.5` — a dot in the middle of a comma column, i.e. the fill silently
 * changing the convention of the user's own sheet.
 *
 * ⚠️ Deliberately **not** `Intl.NumberFormat`. That formats for a *locale*; this formats for
 * a **document** — the separator is whatever the neighbouring cells already use, which may
 * have nothing to do with the viewer's UI language. Routing through `Intl` would make the
 * same table fill differently for two people looking at the same file.
 */
export function formatLocaleNumber(value: number, format: LocaleNumberFormat): string {
  if (!Number.isFinite(value)) return '';

  const fixed = Math.abs(value).toFixed(format.decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = format.grouped
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, OTHER_SEPARATOR[format.decimalSeparator])
    : whole;

  // The sign is read off the *rounded* magnitude, not the input: `-0.4` at zero decimals
  // rounds to `0`, and `-0` is not a number anyone typed.
  const isZero = /^0*$/.test(whole) && (fraction === undefined || /^0*$/.test(fraction));
  const sign = value < 0 && !isZero ? '-' : '';

  return fraction === undefined
    ? `${sign}${grouped}`
    : `${sign}${grouped}${format.decimalSeparator}${fraction}`;
}
