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
import type { DimGeometry } from './dim-geometry-builder';
import type { Precision } from '../../config/number-format-config';
// ADR-462 / ADR-362 R15 — dimension values follow the app display-unit SSoT
// (status-bar selector, default live), same as every other length readout, so a
// canonical-mm measurement is shown in the user's unit (e.g. metres) instead of
// raw mm. Internal geometry stays canonical-mm; only the displayed number changes.
import { toDisplay, type DisplayUnit } from '../../config/units';
import { displayUnitState } from '../../config/display-unit-state';
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
 * Linear measurement (input canonical mm).
 * Converts mm → the active display unit (ADR-462 SSoT) FIRST, then applies
 * DIMLFAC → DIMRND → DIMLUNIT/DIMDEC → DIMDSEP → DIMPOST. So an 8808.57 mm
 * measurement renders as "8,81" in a metres view (dimdec=2) instead of raw mm.
 * `displayUnit` defaults to the live status-bar selection; tests pass it explicitly.
 */
export function formatLinearMeasurement(
  valueMm: number,
  style: DimStyle,
  displayUnit: DisplayUnit = displayUnitState.getUnit(),
): string {
  const inDisplayUnit = toDisplay(valueMm, displayUnit).value;
  const scaled = inDisplayUnit * style.dimlfac;
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
// Geometry-aware primary text (SSoT — shared by the canvas renderer + DXF block export)
// ──────────────────────────────────────────────────────────────────────────────

/** Radial dim text prefixes (AutoCAD parity): Ø for diameter, R for radius. */
export const RADIAL_DIAMETER_PREFIX = 'Ø ';
export const RADIAL_RADIUS_PREFIX = 'R ';

/**
 * Resolve the PRIMARY display string for a built `DimGeometry`, dispatching on its
 * kind (angular → angular format; radial → R/Ø-prefixed; linear/ordinate/etc. →
 * linear format) and honouring the `userText` token semantics. This is the SSoT
 * for "geometry → measured label": `dim-text-renderer` (canvas/preview) and the
 * DXF dimension-block emitter (export) both delegate here so the on-screen label
 * and the exported block text never diverge.
 *
 * Note: `measurementValue` is mm for linear/radial/arcLength and **radians** for
 * angular — the per-kind formatter applies the right unit conversion.
 */
export function resolveDimensionText(
  geometry: DimGeometry,
  style: DimStyle,
  userText?: string,
): string {
  // Empty user text = suppress entirely (AutoCAD parity).
  if (userText === '') return '';

  if (geometry.kind === 'angular') {
    const measured = formatAngularMeasurement(geometry.measurementValue, style);
    if (userText === undefined || userText === '<>') return measured;
    return userText.replace('<>', measured);
  }

  if (geometry.kind === 'radial') {
    const measured = composePrimaryText(geometry.measurementValue, style, userText);
    if (!measured) return '';
    // Prefix only when user text is the measured token ('' / undefined / '<>'),
    // otherwise the user already supplied custom text (don't double-prefix).
    if (userText === undefined || userText === '<>') {
      return (geometry.isDiameter ? RADIAL_DIAMETER_PREFIX : RADIAL_RADIUS_PREFIX) + measured;
    }
    return measured;
  }

  // Linear / aligned / ordinate / baseline / continued — all consume linear formatting.
  return composePrimaryText(geometry.measurementValue, style, userText);
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
