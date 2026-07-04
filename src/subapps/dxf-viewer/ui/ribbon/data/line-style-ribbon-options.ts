/**
 * ADR-570 Φ1 — ribbon options for the «Στυλ Γραμμής ▾» (ByStyle) chooser.
 *
 * Maps the live `LineStyleRegistry` snapshot to `RibbonComboboxOption[]`. Built-in
 * styles carry an i18n KEY in `name` (`isLiteralLabel: false` ⇒ run through `t()`,
 * N.11); custom styles carry a literal user-entered name (`isLiteralLabel: true`).
 * Dynamic (function, not const): consumers wrap it in `useMemo` keyed on the
 * registry snapshot — mirror of `buildLinetypeRibbonOptions`.
 *
 * @see systems/line-styles/line-style-registry — `getLineStyleSnapshot`
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';
import type { LineStyle } from '../../../systems/line-styles/line-style-types';

/** Registry styles → chooser options (value = style id). */
export function buildLineStyleRibbonOptions(
  styles: readonly LineStyle[],
): readonly RibbonComboboxOption[] {
  return styles.map((style) => ({
    value: style.id,
    labelKey: style.name,
    isLiteralLabel: !style.isBuiltIn,
  }));
}
