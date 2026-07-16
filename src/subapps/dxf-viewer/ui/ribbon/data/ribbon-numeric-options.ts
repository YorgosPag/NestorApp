/**
 * RIBBON NUMERIC OPTIONS — SSoT for small, hand-written combobox option shapes:
 * literal-number ladders, catalog-array mappings, and the shared MEP-fixture
 * parametric-3D-view fallback.
 *
 * Many contextual-ribbon comboboxes offer a fixed ladder of integer presets
 * (step counts, story counts, mm dimensions, …) whose visible label IS the
 * number itself — no i18n round-trip (`isLiteralLabel: true`). Hand-writing each
 * `{ value, labelKey, isLiteralLabel }` array duplicates the same shape N times
 * (flagged by CHECK 3.28 / jscpd, ADR-583). Likewise, mapping a `{id, labelKey}`
 * SSoT catalog array (floorplan symbols, furniture, mesh libraries, …) into
 * combobox options is the same 3-line arrow function copy-pasted per catalog.
 * This module is the single builder for both shapes: pass the raw
 * values/catalog, get the option array.
 *
 * @see ./contextual-stair-tab.ts — step/story/winder/mm ladders
 * @see ./mep-manifold-contextual-tab-factory.ts — mm / count presets (delegate here)
 * @see ./mep-outlet-contextual-tab-factory.ts — socket/data-outlet presets + 3D-view fallback
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

/**
 * Build a literal-number option ladder: each value renders as its own number
 * (bypassing t()). Accepts numbers or pre-formatted strings.
 */
export function literalNumberOptions(
  values: readonly (number | string)[],
): readonly RibbonComboboxOption[] {
  return values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));
}

/**
 * Build combobox options from an SSoT catalog array shaped `{ id, labelKey }`
 * (floorplan symbols, furniture, mesh libraries, …). Labels route through
 * t() — NOT literal (`isLiteralLabel: false`), unlike `literalNumberOptions`.
 */
export function catalogOptions<T extends { readonly id: string; readonly labelKey: string }>(
  items: readonly T[],
): readonly RibbonComboboxOption[] {
  return items.map((item) => ({ value: item.id, labelKey: item.labelKey, isLiteralLabel: false }));
}

/**
 * ADR-408/411 — 3D representation fallback shared by every `mep-fixture`
 * contextual tab (appliance, sanitary, socket, data-outlet, …): parametric box
 * (default) vs a realistic glTF mesh. The kind-specific mesh list is supplied
 * DYNAMICALLY per selected fixture by `useRibbonMepFixtureBridge.getComboboxState`
 * (Revit-correct — a WC offers only WC models). This static single-option list is
 * only the kind-blind fallback rendered when no fixture is selected — hence
 * parametric-only.
 */
export const MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS: readonly RibbonComboboxOption[] = [
  {
    value: SELECT_CLEAR_VALUE,
    labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.threeDViewParametric',
    isLiteralLabel: false,
  },
];
