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
} from '../../../../bim/structural/codes';
// ADR-459 Φ4d — SSoT entity→SectionContext builder (πρώην inline εδώ· εξήχθη, N.0.2).
// ADR-456/460 — resolveActiveColumnReinforcement = auto-derive SSoT (Giorgio 2026-06-16).
import {
  buildColumnSectionContext,
  resolveActiveColumnReinforcement,
} from '../../../../bim/structural/section-context';
import { resolveColumnReinforcementSection } from '../../../../bim/structural/reinforcement/column-section-outline';
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
  COLUMN_STRUCTURAL_READOUT_KEYS,
} from './column-command-keys';
import {
  readReinforcementField,
  patchReinforcementField,
  resolveStructuralReadout,
} from './structural-param';
// ADR-467 — διαδρομή φορτίων: αξονικό φορτίο σχεδιασμού (G/Q/ULS) από το persisted
// `params.appliedLoad`. Συνδυασμός μέσω του κοινού EN1990 SSoT (μηδέν inline math).
import {
  resolveAppliedMemberLoad,
  isZeroMemberLoad,
} from '../../../../bim/structural/loads/structural-loads-types';
import { combineUls } from '../../../../bim/structural/loads/load-combinations';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

type DispatchParams = (nextParams: ColumnParams) => void;

/**
 * Ενεργός οπλισμός = (auto ⇒ φρέσκο code-suggested από την τρέχουσα γεωμετρία· manual ⇒
 * το stored) ή, αν απών, code-suggested ελάχιστος-έγκυρος ως live default. Δρομολογείται
 * μέσω του SSoT `resolveActiveColumnReinforcement` ώστε ο πίνακας να δείχνει τον ΙΔΙΟ
 * (real-time) οπλισμό με 2Δ/3Δ.
 */
function effectiveReinforcement(column: ColumnEntity): ColumnReinforcement {
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const active = resolveActiveColumnReinforcement(column.params, provider);
  return active ?? provider.suggestColumnReinforcement(buildColumnSectionContext(column));
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

/**
 * ADR-467 — Read-only readout του αξονικού φορτίου σχεδιασμού (G/Q/N_Ed) από το
 * persisted `params.appliedLoad`. Επιστρέφει `null` αν το key δεν ανήκει εδώ· «—»
 * όταν δεν έχει υπολογιστεί φορτίο (μηδενικό/απών) — Revit-grade πάντα-έγκυρη ένδειξη.
 */
function resolveColumnLoadReadout(
  column: ColumnEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const K = COLUMN_STRUCTURAL_READOUT_KEYS;
  if (
    readoutKey !== K.loadDeadAxial &&
    readoutKey !== K.loadLiveAxial &&
    readoutKey !== K.loadUlsAxial
  ) {
    return null;
  }
  const load = resolveAppliedMemberLoad(column.params.appliedLoad);
  if (isZeroMemberLoad(load)) return { value: '—', options: [] };
  if (readoutKey === K.loadDeadAxial) {
    return { value: String(Math.round(load.deadAxialKn)), options: [] };
  }
  if (readoutKey === K.loadLiveAxial) {
    return { value: String(Math.round(load.liveAxialKn)), options: [] };
  }
  // N_Ed — γ_G·G + γ_Q·Q με τους code-specific συντελεστές του ενεργού κανονισμού
  // (EN1990 fundamental combination, κοινός SSoT με τον σχεδιασμό θεμελίωσης).
  const factors = resolveStructuralCode(
    useStructuralSettingsStore.getState().codeId,
  ).footingDesignFactors().combination;
  return { value: String(Math.round(combineUls(load, factors).axialKn)), options: [] };
}

/** Read-only readout state (βάρη/ρ% + ADR-467 φορτίο), ή `null` αν δεν είναι readout key. */
export function resolveColumnStructuralReadout(
  column: ColumnEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const loadState = resolveColumnLoadReadout(column, readoutKey);
  if (loadState) return loadState;
  const eff = effectiveReinforcement(column);
  const value = resolveStructuralReadout(
    readoutKey,
    column.geometry.volume,
    buildColumnSectionContext(column),
    eff,
    resolveColumnReinforcementSection(column.params),
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
  // Χειροκίνητη αλλαγή design πεδίου (Ø/πλήθος/βήμα/επικάλυψη) → ΚΛΕΙΔΩΝΕΙ το design
  // (`auto:false`): από εδώ και πέρα δεν ξανα-υπολογίζεται αυτόματα στο resize (Revit «manual»).
  const next = patchReinforcementField(effectiveReinforcement(column), field, numeric);
  dispatchParams({ ...column.params, reinforcement: { ...next, auto: false } });
  return true;
}

/**
 * «Αυτόματος Οπλισμός» — code-suggested ελάχιστος-έγκυρος οπλισμός με `auto:true` ⇒
 * από εδώ και πέρα ο οπλισμός **DERIVED σε πραγματικό χρόνο** σε κάθε αλλαγή διαστάσεων
 * (`resolveActiveColumnReinforcement`). Δεν χρειάζεται επανάκληση του κουμπιού.
 */
export function autoReinforceColumn(column: ColumnEntity, dispatchParams: DispatchParams): void {
  const { codeId } = useStructuralSettingsStore.getState();
  const suggestion = resolveStructuralCode(codeId).suggestColumnReinforcement(
    buildColumnSectionContext(column),
  );
  dispatchParams({ ...column.params, reinforcement: { ...suggestion, auto: true } });
}
