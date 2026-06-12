/**
 * ADR-449 Slice 5 — Structural finish (σοβάς) per-element ribbon override SSoT.
 *
 * Κοινό για τα contextual tabs κολόνας & δοκαριού: combobox options (enabled / υλικό
 * εσωτ.-εξωτ. / πάχος) + generic read/apply helpers πάνω στον pure core
 * (`structural-finish-types`). ΕΝΑ σημείο — μηδέν διπλασιασμός column/beam. Mirror
 * του barrel pattern του `envelope-function-param`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import {
  STRUCTURAL_FINISH_INTERIOR_MATERIAL,
  STRUCTURAL_FINISH_EXTERIOR_MATERIAL,
  readFinishParamValue,
  applyFinishParam,
  type FinishParamField,
  type StructuralFinishSpec,
} from '../../../../bim/finishes/structural-finish-types';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

export type { FinishParamField };

interface FinishComboboxOption {
  readonly value: string;
  readonly labelKey: string;
  readonly isLiteralLabel: boolean;
}

/** Master enable/disable του σοβά ανά στοιχείο (Ναι/Όχι). */
export const FINISH_ENABLED_OPTIONS: readonly FinishComboboxOption[] = [
  { value: 'on', labelKey: 'ribbon.commands.finishEditor.enabled.on', isLiteralLabel: false },
  { value: 'off', labelKey: 'ribbon.commands.finishEditor.enabled.off', isLiteralLabel: false },
];

/** Υλικά σοβά — REUSE plaster catalog IDs (wall material catalog, ADR-447). */
export const FINISH_MATERIAL_OPTIONS: readonly FinishComboboxOption[] = [
  { value: STRUCTURAL_FINISH_INTERIOR_MATERIAL, labelKey: 'wallAdvancedPanel.materials.preset.mat-plaster-int', isLiteralLabel: false },
  { value: STRUCTURAL_FINISH_EXTERIOR_MATERIAL, labelKey: 'wallAdvancedPanel.materials.preset.mat-plaster-ext', isLiteralLabel: false },
];

/** Συνήθη πάχη σοβά σε mm (literal labels). */
export const FINISH_THICKNESS_OPTIONS: readonly FinishComboboxOption[] = [
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
];

/**
 * Combobox state ενός finish commandKey, ή `null` όταν το key δεν ανήκει στο finish
 * group. `keyToField` = entity-specific map (column/beam command-keys → πεδίο spec).
 */
export function resolveFinishComboboxState(
  spec: StructuralFinishSpec | undefined,
  commandKey: string,
  keyToField: Readonly<Record<string, FinishParamField>>,
): RibbonComboboxState | null {
  const field = keyToField[commandKey];
  if (!field) return null;
  return { value: readFinishParamValue(spec, field), options: [] };
}

/**
 * Νέο params object με ενημερωμένο `finish`, ή `null` όταν το key δεν είναι finish
 * key Ή η τιμή είναι άκυρη (no-op). Entity-agnostic πάνω σε οτιδήποτε έχει `finish?`.
 */
export function applyFinishComboboxChange<P extends { finish?: StructuralFinishSpec }>(
  params: P,
  commandKey: string,
  value: string,
  keyToField: Readonly<Record<string, FinishParamField>>,
): P | null {
  const field = keyToField[commandKey];
  if (!field) return null;
  const next = applyFinishParam(params.finish, field, value);
  return next ? { ...params, finish: next } : null;
}
