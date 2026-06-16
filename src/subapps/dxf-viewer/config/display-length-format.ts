/**
 * Render-path display-length formatter SSoT (ADR-357 Phase 2b → ADR-462).
 *
 * ONE place converts an internal **millimetre** length into the user-selected
 * display unit + locale-aware number + unit label. Every distance readout in the
 * viewer (dimension pills, the live move readout, ruler/measurement labels, the
 * drag-measurement annotations) routes through here, so they can never visually
 * diverge and they all follow the status-bar unit selector in real time.
 *
 * Internal geometry is canonical millimetres (ADR-462). This module changes ONLY
 * the displayed string — never the stored geometry.
 *
 *   formatLengthMm(9750)                  → "9,75 m"   (unit = m, el-GR locale)
 *   formatLengthMm(9750, { withUnit:false }) → "9,75"
 *   formatLengthMm(250, { unit:'mm' })    → "250 mm"
 *
 * Pure (no React/DOM); reads the live unit from `displayUnitState` at call time.
 *
 * @see config/display-unit-state.ts — the non-React unit store this reads
 * @see config/units.ts — mm ↔ unit conversion + default precision (pure)
 */

import {
  type DisplayUnit,
  DEFAULT_DISPLAY_PRECISION,
  DISPLAY_UNIT_LABELS,
  toDisplay,
} from './units';
import { displayUnitState } from './display-unit-state';
import { FormatterRegistry, type Precision } from '../formatting';

export interface FormatLengthOptions {
  /** Override the display unit (default = the live status-bar selection). */
  readonly unit?: DisplayUnit;
  /** Override decimal places (default = `DEFAULT_DISPLAY_PRECISION[unit]`). */
  readonly precision?: number;
  /** Append the unit label (default `true`). `false` ⇒ bare locale number. */
  readonly withUnit?: boolean;
}

/**
 * Format an internal millimetre length for display. Converts mm → the active
 * display unit, renders the number with the locale-aware separator (el-GR uses a
 * comma), and appends the unit label unless `withUnit:false`. `Math.abs` guards a
 * theoretical negative (lengths are non-negative).
 */
export function formatLengthMm(mm: number, opts: FormatLengthOptions = {}): string {
  const unit = opts.unit ?? displayUnitState.getUnit();
  const precision = opts.precision ?? DEFAULT_DISPLAY_PRECISION[unit];
  const { value, label } = toDisplay(Math.abs(mm), unit);
  const snapped = value < Math.pow(10, -precision) ? 0 : value;
  const num = FormatterRegistry.getInstance().formatDistance(snapped, precision as Precision);
  return opts.withUnit === false ? num : `${num} ${label}`;
}

/** Convenience: the current display-unit label (e.g. "m", "cm", "mm"). */
export function currentDisplayUnitLabel(): string {
  return DISPLAY_UNIT_LABELS[displayUnitState.getUnit()];
}
