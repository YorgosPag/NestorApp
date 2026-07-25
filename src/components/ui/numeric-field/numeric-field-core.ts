/**
 * =============================================================================
 * 🏢 ENTERPRISE: Numeric field pure core (clamp · step · nudge · display)
 * =============================================================================
 *
 * Framework-free helpers shared by the headless hook and its tests. Everything
 * here is a pure function — no React, no DOM, no I/O — so the numeric semantics
 * of the app can be unit-tested without rendering anything.
 *
 * Display formatting delegates to the app-wide `formatNumber` Intl SSoT
 * (ADR-314 module `intl-formatting`); parsing delegates to the locale-number
 * SSoT (ADR-576). This module introduces NO formatting or parsing rules.
 *
 * @module components/ui/numeric-field/numeric-field-core
 * @see ADR-706 — Numeric field SSoT
 */

import { formatNumber } from '@/lib/intl-formatting';

/** Keyboard nudge multipliers — mirrors Figma's small / big nudge. */
export const NUDGE_MULTIPLIER = {
  /** Plain ArrowUp / ArrowDown. */
  normal: 1,
  /** Shift + Arrow, PageUp / PageDown — the "big nudge". */
  large: 10,
  /** Alt + Arrow — the fine nudge. */
  fine: 0.1,
} as const;

/** Floating-point guard: 0.1 + 0.2 must not surface as 0.30000000000000004. */
const MAX_SIGNIFICANT_DECIMALS = 10;

export interface NumericBounds {
  readonly min?: number;
  readonly max?: number;
  /** Increment applied by arrow keys / scrubbing. Defaults to 1. */
  readonly step?: number;
}

/** Round away binary floating-point noise while preserving real precision. */
export function stripFloatNoise(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(MAX_SIGNIFICANT_DECIMALS));
}

/** Constrain a value to `[min, max]`. Missing bounds are unconstrained. */
export function clampToBounds(value: number, bounds: NumericBounds): number {
  let result = value;
  if (bounds.min !== undefined && result < bounds.min) result = bounds.min;
  if (bounds.max !== undefined && result > bounds.max) result = bounds.max;
  return result;
}

/**
 * Number of decimals implied by `step` — used so a nudge on a `step={0.5}`
 * field lands on 21.5, never 21.499999999999996.
 */
function decimalsForStep(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  if (dot === -1) return 0;
  return Math.min(text.length - dot - 1, MAX_SIGNIFICANT_DECIMALS);
}

/**
 * Apply one nudge of `step * multiplier` in `direction` (+1 / −1), snapped to
 * the step's precision and clamped to the bounds.
 */
export function nudgeValue(
  value: number,
  direction: 1 | -1,
  bounds: NumericBounds,
  multiplier: number = NUDGE_MULTIPLIER.normal,
): number {
  const step = bounds.step ?? 1;
  const delta = step * multiplier;
  const raw = (Number.isFinite(value) ? value : 0) + delta * direction;
  const snapped = Number(raw.toFixed(decimalsForStep(delta)));
  return clampToBounds(snapped, bounds);
}

/**
 * The value shown when the field is NOT focused: locale-grouped, e.g. el-GR
 * `1.234,56`. Non-finite input renders as an empty string so a broken model
 * value never paints `NaN` into the UI.
 */
export function formatForDisplay(value: number): string {
  if (!Number.isFinite(value)) return '';
  return formatNumber(value, { maximumFractionDigits: MAX_SIGNIFICANT_DECIMALS });
}

/**
 * The value shown WHILE the field is focused: the raw number with the locale
 * decimal mark and NO thousands grouping, so any separator the user then types
 * is unambiguously the decimal mark (the ADR-576 format-on-blur contract).
 */
export function formatForEditing(value: number, decimalSeparator: string): string {
  if (!Number.isFinite(value)) return '';
  const machine = String(stripFloatNoise(value));
  return decimalSeparator === ',' ? machine.replace('.', ',') : machine;
}

/** Resolve the locale's decimal mark (`,` for el-GR, `.` for en-US). */
export function resolveDecimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === 'decimal')?.value ?? '.';
}
