/**
 * =============================================================================
 * SLIDER VALUE UNITS — the round-trip contract behind an editable slider value
 * =============================================================================
 *
 * A `SliderValueUnit` is a **pair**, never a lone formatter:
 *
 *   format(value)     model → display, WITH symbol   (0.6  → "60%")
 *   formatEdit(value) model → display, NO symbol     (0.6  → "60")
 *   parse(text)       display → model, `null` = bad  ("80%" → 0.8)
 *
 * INVARIANT (enforced by __tests__/slider-value-units.test.ts):
 *   parse(format(v))     === v
 *   parse(formatEdit(v)) === v
 *
 * WHY this exists: a display-only `formatValue` makes the field a ONE-WAY
 * street — it renders "60%" but reads a raw number back, so typing "80" into a
 * 0..1 opacity slider silently clamps to 100%. There is then no keystroke that
 * produces 80%. A unit closes the loop, which is exactly what licenses the
 * field to become editable at all (see SliderValueField's degradation path).
 *
 * `formatEdit` is NOT cosmetic: the focused text and `parse` must live in the
 * SAME numeric space. Showing the raw model number (0.6) while parsing display
 * space would turn an edit of 0.6 → 0.7 into 0.7% = 0.007.
 *
 * Parsing is deliberately permissive on INPUT and strict on VALIDITY:
 * symbol optional, comma accepted as the decimal separator (Greek keyboard),
 * surrounding space ignored — but anything that is not a plain signed decimal
 * is `null`, never a silent 0.
 */

// =============================================================================
// SHARED PRIMITIVES — the single implementation each unit reuses (N.18)
// =============================================================================

/** Plain signed decimal only. Rejects "1e5", "Infinity", "12abc", "--1". */
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * An integer written with grouping separators: "1,000", "12.345.678".
 * Leading digit is non-zero (a grouped number never starts "0,123") and every
 * group after the first is exactly three digits.
 */
const GROUPED_INTEGER = /^[+-]?[1-9]\d{0,2}(?:[.,]\d{3})+$/;

/** A single separator with exactly three digits after it: "1,000", "12,345". */
const AMBIGUOUS_COMMA = /^[+-]?[1-9]\d{0,2},\d{3}$/;

/** Display rounding — kills float noise like 0.6 * 100 = 60.000000000000004. */
const DISPLAY_DECIMALS = 4;

/** Model rounding — kills float noise introduced by the inverse (÷ 100). */
const MODEL_DECIMALS = 10;

const MINUTES_PER_HOUR = 60;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Number → display text, float noise stripped. */
function toText(value: number): string {
  return String(roundTo(value, DISPLAY_DECIMALS));
}

/**
 * Text → number, or `null`. The ONLY string→number door in this file.
 *
 * SEPARATORS (round 3 fix). The old body did `raw.replace(',', '.')`
 * unconditionally, so "1,000" — one thousand to anyone typing en-US — became
 * 1. Silent, and destructive on a 0..1000 range (`gripObjLimit`): the user
 * asks for the maximum and gets the minimum with no signal at all.
 *
 * The rule now, in order:
 *
 *   both "." and ","  → the LAST one is the decimal separator, the other is
 *                       grouping and must sit in valid group positions.
 *                       "1.234,56" → 1234.56, "1,234.56" → 1234.56
 *   "," only, once    → decimal separator (Greek keyboard): "60,5" → 60.5,
 *                       UNLESS it has exactly grouping shape ("1,000"), which
 *                       is genuinely ambiguous → `null`
 *   "," only, many    → grouping only: "1,000,000" → 1000000
 *   "." only          → decimal, always. It is what `format` emits and what JS
 *                       itself means, so it is never ambiguous here.
 *
 * Ambiguity returns `null` — a VISIBLE rejection the field paints red — rather
 * than guessing. A guess that is right 90% of the time is a silent corruption
 * the other 10%, which is exactly the failure this whole module exists to stop.
 */
function toNumber(raw: string): number | null {
  const normalized = normalizeSeparators(raw.trim());
  if (normalized === null || normalized === '') return null;
  if (!DECIMAL_PATTERN.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Rewrites any accepted separator convention into a plain JS decimal. */
function normalizeSeparators(text: string): string | null {
  const hasComma = text.includes(',');
  if (!hasComma) return text;
  if (text.includes('.')) return normalizeMixed(text);
  // Order matters: "1,000" satisfies BOTH shapes, and that is precisely what
  // makes it ambiguous — reject it before the grouping branch can guess 1000.
  // "1,000,000" cannot be a decimal, so it falls through to grouping safely.
  if (AMBIGUOUS_COMMA.test(text)) return null;
  if (GROUPED_INTEGER.test(text)) return text.split(',').join('');
  return text.split(',').join('.');
}

/** Both separators present: the rightmost is the decimal point. */
function normalizeMixed(text: string): string | null {
  const decimalSep = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
  const groupSep = decimalSep === ',' ? '.' : ',';
  const cut = text.lastIndexOf(decimalSep);
  const integer = text.slice(0, cut);
  const fraction = text.slice(cut + 1);

  if (fraction.includes(groupSep) || fraction.includes(decimalSep)) return null;
  if (!GROUPED_INTEGER.test(integer)) return null;
  if (integer.includes(decimalSep)) return null;
  return `${integer.split(groupSep).join('')}.${fraction}`;
}

/** Drops a trailing symbol (case-insensitive) so "80%" and "80" both parse. */
function stripSuffix(raw: string, suffixes: readonly string[]): string {
  const text = raw.trim();
  const lower = text.toLowerCase();
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix.toLowerCase())) {
      return text.slice(0, text.length - suffix.length).trim();
    }
  }
  return text;
}

/** Parse a suffixed decimal: strip the symbol, then the one numeric door. */
function parseSuffixed(raw: string, suffixes: readonly string[]): number | null {
  return toNumber(stripSuffix(raw, suffixes));
}

// =============================================================================
// UNIT CONTRACT
// =============================================================================

export interface SliderValueUnit {
  /** Stable id — diagnostics and test tables only, never user-facing. */
  readonly id: string;
  /** Model → display, with symbol. Shown while blurred. */
  format(value: number): string;
  /** Model → display, without symbol. Shown while focused; parse's inverse. */
  formatEdit(value: number): string;
  /** Display → model. `null` means invalid — callers MUST reject, not coerce. */
  parse(text: string): number | null;
}

// =============================================================================
// UNITS — one small function per direction, all sharing the primitives above
// =============================================================================

const PERCENT_SUFFIXES = ['%'] as const;

/** Model 0..1, display "60%". The unit that broke in round 1. */
function formatPercent01(value: number): string {
  return `${formatPercent01Edit(value)}%`;
}
function formatPercent01Edit(value: number): string {
  return toText(value * 100);
}
function parsePercent01(text: string): number | null {
  const percent = parseSuffixed(text, PERCENT_SUFFIXES);
  return percent === null ? null : roundTo(percent / 100, MODEL_DECIMALS);
}

/** Model 0..100, display "60%". */
function formatPercent100(value: number): string {
  return `${formatPercent100Edit(value)}%`;
}
function formatPercent100Edit(value: number): string {
  return toText(value);
}
function parsePercent100(text: string): number | null {
  return parseSuffixed(text, PERCENT_SUFFIXES);
}

const PIXEL_SUFFIXES = ['px'] as const;

/** Display "12px". */
function formatPixels(value: number): string {
  return `${formatPixelsEdit(value)}px`;
}
function formatPixelsEdit(value: number): string {
  return toText(value);
}
function parsePixels(text: string): number | null {
  return parseSuffixed(text, PIXEL_SUFFIXES);
}

const MILLISECOND_SUFFIXES = ['ms'] as const;

/** Display "250ms". Durations — grid cross-fade, animation timing. */
function formatMilliseconds(value: number): string {
  return `${formatMillisecondsEdit(value)}ms`;
}
function formatMillisecondsEdit(value: number): string {
  return toText(value);
}
function parseMilliseconds(text: string): number | null {
  return parseSuffixed(text, MILLISECOND_SUFFIXES);
}

const DEGREE_SUFFIXES = ['°', 'deg'] as const;

/** Display "45°". */
function formatDegrees(value: number): string {
  return `${formatDegreesEdit(value)}°`;
}
function formatDegreesEdit(value: number): string {
  return toText(value);
}
function parseDegrees(text: string): number | null {
  return parseSuffixed(text, DEGREE_SUFFIXES);
}

/** Bare number, identity in both directions. */
function formatScalar(value: number): string {
  return toText(value);
}
function parseScalar(text: string): number | null {
  return toNumber(text);
}

/**
 * Model = decimal hours 0..24, display "08:30".
 * Accepts BOTH clock ("8:45") and decimal ("8.75") input — a sun-position
 * slider is dragged in clock terms but stored as a fraction.
 */
function formatHourOfDay(value: number): string {
  const totalMinutes = Math.round(value * MINUTES_PER_HOUR);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes - hours * MINUTES_PER_HOUR;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseHourOfDay(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed.includes(':')) return toNumber(trimmed);
  const [rawHours, rawMinutes, ...rest] = trimmed.split(':');
  if (rest.length > 0) return null;
  const hours = toNumber(rawHours);
  const minutes = toNumber(rawMinutes);
  if (hours === null || minutes === null) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_HOUR) return null;
  if (!Number.isInteger(hours) || hours < 0) return null;
  return roundTo(hours + minutes / MINUTES_PER_HOUR, MODEL_DECIMALS);
}

// =============================================================================
// REGISTRY
// =============================================================================

export const SLIDER_VALUE_UNITS = {
  percent01: {
    id: 'percent01',
    format: formatPercent01,
    formatEdit: formatPercent01Edit,
    parse: parsePercent01,
  },
  percent100: {
    id: 'percent100',
    format: formatPercent100,
    formatEdit: formatPercent100Edit,
    parse: parsePercent100,
  },
  pixels: {
    id: 'pixels',
    format: formatPixels,
    formatEdit: formatPixelsEdit,
    parse: parsePixels,
  },
  milliseconds: {
    id: 'milliseconds',
    format: formatMilliseconds,
    formatEdit: formatMillisecondsEdit,
    parse: parseMilliseconds,
  },
  degrees: {
    id: 'degrees',
    format: formatDegrees,
    formatEdit: formatDegreesEdit,
    parse: parseDegrees,
  },
  scalar: {
    id: 'scalar',
    format: formatScalar,
    formatEdit: formatScalar,
    parse: parseScalar,
  },
  hourOfDay: {
    id: 'hourOfDay',
    format: formatHourOfDay,
    formatEdit: formatHourOfDay,
    parse: parseHourOfDay,
  },
} as const satisfies Record<string, SliderValueUnit>;

export type SliderValueUnitId = keyof typeof SLIDER_VALUE_UNITS;
