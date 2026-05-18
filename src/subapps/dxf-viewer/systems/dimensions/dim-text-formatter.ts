/**
 * ADR-362 Phase A3 — Dimension text formatter (pure functions).
 *
 * Inputs: numeric measurement + resolved `DimStyle`. Output: string ready for
 * the renderer to draw. No React, no Firestore, no side effects.
 *
 * Resolution chain (DIMSTYLE → output):
 *   1. apply DIMLFAC scale factor (linear only)
 *   2. apply DIMRND rounding (linear only, DIMALTRND for alternate)
 *   3. format via DIMLUNIT/DIMAUNIT helper (reuses ADR-082 unit-format helpers)
 *   4. swap decimal separator to DIMDSEP (helpers emit `.` from `toFixed`/`toExponential`)
 *   5. inject DIMPOST prefix/suffix ("[]" placeholder substitution)
 *
 * Renderer responsibilities (out of scope here):
 *   - DIMTFAC tolerance text scaling (font size adjustment)
 *   - Stacking / positioning of tolerance + alternate-unit text
 *   - DIMTAD / DIMTIH / DIMTOH layout
 */

import type {
  DimAngularUnitFormat,
  DimLinearUnitFormat,
  DimStyle,
} from '../../types/dimension';
import type { Precision } from '../../config/number-format-config';
import {
  formatArchitectural,
  formatDMS,
  formatEngineering,
  formatFractional,
  formatGrads,
  formatScientific,
  formatSurveyor,
} from '../../formatting/formatter-unit-formats';

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

const RAD_TO_DEG = 180 / Math.PI;

/** Engineering/Architectural require explicit zero-suppression config — we keep all zeros visible at formatter level. */
const KEEP_ALL_ZEROS = {
  suppressZeroFeet: false,
  suppressZeroInches: false,
  suppressTrailingZeros: false,
};

function clampPrecision(n: number): Precision {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 8) return 8;
  return Math.round(n) as Precision;
}

/** Round to nearest multiple of `rnd`. `rnd <= 0` disables. */
function applyRounding(value: number, rnd: number): number {
  if (!rnd || rnd <= 0) return value;
  return Math.round(value / rnd) * rnd;
}

/** Replace ASCII `.` with the configured decimal separator. */
function swapDecimalSeparator(input: string, sep: '.' | ','): string {
  return sep === '.' ? input : input.replace(/\./g, sep);
}

/**
 * DIMPOST: substitutes the formatted value into the `[]` placeholder.
 *  - ""              → value
 *  - "[]"            → value
 *  - "L[]mm"         → "L<value>mm"
 *  - "mm" (no token) → "<value>mm" (treated as plain suffix)
 */
function applyDimPost(post: string, value: string): string {
  if (!post) return value;
  if (post.includes('[]')) return post.replace('[]', value);
  return `${value}${post}`;
}

function formatLinearByUnit(
  value: number,
  format: DimLinearUnitFormat,
  precision: number,
): string {
  const p = clampPrecision(precision);
  switch (format) {
    case 'scientific':
      return formatScientific(value, p);
    case 'engineering':
      return formatEngineering(value, p, KEEP_ALL_ZEROS);
    case 'architectural':
      return formatArchitectural(value, p, KEEP_ALL_ZEROS);
    case 'fractional':
      return formatFractional(value, p);
    case 'decimal':
    case 'windowsDesktop':
    default:
      return value.toFixed(p);
  }
}

function formatAngularByUnit(
  radians: number,
  format: DimAngularUnitFormat,
  precision: number,
): string {
  const p = clampPrecision(precision);
  const degrees = radians * RAD_TO_DEG;
  switch (format) {
    case 'degMinSec':
      return formatDMS(degrees, p);
    case 'gradians':
      return formatGrads(degrees, p);
    case 'radians':
      return `${radians.toFixed(p)}r`;
    case 'surveyorUnits':
      return formatSurveyor(degrees, p);
    case 'decimalDegrees':
    default:
      return `${degrees.toFixed(p)}°`;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Linear measurement (input mm).
 * Applies DIMLFAC → DIMRND → DIMLUNIT/DIMDEC → DIMDSEP → DIMPOST.
 */
export function formatLinearMeasurement(valueMm: number, style: DimStyle): string {
  const scaled = valueMm * style.dimlfac;
  const rounded = applyRounding(scaled, style.dimrnd);
  const raw = formatLinearByUnit(rounded, style.dimlunit, style.dimdec);
  const localized = swapDecimalSeparator(raw, style.dimdsep);
  return applyDimPost(style.dimpost, localized);
}

/**
 * Angular measurement (input radians).
 * Applies DIMAUNIT/DIMADEC → DIMDSEP. No DIMLFAC for angles.
 */
export function formatAngularMeasurement(radians: number, style: DimStyle): string {
  const raw = formatAngularByUnit(radians, style.dimaunit, style.dimadec);
  return swapDecimalSeparator(raw, style.dimdsep);
}

/**
 * Alternate-unit text (dual display, e.g. mm + inches).
 * Returns `null` when DIMALT=false. Output wrapped in `[…]` per AutoCAD convention.
 */
export function formatAlternateUnit(valueMm: number, style: DimStyle): string | null {
  if (!style.dimalt) return null;
  const scaled = valueMm * style.dimaltf;
  const rounded = applyRounding(scaled, style.dimaltrnd);
  const raw = formatLinearByUnit(rounded, style.dimaltu, style.dimaltd);
  const localized = swapDecimalSeparator(raw, style.dimdsep);
  const withPost = applyDimPost(style.dimapost, localized);
  return `[${withPost}]`;
}

/**
 * Tolerance text (DIMTOL). Returns `null` when DIMTOL=false.
 * Stacking + DIMTFAC font scaling are the renderer's responsibility.
 */
export function formatToleranceText(
  style: DimStyle,
): { plus: string; minus: string } | null {
  if (!style.dimtol) return null;
  const tdec = clampPrecision(style.dimtdec);
  const plusRaw = style.dimtp.toFixed(tdec);
  const minusRaw = Math.abs(style.dimtm).toFixed(tdec);
  return {
    plus: `+${swapDecimalSeparator(plusRaw, style.dimdsep)}`,
    minus: `-${swapDecimalSeparator(minusRaw, style.dimdsep)}`,
  };
}

/**
 * Limits text (DIMLIM). Returns `null` when DIMLIM=false.
 * Upper = measurement + DIMTP, lower = measurement + DIMTM (DIMTM stored negative).
 * Mutually exclusive with DIMTOL — caller should respect the flag precedence.
 */
export function formatLimitsText(
  measurementMm: number,
  style: DimStyle,
): { upper: string; lower: string } | null {
  if (!style.dimlim) return null;
  return {
    upper: formatLinearMeasurement(measurementMm + style.dimtp, style),
    lower: formatLinearMeasurement(measurementMm + style.dimtm, style),
  };
}

/**
 * Compose primary text honoring `userText` token semantics (AutoCAD parity):
 *   - ''                → '' (suppress text entirely)
 *   - undefined / '<>'  → measured value
 *   - any other string  → literal text with `<>` substituted by measured value
 */
export function composePrimaryText(
  valueMm: number,
  style: DimStyle,
  userText?: string,
): string {
  if (userText === '') return '';
  const measured = formatLinearMeasurement(valueMm, style);
  if (userText === undefined || userText === '<>') return measured;
  return userText.replace('<>', measured);
}

// ──────────────────────────────────────────────────────────────────────────────
// Full dim text composition (Phase G2 — tolerance + limits)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Composed result of primary + optional tolerance/limits text.
 *
 * Rendering contract:
 *   - `primary` → drawn at `textAnchor` with `dimtxt` size.
 *   - Tolerance mode (DIMTOL=true, DIMLIM=false):
 *       `tolerancePlus` drawn above primary, `toleranceMinus` below,
 *       both at `dimtxt × dimtfac` size. DIMTOLJ controls vertical alignment
 *       of the tolerance stack relative to the primary baseline.
 *   - Limits mode (DIMLIM=true, overrides DIMTOL):
 *       `limitsUpper` replaces the primary position, `limitsLower` below it.
 *       `primary` is ignored when limitsUpper is present.
 *       Both drawn at `dimtxt × dimtfac` size.
 *   - Neither flag → only `primary` present.
 */
export interface FullDimText {
  readonly primary: string;
  readonly tolerancePlus?: string;
  readonly toleranceMinus?: string;
  readonly limitsUpper?: string;
  readonly limitsLower?: string;
}

/**
 * Composes the complete text payload for a linear dimension.
 * DIMLIM takes precedence over DIMTOL when both flags are set (AutoCAD parity).
 */
export function composeFullDimText(
  valueMm: number,
  style: DimStyle,
  userText?: string,
): FullDimText {
  const primary = composePrimaryText(valueMm, style, userText);

  // DIMLIM overrides DIMTOL — limits replace the primary text entirely.
  if (style.dimlim) {
    const limits = formatLimitsText(valueMm, style);
    if (limits) {
      return { primary, limitsUpper: limits.upper, limitsLower: limits.lower };
    }
  }

  if (style.dimtol) {
    const tol = formatToleranceText(style);
    if (tol) {
      return { primary, tolerancePlus: tol.plus, toleranceMinus: tol.minus };
    }
  }

  return { primary };
}
