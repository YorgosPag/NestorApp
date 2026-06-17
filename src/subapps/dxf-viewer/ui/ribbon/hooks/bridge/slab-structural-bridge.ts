'use client';

/**
 * ADR-476 — Slab structural/reinforcement bridge logic.
 *
 * Pure-ish read/write helpers που γεφυρώνουν το slab Properties panel με (α) το
 * per-element `SlabParams.concreteGrade`/`structuralReinforcement` και (β) το
 * building-level `structuralSettingsStore` (κανονισμός). Mirror του
 * `beam-structural-bridge.ts`. Όλη η στατική λογική ζει στο `bim/structural/` —
 * εδώ μόνο routing.
 *
 * Η πλάκα οπλίζεται με **σχάρες** (`SlabFoundationReinforcement` — universal, ADR-476):
 * ένα ζεύγος combos κάτω + ένα άνω (X/Y ίδια στο default UI — ένα διάνυσμα ανά στρώση,
 * DEFER ξεχωριστά X/Y). Όταν δεν έχει οριστεί `structuralReinforcement`, οι combos/
 * readouts δείχνουν τον code-suggested ελάχιστο-έγκυρο οπλισμό ως live default (Revit-
 * grade)· η πρώτη επεξεργασία τον υλοποιεί (`auto:false` lock).
 *
 * @see ./slab-command-keys.ts
 */

import type { SlabEntity, SlabParams } from '../../../../bim/types/slab-types';
import { useStructuralSettingsStore } from '../../../../state/structural-settings-store';
import {
  resolveStructuralCode,
  isStructuralCodeId,
} from '../../../../bim/structural/codes';
import {
  buildSlabFoundationSectionContext,
  resolveActiveSlabReinforcement,
} from '../../../../bim/structural/section-context';
import { isConcreteGrade } from '../../../../bim/structural/concrete-grades';
import type {
  RebarMesh,
  SlabFoundationReinforcement,
} from '../../../../bim/structural/reinforcement/slab-foundation-reinforcement-types';
import {
  formatSlabFoundationMainLabel,
  formatSlabFoundationTopLabel,
} from '../../../../bim/structural/reinforcement/slab-foundation-reinforcement-types';
import { computeSlabFoundationReinforcementQuantities } from '../../../../bim/structural/reinforcement/slab-foundation-reinforcement-compute';
import {
  combineUls,
  EN1990_ULS_FACTORS,
} from '../../../../bim/structural/loads/load-combinations';
import {
  resolveAppliedMemberLoad,
  isZeroMemberLoad,
} from '../../../../bim/structural/loads/structural-loads-types';
import {
  SLAB_STRUCTURAL_KEYS,
  SLAB_STRUCTURAL_KEY_TO_FIELD,
  SLAB_STRUCTURAL_READOUT_KEYS,
  type SlabStructuralReinforcementField,
} from './slab-command-keys';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

type DispatchParams = (nextParams: SlabParams) => void;

/**
 * Ενεργός οπλισμός = (auto ⇒ φρέσκο code-suggested από την τρέχουσα γεωμετρία· manual ⇒
 * το stored) ή, αν απών, code-suggested ελάχιστος-έγκυρος ως live default. Δρομολογείται
 * μέσω του SSoT `resolveActiveSlabReinforcement` ώστε ο πίνακας να δείχνει τον ΙΔΙΟ
 * (real-time) οπλισμό με 2Δ/3Δ.
 */
function effectiveReinforcement(slab: SlabEntity): SlabFoundationReinforcement {
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const active = resolveActiveSlabReinforcement(slab, provider);
  return active ?? provider.suggestSlabFoundationReinforcement(buildSlabFoundationSectionContext(slab));
}

/** Διαβάζει το αριθμητικό πεδίο σχάρας από τον ενεργό οπλισμό (X = αντιπροσωπευτικό). */
function readSlabReinforcementField(
  r: SlabFoundationReinforcement,
  field: SlabStructuralReinforcementField,
): number {
  switch (field) {
    case 'bottomMeshDiameter': return r.bottomMeshX.diameterMm;
    case 'bottomMeshSpacing': return r.bottomMeshX.spacingMm;
    case 'topMeshDiameter': return r.topMeshX.diameterMm;
    case 'topMeshSpacing': return r.topMeshX.spacingMm;
    case 'cover': return r.coverMm;
  }
}

/**
 * Patch ενός πεδίου σχάρας. Η αλλαγή διαμέτρου/βήματος εφαρμόζεται **και στις δύο
 * διευθύνσεις** (X+Y) — ένα ζεύγος combos ανά στρώση (default UI). Επιστρέφει νέο
 * immutable αντικείμενο (μηδέν mutation).
 */
function patchSlabReinforcementField(
  r: SlabFoundationReinforcement,
  field: SlabStructuralReinforcementField,
  value: number,
): SlabFoundationReinforcement {
  const withDiameter = (m: RebarMesh): RebarMesh => ({ ...m, diameterMm: value });
  const withSpacing = (m: RebarMesh): RebarMesh => ({ ...m, spacingMm: value });
  switch (field) {
    case 'bottomMeshDiameter':
      return { ...r, bottomMeshX: withDiameter(r.bottomMeshX), bottomMeshY: withDiameter(r.bottomMeshY) };
    case 'bottomMeshSpacing':
      return { ...r, bottomMeshX: withSpacing(r.bottomMeshX), bottomMeshY: withSpacing(r.bottomMeshY) };
    case 'topMeshDiameter':
      return { ...r, topMeshX: withDiameter(r.topMeshX), topMeshY: withDiameter(r.topMeshY) };
    case 'topMeshSpacing':
      return { ...r, topMeshX: withSpacing(r.topMeshX), topMeshY: withSpacing(r.topMeshY) };
    case 'cover':
      return { ...r, coverMm: value };
  }
}

/** Combobox state ενός editable structural key, ή `null` αν δεν ανήκει εδώ. */
export function resolveSlabStructuralState(
  slab: SlabEntity,
  commandKey: string,
): RibbonComboboxState | null {
  const store = useStructuralSettingsStore.getState();
  if (commandKey === SLAB_STRUCTURAL_KEYS.code) {
    return { value: store.codeId, options: [] };
  }
  if (commandKey === SLAB_STRUCTURAL_KEYS.concreteGrade) {
    return { value: slab.params.concreteGrade ?? store.defaultConcreteGrade, options: [] };
  }
  const field = SLAB_STRUCTURAL_KEY_TO_FIELD[commandKey];
  if (!field) return null;
  return { value: String(Math.round(readSlabReinforcementField(effectiveReinforcement(slab), field))), options: [] };
}

/**
 * ADR-467 — Read-only readout του επιφανειακού φορτίου σχεδιασμού (g/q/q_Ed) από το
 * persisted `params.appliedLoad` (tributary ÷ εμβαδό). Επιστρέφει `null` αν το key δεν
 * ανήκει εδώ· «—» όταν δεν έχει υπολογιστεί φορτίο (Revit-grade πάντα-έγκυρη ένδειξη).
 */
function resolveSlabLoadReadout(
  slab: SlabEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const K = SLAB_STRUCTURAL_READOUT_KEYS;
  if (
    readoutKey !== K.loadDeadArea &&
    readoutKey !== K.loadLiveArea &&
    readoutKey !== K.loadUlsArea
  ) {
    return null;
  }
  const areaM2 = buildSlabFoundationSectionContext(slab).grossAreaMm2 / 1e6;
  const load = resolveAppliedMemberLoad(slab.params.appliedLoad);
  if (areaM2 <= 0 || isZeroMemberLoad(load)) return { value: '—', options: [] };
  if (readoutKey === K.loadDeadArea) {
    return { value: (load.deadAxialKn / areaM2).toFixed(1), options: [] };
  }
  if (readoutKey === K.loadLiveArea) {
    return { value: (load.liveAxialKn / areaM2).toFixed(1), options: [] };
  }
  // q_Ed — γ_G·g + γ_Q·q (EN1990 fundamental combination, ΙΔΙΟΣ SSoT με τον
  // `resolveSlabDesignLoad` του section-context → readout === ό,τι «βλέπει» ο suggester).
  return { value: (combineUls(load, EN1990_ULS_FACTORS).axialKn / areaM2).toFixed(1), options: [] };
}

/** Read-only readout state (labels σχάρας/βάρος/ρ% + ADR-467 φορτίο), ή `null` αν δεν είναι readout key. */
export function resolveSlabStructuralReadoutState(
  slab: SlabEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const loadState = resolveSlabLoadReadout(slab, readoutKey);
  if (loadState) return loadState;
  const K = SLAB_STRUCTURAL_READOUT_KEYS;
  const eff = effectiveReinforcement(slab);
  if (readoutKey === K.bottomLabel) {
    return { value: formatSlabFoundationMainLabel(eff), options: [] };
  }
  if (readoutKey === K.topLabel) {
    return { value: formatSlabFoundationTopLabel(eff), options: [] };
  }
  if (readoutKey === K.steelWeight || readoutKey === K.ratio) {
    const q = computeSlabFoundationReinforcementQuantities(
      buildSlabFoundationSectionContext(slab),
      eff,
    );
    if (readoutKey === K.steelWeight) {
      return { value: String(Math.round(q.totalSteelWeightKg)), options: [] };
    }
    return { value: (q.ratio * 100).toFixed(2), options: [] };
  }
  return null;
}

/**
 * Εφάρμοσε αλλαγή editable structural key. `code` → building setting (store)·
 * `concreteGrade` → per-element dispatch· αριθμητικά πεδία → patch σχάρας (από τον
 * effective, `auto:false` lock). Επιστρέφει `true` αν το key ανήκε εδώ.
 */
export function applySlabStructuralChange(
  slab: SlabEntity,
  commandKey: string,
  value: string,
  dispatchParams: DispatchParams,
): boolean {
  if (commandKey === SLAB_STRUCTURAL_KEYS.code) {
    if (isStructuralCodeId(value)) useStructuralSettingsStore.getState().setCodeId(value);
    return true;
  }
  if (commandKey === SLAB_STRUCTURAL_KEYS.concreteGrade) {
    if (isConcreteGrade(value)) dispatchParams({ ...slab.params, concreteGrade: value });
    return true;
  }
  const field = SLAB_STRUCTURAL_KEY_TO_FIELD[commandKey];
  if (!field) return false;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return true;
  // Χειροκίνητη αλλαγή design πεδίου → ΚΛΕΙΔΩΝΕΙ το design (`auto:false`): από εδώ και πέρα
  // δεν ξανα-υπολογίζεται αυτόματα στο resize (Revit «manual», parity με κολόνα/δοκάρι).
  const next = patchSlabReinforcementField(effectiveReinforcement(slab), field, numeric);
  dispatchParams({ ...slab.params, structuralReinforcement: { ...next, auto: false } });
  return true;
}
