/**
 * RIBBON NUMERIC OPTIONS — SSoT for literal-number combobox option ladders.
 *
 * Many contextual-ribbon comboboxes offer a fixed ladder of integer presets
 * (step counts, story counts, mm dimensions, …) whose visible label IS the
 * number itself — no i18n round-trip (`isLiteralLabel: true`). Hand-writing each
 * `{ value, labelKey, isLiteralLabel }` array duplicates the same shape N times
 * (flagged by CHECK 3.28 / jscpd, ADR-583). This module is the single builder:
 * pass the raw values, get the option array.
 *
 * @see ./contextual-stair-tab.ts — step/story/winder/mm ladders
 * @see ./mep-manifold-contextual-tab-factory.ts — mm / count presets (delegate here)
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';

/**
 * Build a literal-number option ladder: each value renders as its own number
 * (bypassing t()). Accepts numbers or pre-formatted strings.
 */
export function literalNumberOptions(
  values: readonly (number | string)[],
): readonly RibbonComboboxOption[] {
  return values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));
}
