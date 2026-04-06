/**
 * FORMATTER UNIT-SPECIFIC FORMATS
 * Extracted from FormatterRegistry.ts for SRP (ADR-065)
 *
 * Contains standalone formatting functions for non-decimal unit types:
 * - Scientific, Engineering, Architectural, Fractional (linear)
 * - DMS, Grads, Radians, Surveyor (angular)
 */

import { degToRad } from '../rendering/entities/shared/geometry-utils';
import type { Precision, FormatTemplate, SupportedLocale } from '../config/number-format-config';

// ── Types ────────────────────────────────────────────────────────────

export interface ZeroSuppressionConfig {
  suppressZeroFeet: boolean;
  suppressZeroInches: boolean;
  suppressTrailingZeros: boolean;
}

// ── Utility ──────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// ── Linear Formats ───────────────────────────────────────────────────

export function formatScientific(value: number, precision: Precision): string {
  return value.toExponential(precision).toUpperCase();
}

/**
 * Engineering units (feet-inches decimal).
 * Example: 15.5 inches → 1'-3.50"
 */
export function formatEngineering(
  value: number,
  precision: Precision,
  suppress: ZeroSuppressionConfig,
): string {
  const feet = Math.floor(Math.abs(value) / 12);
  const inches = Math.abs(value) % 12;
  const sign = value < 0 ? '-' : '';

  if (feet === 0 && suppress.suppressZeroFeet) {
    return `${sign}${inches.toFixed(precision)}"`;
  }
  if (inches === 0 && suppress.suppressZeroInches) {
    return `${sign}${feet}'`;
  }
  return `${sign}${feet}'-${inches.toFixed(precision)}"`;
}

/**
 * Architectural units (feet-inches fractional).
 * Example: 15.5 inches → 1'-3 1/2"
 */
export function formatArchitectural(
  value: number,
  precision: Precision,
  suppress: ZeroSuppressionConfig,
): string {
  const feet = Math.floor(Math.abs(value) / 12);
  const inches = Math.floor(Math.abs(value) % 12);
  const fraction = Math.abs(value) % 1;
  const sign = value < 0 ? '-' : '';

  const denominator = Math.pow(2, precision);
  const numerator = Math.round(fraction * denominator);
  const fractionStr = numerator > 0 ? ` ${numerator}/${denominator}` : '';

  if (feet === 0 && suppress.suppressZeroFeet) {
    return `${sign}${inches}${fractionStr}"`;
  }
  if (inches === 0 && fractionStr === '' && suppress.suppressZeroInches) {
    return `${sign}${feet}'`;
  }
  return `${sign}${feet}'-${inches}${fractionStr}"`;
}

/**
 * Fractional format (15 1/2).
 */
export function formatFractional(value: number, precision: Precision): string {
  const whole = Math.floor(Math.abs(value));
  const fraction = Math.abs(value) % 1;
  const sign = value < 0 ? '-' : '';

  const denominator = Math.pow(2, Math.max(1, precision));
  const numerator = Math.round(fraction * denominator);

  if (numerator === 0) return `${sign}${whole}`;

  const g = gcd(numerator, denominator);
  const sNum = numerator / g;
  const sDen = denominator / g;

  if (whole === 0) return `${sign}${sNum}/${sDen}`;
  return `${sign}${whole} ${sNum}/${sDen}`;
}

// ── Angular Formats ──────────────────────────────────────────────────

/**
 * Degrees-Minutes-Seconds (45°30'0").
 */
export function formatDMS(degrees: number, precision: Precision): string {
  const sign = degrees < 0 ? '-' : '';
  const absDeg = Math.abs(degrees);
  const d = Math.floor(absDeg);
  const minFloat = (absDeg - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;
  return `${sign}${d}°${m}'${s.toFixed(precision)}"`;
}

/**
 * Grads (50.00g).
 */
export function formatGrads(degrees: number, precision: Precision): string {
  const grads = degrees * (400 / 360);
  return `${grads.toFixed(precision)}g`;
}

/**
 * Radians (0.7854r). Uses centralized degToRad() (ADR-100).
 */
export function formatRadians(degrees: number, precision: Precision): string {
  const radians = degToRad(degrees);
  return `${radians.toFixed(precision)}r`;
}

/**
 * Surveyor angle (N 45°0'0" E).
 */
export function formatSurveyor(degrees: number, precision: Precision): string {
  let angle = ((degrees % 360) + 360) % 360;

  let ns: string;
  let ew: string;
  let bearing: number;

  if (angle <= 90) {
    ns = 'N'; ew = 'E'; bearing = angle;
  } else if (angle <= 180) {
    ns = 'S'; ew = 'E'; bearing = 180 - angle;
  } else if (angle <= 270) {
    ns = 'S'; ew = 'W'; bearing = angle - 180;
  } else {
    ns = 'N'; ew = 'W'; bearing = 360 - angle;
  }

  const d = Math.floor(bearing);
  const minFloat = (bearing - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;

  return `${ns} ${d}°${m}'${s.toFixed(precision)}" ${ew}`;
}

// ── Template & Zero Suppression ──────────────────────────────────────

export function applyTemplate(value: string, template: FormatTemplate): string {
  const prefix = template.prefix ?? '';
  const suffix = template.suffix ?? '';
  const symbol = template.symbol ?? '';
  return `${prefix}${value}${symbol}${suffix}`;
}

export function applyZeroSuppression(
  value: string,
  suppress: boolean,
): string {
  if (!suppress) return value;
  return value
    .replace(/([.,]\d*?)0+$/, '$1')
    .replace(/[.,]$/, '');
}
