'use client';

/**
 * ADR-471 — Beam structural/reinforcement bridge logic.
 *
 * Pure-ish read/write helpers που γεφυρώνουν το beam Properties panel με (α) το
 * per-element `BeamParams.concreteGrade`/`reinforcement` και (β) το building-level
 * `structuralSettingsStore` (κανονισμός). Mirror του `column-structural-bridge.ts`.
 * Όλη η στατική λογική ζει στο `bim/structural/` — εδώ μόνο routing.
 *
 * Όταν δεν έχει οριστεί `reinforcement`, οι combos/readouts δείχνουν τον
 * code-suggested ελάχιστο-έγκυρο οπλισμό ως live default (Revit-grade: πάντα
 * έγκυρη ένδειξη)· η πρώτη επεξεργασία τον υλοποιεί (`auto:false` lock).
 *
 * @see ./beam-structural-param.ts
 */

import type { BeamEntity, BeamParams } from '../../../../bim/types/beam-types';
import { useStructuralSettingsStore } from '../../../../state/structural-settings-store';
import {
  resolveStructuralCode,
  isStructuralCodeId,
} from '../../../../bim/structural/codes';
import {
  buildBeamSectionContext,
  resolveActiveBeamReinforcement,
} from '../../../../bim/structural/section-context';
import { isConcreteGrade } from '../../../../bim/structural/concrete-grades';
import type { BeamReinforcement } from '../../../../bim/structural/reinforcement/beam-reinforcement-types';
import {
  DEFAULT_STIRRUP_TYPE,
  isStirrupType,
} from '../../../../bim/structural/reinforcement/column-reinforcement-types';
import {
  combineUls,
  EN1990_ULS_FACTORS,
} from '../../../../bim/structural/loads/load-combinations';
import {
  resolveAppliedMemberLoad,
  isZeroMemberLoad,
} from '../../../../bim/structural/loads/structural-loads-types';
import {
  BEAM_STRUCTURAL_KEYS,
  BEAM_STRUCTURAL_KEY_TO_FIELD,
  BEAM_STRUCTURAL_READOUT_KEYS,
} from './beam-command-keys';
import {
  readBeamReinforcementField,
  patchBeamReinforcementField,
  resolveBeamStructuralReadout,
} from './beam-structural-param';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

type DispatchParams = (nextParams: BeamParams) => void;

/**
 * Ενεργός οπλισμός = (auto ⇒ φρέσκο code-suggested από την τρέχουσα γεωμετρία· manual ⇒
 * το stored) ή, αν απών, code-suggested ελάχιστος-έγκυρος ως live default. Δρομολογείται
 * μέσω του SSoT `resolveActiveBeamReinforcement` ώστε ο πίνακας να δείχνει τον ΙΔΙΟ
 * (real-time) οπλισμό με 2Δ/3Δ/PDF.
 */
function effectiveReinforcement(beam: BeamEntity): BeamReinforcement {
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const active = resolveActiveBeamReinforcement(beam, provider);
  return active ?? provider.suggestBeamReinforcement(buildBeamSectionContext(beam));
}

/** Combobox state ενός editable structural key, ή `null` αν δεν ανήκει εδώ. */
export function resolveBeamStructuralState(
  beam: BeamEntity,
  commandKey: string,
): RibbonComboboxState | null {
  const store = useStructuralSettingsStore.getState();
  if (commandKey === BEAM_STRUCTURAL_KEYS.code) {
    return { value: store.codeId, options: [] };
  }
  if (commandKey === BEAM_STRUCTURAL_KEYS.concreteGrade) {
    return { value: beam.params.concreteGrade ?? store.defaultConcreteGrade, options: [] };
  }
  if (commandKey === BEAM_STRUCTURAL_KEYS.stirrupType) {
    return { value: effectiveReinforcement(beam).stirrups.type ?? DEFAULT_STIRRUP_TYPE, options: [] };
  }
  const field = BEAM_STRUCTURAL_KEY_TO_FIELD[commandKey];
  if (!field) return null;
  return { value: String(Math.round(readBeamReinforcementField(effectiveReinforcement(beam), field))), options: [] };
}

/**
 * ADR-467 — Read-only readout του γραμμικού φορτίου σχεδιασμού (g/q/w_Ed) από το
 * persisted `params.appliedLoad` (tributary takedown, ÷ άνοιγμα). Επιστρέφει `null`
 * αν το key δεν ανήκει εδώ· «—» όταν δεν έχει υπολογιστεί φορτίο (Revit-grade).
 */
function resolveBeamLoadReadout(
  beam: BeamEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const K = BEAM_STRUCTURAL_READOUT_KEYS;
  if (
    readoutKey !== K.loadDeadLine &&
    readoutKey !== K.loadLiveLine &&
    readoutKey !== K.loadUlsLine
  ) {
    return null;
  }
  const spanM = beam.geometry.length;
  const load = resolveAppliedMemberLoad(beam.params.appliedLoad);
  if (spanM <= 0 || isZeroMemberLoad(load)) return { value: '—', options: [] };
  if (readoutKey === K.loadDeadLine) {
    return { value: (load.deadAxialKn / spanM).toFixed(1), options: [] };
  }
  if (readoutKey === K.loadLiveLine) {
    return { value: (load.liveAxialKn / spanM).toFixed(1), options: [] };
  }
  // w_Ed — γ_G·g + γ_Q·q (EN1990 fundamental combination, ΙΔΙΟΣ SSoT με τον
  // `resolveBeamDesignLoad` του section-context → readout === ό,τι «βλέπει» ο suggester).
  return { value: (combineUls(load, EN1990_ULS_FACTORS).axialKn / spanM).toFixed(1), options: [] };
}

/** Read-only readout state (όγκοι/βάρη/ρ% + ADR-467 φορτίο), ή `null` αν δεν είναι readout key. */
export function resolveBeamStructuralReadoutState(
  beam: BeamEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const loadState = resolveBeamLoadReadout(beam, readoutKey);
  if (loadState) return loadState;
  const value = resolveBeamStructuralReadout(
    readoutKey,
    buildBeamSectionContext(beam),
    effectiveReinforcement(beam),
  );
  return value == null ? null : { value, options: [] };
}

/**
 * Εφάρμοσε αλλαγή editable structural key. `code` → building setting (store)·
 * `concreteGrade` → per-element dispatch· αριθμητικά πεδία → patch reinforcement
 * (από τον effective, `auto:false` lock). Επιστρέφει `true` αν το key ανήκε εδώ.
 */
export function applyBeamStructuralChange(
  beam: BeamEntity,
  commandKey: string,
  value: string,
  dispatchParams: DispatchParams,
): boolean {
  if (commandKey === BEAM_STRUCTURAL_KEYS.code) {
    if (isStructuralCodeId(value)) useStructuralSettingsStore.getState().setCodeId(value);
    return true;
  }
  if (commandKey === BEAM_STRUCTURAL_KEYS.concreteGrade) {
    if (isConcreteGrade(value)) dispatchParams({ ...beam.params, concreteGrade: value });
    return true;
  }
  if (commandKey === BEAM_STRUCTURAL_KEYS.stirrupType) {
    if (isStirrupType(value)) {
      const eff = effectiveReinforcement(beam);
      dispatchParams({
        ...beam.params,
        reinforcement: { ...eff, stirrups: { ...eff.stirrups, type: value }, auto: false },
      });
    }
    return true;
  }
  const field = BEAM_STRUCTURAL_KEY_TO_FIELD[commandKey];
  if (!field) return false;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return true;
  // Χειροκίνητη αλλαγή design πεδίου → ΚΛΕΙΔΩΝΕΙ το design (`auto:false`): από εδώ και πέρα
  // δεν ξανα-υπολογίζεται αυτόματα στο resize (Revit «manual», parity με κολόνα).
  const next = patchBeamReinforcementField(effectiveReinforcement(beam), field, numeric);
  dispatchParams({ ...beam.params, reinforcement: { ...next, auto: false } });
  return true;
}
