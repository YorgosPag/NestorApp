/**
 * ADR-677 Φάση 2β — THE display-unit boundary for ribbon numeric comboboxes.
 *
 * The core stays canonical-mm (ADR-462): every preset ladder in `data/contextual-*-tab.ts`
 * remains written in millimetres, every `onComboboxChange` still carries millimetres, and
 * no bridge, store or geometry layer learns about display units. The unit exists ONLY here,
 * at the UI edge, exactly as Φάση 2α did for the F9 snap step — one boundary, not 92
 * scattered conversions (ADR-677 §7.1, δρόμος Β).
 *
 * Conversion is opt-in per field via `RibbonQuantityKind`: only `'model-length'` flows
 * through the display unit. Counts, degrees, percentages, paper millimetres and DN
 * catalogue sizes pass through untouched — see the type's doc-comment for why the default
 * is «do nothing» rather than «convert».
 *
 * Also the SSoT for the mm↔display string pair itself (`toDisp`/`fromDisp`), which the
 * Line-Tool bridge helpers consume rather than re-declare (CLAUDE.md N.18 — the identical
 * two-liner in two files is precisely the sibling clone jscpd flags).
 *
 * @see ../types/ribbon-types.ts — `RibbonQuantityKind`
 * @see ../components/buttons/RibbonCombobox.tsx — the only consumer of the option/value helpers
 * @see docs/centralized-systems/reference/adrs/ADR-677-user-selectable-input-units.md
 */

import { formatDisplayValue, fromDisplay } from '../../../config/units';
import { displayUnitState } from '../../../config/display-unit-state';
import type { RibbonComboboxOption, RibbonQuantityKind } from '../types/ribbon-types';
import {
  parseOptionNumber,
  type ResolvedNumericConfig,
} from '../components/buttons/ribbon-combobox-numeric';

/**
 * mm → active display unit, as a combobox string, ROUNDED to the unit's display precision
 * (SSoT `formatDisplayValue` → `DEFAULT_DISPLAY_PRECISION`, AutoCAD LUPREC-style). Big-player
 * parity (Revit/ArchiCAD/Figma): editable readouts never show float noise like
 * `637.08313078260`. Dot-separated & parseable so {@link fromDisp} round-trips
 * (rounded === rounded ⇒ no phantom write).
 */
export function toDisp(mm: number): string {
  return formatDisplayValue(mm, displayUnitState.getUnit());
}

/** Display-unit string → mm (inverse of {@link toDisp}). NaN on invalid input. */
export function fromDisp(value: string): number {
  return fromDisplay(parseFloat(value), displayUnitState.getUnit());
}

/**
 * Does this field participate in the display unit at all? True for `'model-length'` ONLY.
 * An absent kind is deliberately false — an unclassified field keeps its authored
 * millimetres instead of being silently rescaled.
 */
export function isUnitConvertedKind(kind: RibbonQuantityKind | undefined): boolean {
  return kind === 'model-length';
}

/**
 * Preset ladder mm → display unit. Non-numeric entries (an injected free-form label) and
 * non-converted kinds are returned untouched, so the caller can apply this unconditionally.
 */
export function optionsToDisplayUnit(
  options: readonly RibbonComboboxOption[],
  kind: RibbonQuantityKind | undefined,
): readonly RibbonComboboxOption[] {
  if (!isUnitConvertedKind(kind)) return options;
  return options.map((opt) => {
    const mm = parseOptionNumber(opt.value);
    if (mm === null) return opt;
    const shown = toDisp(mm);
    // Label follows the value: these ladders are `isLiteralLabel` (the number IS the label),
    // so a converted value with a stale mm label would read «900» while committing 0.9.
    return { ...opt, value: shown, labelKey: shown };
  });
}

/**
 * Current committed value mm → display unit. `null` (mixed selection) stays `null`.
 * Rounded through the SAME `toDisp` as the presets, so a value equal to a preset yields an
 * identical string and the dropdown still shows it as selected.
 */
export function valueToDisplayUnit(
  value: string | null,
  kind: RibbonQuantityKind | undefined,
): string | null {
  if (value === null || !isUnitConvertedKind(kind)) return value;
  const mm = parseOptionNumber(value);
  return mm === null ? value : toDisp(mm);
}

/**
 * Typed/picked display-unit value → mm for `onComboboxChange`. The store only ever receives
 * millimetres — the whole point of the boundary. Unparseable input is passed through so the
 * existing commit validation keeps ownership of rejecting it.
 */
export function valueFromDisplayUnit(
  value: string,
  kind: RibbonQuantityKind | undefined,
): string {
  if (!isUnitConvertedKind(kind)) return value;
  const mm = fromDisp(value);
  return Number.isFinite(mm) ? String(mm) : value;
}

/**
 * `min`/`max` guards are authored in mm (e.g. hatch gap tolerance `max: 5000`), but the
 * editable input now validates a value the user typed in metres. Without this the guard
 * would compare `5` against `5000` and wave through a 5000 m tolerance. Converts the bounds
 * into the same space as the draft; every other constraint is unit-free.
 */
export function boundsToDisplayUnit(
  config: ResolvedNumericConfig,
  kind: RibbonQuantityKind | undefined,
): ResolvedNumericConfig {
  if (!isUnitConvertedKind(kind)) return config;
  const { min, max } = config;
  if (min === undefined && max === undefined) return config;
  return {
    ...config,
    min: min === undefined ? undefined : Number(toDisp(min)),
    max: max === undefined ? undefined : Number(toDisp(max)),
  };
}

/**
 * True when two combobox strings mean the SAME millimetre value. Guards against a phantom
 * write: `commitNumericDraft` normalises «0.900» → «0.9», which differs as text from the
 * value the field was rendered with while being identical in mm. Comparing after the
 * conversion keeps the store from taking a no-op update on every blur.
 */
export function isSameCommittedValue(a: string, b: string): boolean {
  if (a === b) return true;
  const na = parseOptionNumber(a);
  const nb = parseOptionNumber(b);
  return na !== null && nb !== null && na === nb;
}
