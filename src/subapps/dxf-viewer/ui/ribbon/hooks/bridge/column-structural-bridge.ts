'use client';

/**
 * ADR-456 Slice 2 — Column structural/reinforcement bridge logic.
 *
 * Pure-ish read/write helpers που γεφυρώνουν το structural ribbon panel με
 * (α) το per-element `ColumnParams.concreteGrade`/`reinforcement` και (β) το
 * building-level `structuralSettingsStore` (κανονισμός). Εξάγεται από το
 * `useRibbonColumnBridge` ώστε το hook να μένει < 500 γραμμές (N.7.1). Όλη η
 * στατική λογική ζει στο `bim/structural/` — εδώ μόνο routing.
 *
 * Όταν δεν έχει οριστεί `reinforcement`, οι combos/readouts δείχνουν τον
 * code-suggested ελάχιστο-έγκυρο οπλισμό ως live default (Revit-grade: πάντα
 * έγκυρη ένδειξη)· η πρώτη επεξεργασία τον υλοποιεί.
 *
 * @see ./structural-param.ts
 */

import type { ColumnEntity, ColumnParams } from '../../../../bim/types/column-types';
import { useStructuralSettingsStore } from '../../../../state/structural-settings-store';
import {
  resolveStructuralCode,
  isStructuralCodeId,
  type ColumnSectionContext,
} from '../../../../bim/structural/codes';
import { isConcreteGrade } from '../../../../bim/structural/concrete-grades';
import type { ColumnReinforcement } from '../../../../bim/structural/reinforcement/column-reinforcement-types';
import {
  DEFAULT_STIRRUP_TYPE,
  isStirrupType,
  DEFAULT_CROSS_TIE_PATTERN,
  isCrossTiePattern,
} from '../../../../bim/structural/reinforcement/column-reinforcement-types';
import {
  COLUMN_STRUCTURAL_KEYS,
  COLUMN_STRUCTURAL_KEY_TO_FIELD,
} from './column-command-keys';
import {
  readReinforcementField,
  patchReinforcementField,
  resolveStructuralReadout,
} from './structural-param';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

type DispatchParams = (nextParams: ColumnParams) => void;

/** Section context (mm/mm²) για code-providers + ποσότητες — geometry-is-SSoT. */
function buildSectionContext(column: ColumnEntity): ColumnSectionContext {
  const p = column.params;
  const grossAreaMm2 =
    column.geometry.area > 0
      ? column.geometry.area * 1e6
      : Math.max(0, p.width) * Math.max(0, p.depth);
  return { widthMm: p.width, depthMm: p.depth, heightMm: p.height, grossAreaMm2 };
}

/** Ενεργός οπλισμός = ορισμένος ή (αν απών) code-suggested ελάχιστος-έγκυρος. */
function effectiveReinforcement(column: ColumnEntity): ColumnReinforcement {
  const r = column.params.reinforcement;
  if (r) return r;
  const { codeId } = useStructuralSettingsStore.getState();
  return resolveStructuralCode(codeId).suggestColumnReinforcement(buildSectionContext(column));
}

/** Combobox state ενός editable structural key, ή `null` αν δεν ανήκει εδώ. */
export function resolveColumnStructuralState(
  column: ColumnEntity,
  commandKey: string,
): RibbonComboboxState | null {
  const store = useStructuralSettingsStore.getState();
  if (commandKey === COLUMN_STRUCTURAL_KEYS.code) {
    return { value: store.codeId, options: [] };
  }
  if (commandKey === COLUMN_STRUCTURAL_KEYS.concreteGrade) {
    return { value: column.params.concreteGrade ?? store.defaultConcreteGrade, options: [] };
  }
  if (commandKey === COLUMN_STRUCTURAL_KEYS.stirrupType) {
    return { value: effectiveReinforcement(column).stirrups.type ?? DEFAULT_STIRRUP_TYPE, options: [] };
  }
  if (commandKey === COLUMN_STRUCTURAL_KEYS.crossTiePattern) {
    return { value: effectiveReinforcement(column).crossTiePattern ?? DEFAULT_CROSS_TIE_PATTERN, options: [] };
  }
  const field = COLUMN_STRUCTURAL_KEY_TO_FIELD[commandKey];
  if (!field) return null;
  const eff = effectiveReinforcement(column);
  return { value: String(Math.round(readReinforcementField(eff, field))), options: [] };
}

/** Read-only readout state (βάρη/ρ%), ή `null` αν δεν είναι readout key. */
export function resolveColumnStructuralReadout(
  column: ColumnEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const eff = effectiveReinforcement(column);
  const value = resolveStructuralReadout(
    readoutKey,
    column.geometry.volume,
    buildSectionContext(column),
    eff,
  );
  return value == null ? null : { value, options: [] };
}

/**
 * Εφάρμοσε αλλαγή editable structural key. `code` → building setting (store)·
 * `concreteGrade` → per-element dispatch· αριθμητικά πεδία → patch reinforcement
 * (από τον effective). Επιστρέφει `true` αν το key ανήκε στο structural group.
 */
export function applyColumnStructuralChange(
  column: ColumnEntity,
  commandKey: string,
  value: string,
  dispatchParams: DispatchParams,
): boolean {
  if (commandKey === COLUMN_STRUCTURAL_KEYS.code) {
    if (isStructuralCodeId(value)) useStructuralSettingsStore.getState().setCodeId(value);
    return true;
  }
  if (commandKey === COLUMN_STRUCTURAL_KEYS.concreteGrade) {
    if (isConcreteGrade(value)) dispatchParams({ ...column.params, concreteGrade: value });
    return true;
  }
  if (commandKey === COLUMN_STRUCTURAL_KEYS.stirrupType) {
    if (isStirrupType(value)) {
      const eff = effectiveReinforcement(column);
      dispatchParams({
        ...column.params,
        reinforcement: { ...eff, stirrups: { ...eff.stirrups, type: value } },
      });
    }
    return true;
  }
  if (commandKey === COLUMN_STRUCTURAL_KEYS.crossTiePattern) {
    if (isCrossTiePattern(value)) {
      const eff = effectiveReinforcement(column);
      dispatchParams({ ...column.params, reinforcement: { ...eff, crossTiePattern: value } });
    }
    return true;
  }
  const field = COLUMN_STRUCTURAL_KEY_TO_FIELD[commandKey];
  if (!field) return false;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return true;
  const next = patchReinforcementField(effectiveReinforcement(column), field, numeric);
  dispatchParams({ ...column.params, reinforcement: next });
  return true;
}

/** «Auto οπλισμός» — code-suggested ελάχιστος-έγκυρος οπλισμός → dispatch. */
export function autoReinforceColumn(column: ColumnEntity, dispatchParams: DispatchParams): void {
  const { codeId } = useStructuralSettingsStore.getState();
  const suggestion = resolveStructuralCode(codeId).suggestColumnReinforcement(
    buildSectionContext(column),
  );
  dispatchParams({ ...column.params, reinforcement: suggestion });
}
