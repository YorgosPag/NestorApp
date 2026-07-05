/**
 * Display-MEASUREMENT formatter SSoT (ADR-357 Phase 2b → ADR-462).
 *
 * ONE place converts an internal **canonical-millimetre** measurement into the
 * user-selected display unit + locale-aware number + unit label. Every read-only
 * readout in the viewer routes through here — distance/dimension pills, the live
 * move readout, ruler & measurement labels, drag-measurement annotations, entity
 * geometry labels (length / area / perimeter), and the status-bar X/Y coordinate
 * readout — so they can never visually diverge and they all follow the status-bar
 * unit selector in real time.
 *
 * Three explicit concerns, ONE conversion home and ONE locale path:
 *   - LENGTH  `formatLengthForDisplay(mm)`      → "9,75 m"     (linear, |abs|)
 *   - AREA    `formatAreaForDisplay(mm²)`       → "25,00 m²"   (squared factor)
 *   - COORD   `formatCoordinateForDisplay(mm)`  → "-1,20 m"    (signed)
 *
 * Editable INPUT fields are NOT served from here — they must stay locale-free /
 * parseable (`config/units.ts` `formatDisplayValue`, dot separator) so `parseFloat`
 * / `fromDisplay` round-trip. This module is read-only DISPLAY only.
 *
 * Internal geometry is canonical millimetres (ADR-462). This module changes ONLY
 * the displayed string — never the stored geometry. Pure (no React/DOM); reads
 * the live unit from `displayUnitState` at call time.
 *
 *   formatLengthForDisplay(9750)                    → "9,75 m"   (unit = m, el-GR)
 *   formatLengthForDisplay(9750, { withUnit:false }) → "9,75"
 *   formatAreaForDisplay(25_000_000, { unit:'m' })  → "25,000 m²"
 *   formatCoordinateForDisplay(-1200, { unit:'m' }) → "-1,200 m"
 *
 * RELATION TO `formatting/FormatterRegistry` (ADR-082): that registry is the
 * GENERIC locale/precision/template engine (AutoCAD rtos equivalent) and stays
 * DXF-agnostic — it knows nothing about the display-unit selector. THIS module is
 * the DXF binding LAYER on top of it: it owns the canonical-mm → selected-unit
 * conversion + the dynamic unit label, and delegates the final locale number to the
 * registry (`localeNumber` → `FormatterRegistry.formatDistance`). So there is ONE
 * locale engine and ONE display-unit home — not two. The registry's own
 * `formatArea`/`formatCoordinate`/`formatRadius`/`formatDiameter` convenience
 * methods are @deprecated for DXF readouts (static template, no selector); always
 * reach for `formatLengthForDisplay` / `formatAreaForDisplay` /
 * `formatCoordinateForDisplay` here instead.
 *
 * @see config/display-unit-state.ts — the non-React unit store this reads
 * @see config/units.ts — mm ↔ unit conversion + default precision (pure)
 * @see formatting/FormatterRegistry.ts — the generic locale engine underneath
 */

import {
  type DisplayUnit,
  DEFAULT_DISPLAY_PRECISION,
  DEFAULT_AREA_PRECISION,
  DEFAULT_COORDINATE_PRECISION,
  DISPLAY_UNIT_LABELS,
  toDisplay,
  toDisplayArea,
} from './units';
import { displayUnitState } from './display-unit-state';
import { FormatterRegistry, type Precision } from '../formatting';
import { canvasToMmScaleFor, type SceneUnits } from '../utils/scene-units';

export interface FormatMeasurementOptions {
  /** Override the display unit (default = the live status-bar selection). */
  readonly unit?: DisplayUnit;
  /** Override decimal places (default = the per-concern default for the unit). */
  readonly precision?: number;
  /** Append the unit label (default `true`). `false` ⇒ bare locale number. */
  readonly withUnit?: boolean;
}

/** Back-compat alias — the original length-only option name. */
export type FormatLengthOptions = FormatMeasurementOptions;

/**
 * The SINGLE locale path. Renders a number with the locale-aware separator
 * (el-GR uses a comma). Snaps sub-precision magnitudes to 0 so we never emit a
 * "-0,00". Sign is preserved (matters for coordinates).
 */
function localeNumber(value: number, precision: number): string {
  const snapped = Math.abs(value) < Math.pow(10, -precision) ? 0 : value;
  return FormatterRegistry.getInstance().formatDistance(snapped, precision as Precision);
}

/**
 * Format an internal millimetre LENGTH for display. Converts mm → the active
 * display unit, renders with the locale separator, appends the unit label unless
 * `withUnit:false`. `Math.abs` guards a theoretical negative (lengths are
 * non-negative).
 */
export function formatLengthForDisplay(mm: number, opts: FormatMeasurementOptions = {}): string {
  const unit = opts.unit ?? displayUnitState.getUnit();
  const precision = opts.precision ?? DEFAULT_DISPLAY_PRECISION[unit];
  const { value, label } = toDisplay(Math.abs(mm), unit);
  const num = localeNumber(value, precision);
  return opts.withUnit === false ? num : `${num} ${label}`;
}

/**
 * @deprecated Name retained for the existing render-path consumers + tests.
 * Identical to {@link formatLengthForDisplay}; prefer that for new code.
 */
export function formatLengthMm(mm: number, opts: FormatLengthOptions = {}): string {
  return formatLengthForDisplay(mm, opts);
}

/**
 * Format a **scene-space** LENGTH for display. THE ONE place that bridges the two SSoTs so the
 * `scene → canonical-mm → display-unit` path is never spelled out inline again: scene units →
 * mm via `canvasToMmScaleFor`, then {@link formatLengthForDisplay}. Every overlay/HUD/dim label
 * measured in scene (canvas) units routes through here (Giorgio 2026-07-05 — «FULL SSoT»).
 *
 *   formatSceneLengthForDisplay(5, 'm', { unit: 'm' })  → "5,00 m"   (5 scene-metres → 5000 mm → "5,00 m")
 *   formatSceneLengthForDisplay(250, 'mm')              → live display unit (250 mm)
 */
export function formatSceneLengthForDisplay(
  sceneValue: number,
  sceneUnits: SceneUnits,
  opts: FormatMeasurementOptions = {},
): string {
  return formatLengthForDisplay(sceneValue * canvasToMmScaleFor({ sceneUnits }), opts);
}

/**
 * Format an internal millimetre² AREA for display. Converts mm² → the active
 * display unit squared (e.g. cm² / m²), renders with the locale separator, and
 * appends the squared unit label unless `withUnit:false`.
 */
export function formatAreaForDisplay(mm2: number, opts: FormatMeasurementOptions = {}): string {
  const unit = opts.unit ?? displayUnitState.getUnit();
  const precision = opts.precision ?? DEFAULT_AREA_PRECISION[unit];
  const { value, label } = toDisplayArea(Math.abs(mm2), unit);
  const num = localeNumber(value, precision);
  return opts.withUnit === false ? num : `${num} ${label}`;
}

/**
 * Format an internal millimetre X/Y COORDINATE for display. Unlike length this
 * keeps the SIGN (coordinates can be negative — left of / below origin) and uses
 * the coordinate precision default. Appends the unit label unless `withUnit:false`.
 */
export function formatCoordinateForDisplay(mm: number, opts: FormatMeasurementOptions = {}): string {
  const unit = opts.unit ?? displayUnitState.getUnit();
  const precision = opts.precision ?? DEFAULT_COORDINATE_PRECISION[unit];
  const { value, label } = toDisplay(mm, unit); // signed — no Math.abs
  const num = localeNumber(value, precision);
  return opts.withUnit === false ? num : `${num} ${label}`;
}

/** Convenience: the current display-unit label (e.g. "m", "cm", "mm"). */
export function currentDisplayUnitLabel(): string {
  return DISPLAY_UNIT_LABELS[displayUnitState.getUnit()];
}
