'use client';

/**
 * ADR-463 — Foundation combobox read/write resolvers (panel-facing SSoT).
 *
 * ΕΝΑ σημείο που δρομολογεί read (`resolveFoundationComboboxState`) και write
 * (`applyFoundationComboboxChange`) ανά οικογένεια command-key: structural
 * readouts → bridge readouts· structural editable → structural bridge· string
 * params (π.χ. material) + numeric params → τα υπάρχοντα field helpers του
 * `useRibbonFoundationBridge`. Mirror του `column-bridge-combobox-resolvers`.
 *
 * Καταναλώνεται από το docked `FoundationAdvancedPanel` (ίδιο pattern με το
 * `ColumnAdvancedPanel`). Pure routing — μηδέν στατική λογική εδώ.
 */

import type {
  FoundationEntity,
  FoundationParams,
} from '../../../../bim/types/foundation-types';
import {
  isFoundationRibbonKey,
  isFoundationRibbonStringKey,
  isFoundationStructuralKey,
  isFoundationStructuralReadoutKey,
} from './foundation-command-keys';
import {
  resolveFoundationStructuralState,
  resolveFoundationStructuralReadout,
  applyFoundationStructuralChange,
} from './foundation-structural-bridge';
import {
  readSelectedStringField,
  nextParamsForStringChange,
  readNumberField,
  writeNumberField,
} from '../useRibbonFoundationBridge-fields';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

type DispatchParams = (nextParams: FoundationParams) => void;

/** Combobox/readout state ενός command-key για το panel, ή `null`. */
export function resolveFoundationComboboxState(
  commandKey: string,
  footing: FoundationEntity,
): RibbonComboboxState | null {
  if (isFoundationStructuralReadoutKey(commandKey)) {
    return resolveFoundationStructuralReadout(footing, commandKey);
  }
  if (isFoundationStructuralKey(commandKey)) {
    return resolveFoundationStructuralState(footing, commandKey);
  }
  if (isFoundationRibbonStringKey(commandKey)) {
    const s = readSelectedStringField(footing.params, commandKey);
    return s === null ? null : { value: s, options: [] };
  }
  if (isFoundationRibbonKey(commandKey)) {
    const raw = readNumberField(footing.params, commandKey);
    return raw === null ? null : { value: String(Math.round(raw)), options: [] };
  }
  return null;
}

/** Εφάρμοσε αλλαγή ενός editable command-key από το panel. */
export function applyFoundationComboboxChange(
  commandKey: string,
  value: string,
  footing: FoundationEntity,
  dispatch: DispatchParams,
): void {
  if (isFoundationStructuralKey(commandKey)) {
    applyFoundationStructuralChange(footing, commandKey, value, dispatch);
    return;
  }
  if (isFoundationRibbonStringKey(commandKey)) {
    const next = nextParamsForStringChange(footing.params, commandKey, value);
    if (next) dispatch(next);
    return;
  }
  if (isFoundationRibbonKey(commandKey)) {
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    const next = writeNumberField(footing.params, commandKey, numeric);
    if (next) dispatch(next);
  }
}
