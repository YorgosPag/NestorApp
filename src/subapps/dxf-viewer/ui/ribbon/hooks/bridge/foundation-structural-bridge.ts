'use client';

/**
 * ADR-463 — Foundation structural/reinforcement bridge logic.
 *
 * Pure-ish read/write helpers που γεφυρώνουν το foundation structural Properties
 * panel με (α) το per-element `FoundationParams.reinforcement` (kind-discriminated)
 * και (β) το building-level `structuralSettingsStore` (κανονισμός). Mirror του
 * `column-structural-bridge.ts`. Όλη η στατική λογική ζει στο `bim/structural/` —
 * εδώ μόνο routing.
 *
 * Όταν δεν έχει οριστεί `reinforcement`, οι combos/readouts δείχνουν τον
 * code-suggested ελάχιστο-έγκυρο οπλισμό ως live default (Revit-grade: πάντα
 * έγκυρη ένδειξη)· η πρώτη επεξεργασία / «Αυτόματος Οπλισμός» τον υλοποιεί.
 *
 * @see ./foundation-structural-param.ts
 */

import type {
  FoundationEntity,
  FoundationParams,
} from '../../../../bim/types/foundation-types';
import { useStructuralSettingsStore } from '../../../../state/structural-settings-store';
import {
  resolveStructuralCode,
  isStructuralCodeId,
} from '../../../../bim/structural/codes';
import { buildFootingSectionContext } from '../../../../bim/structural/section-context';
import {
  computeFootingReinforcementQuantities,
  formatFootingMainLabel,
} from '../../../../bim/structural/reinforcement/footing-reinforcement-compute';
import type { FootingReinforcement } from '../../../../bim/structural/reinforcement/footing-reinforcement-types';
import { computeFootingDesign } from '../../../../bim/structural/footing-design/footing-design';
import { buildPadFootingDesignInput } from '../../../../bim/structural/footing-design/footing-design-input';
import type { BearingResult } from '../../../../bim/structural/footing-design/footing-design-types';
import {
  FOUNDATION_STRUCTURAL_KEYS,
  FOUNDATION_STRUCTURAL_READOUT_KEYS,
} from './foundation-command-keys';
import {
  readFoundationStructuralField,
  patchFoundationStructuralField,
  readFoundationLoadField,
  patchFoundationLoadField,
  isFoundationLoadKey,
} from './foundation-structural-param';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

type DispatchParams = (nextParams: FoundationParams) => void;

/**
 * Ενεργός οπλισμός = το stored design ή, αν απών, code-suggested ελάχιστος-έγκυρος
 * ως live default. Ο discriminator του suggested ταιριάζει με το `params.kind`
 * (το ctx χτίζεται από το ίδιο params) → ο πίνακας δείχνει τον ΙΔΙΟ οπλισμό με 2Δ/3Δ.
 */
function effectiveReinforcement(footing: FoundationEntity): FootingReinforcement {
  const stored = footing.params.reinforcement;
  if (stored) return stored;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return provider.suggestFootingReinforcement(buildFootingSectionContext(footing));
}

/**
 * Νέα `FoundationParams` με το ενημερωμένο reinforcement (kind-matched, μηδέν cast).
 * `null` αν ο discriminator του reinforcement δεν ταιριάζει με το kind (αδύνατο
 * μέσω του kind-aware descriptor, αλλά ο compiler το διασφαλίζει — N.2).
 */
function withFootingReinforcement(
  params: FoundationParams,
  r: FootingReinforcement,
): FoundationParams | null {
  switch (params.kind) {
    case 'pad': return r.kind === 'pad' ? { ...params, reinforcement: r } : null;
    case 'strip': return r.kind === 'strip' ? { ...params, reinforcement: r } : null;
    case 'tie-beam': return r.kind === 'tie-beam' ? { ...params, reinforcement: r } : null;
  }
}

/**
 * ADR-464 — αποτέλεσμα έδρασης πεδίλου, ή `null` (μη-pad / μηδέν φορτίο / χωρίς
 * σ_allow). Κοινό input-builder με τον diagnostics runner (SSoT).
 */
function resolveBearingResult(footing: FoundationEntity): BearingResult | null {
  const settings = useStructuralSettingsStore.getState();
  if (!settings.soilBearingCapacityKpa) return null;
  const provider = resolveStructuralCode(settings.codeId);
  const input = buildPadFootingDesignInput(footing, provider, settings.soilBearingCapacityKpa);
  return input ? computeFootingDesign(input).bearing : null;
}

/** Combobox state ενός editable structural key, ή `null` αν δεν εφαρμόζεται. */
export function resolveFoundationStructuralState(
  footing: FoundationEntity,
  commandKey: string,
): RibbonComboboxState | null {
  if (commandKey === FOUNDATION_STRUCTURAL_KEYS.code) {
    return { value: useStructuralSettingsStore.getState().codeId, options: [] };
  }
  if (commandKey === FOUNDATION_STRUCTURAL_KEYS.soilBearing) {
    const v = useStructuralSettingsStore.getState().soilBearingCapacityKpa;
    return { value: v != null ? String(v) : '', options: [] };
  }
  if (isFoundationLoadKey(commandKey)) {
    const v = readFoundationLoadField(footing.params, commandKey);
    return v === null ? null : { value: v, options: [] };
  }
  const v = readFoundationStructuralField(effectiveReinforcement(footing), commandKey);
  return v === null ? null : { value: v, options: [] };
}

/** Read-only readout state (κύρια ετικέτα/βάρος/ρ%), ή `null`. */
export function resolveFoundationStructuralReadout(
  footing: FoundationEntity,
  readoutKey: string,
): RibbonComboboxState | null {
  const eff = effectiveReinforcement(footing);
  if (readoutKey === FOUNDATION_STRUCTURAL_READOUT_KEYS.mainLabel) {
    return { value: formatFootingMainLabel(eff), options: [] };
  }
  const q = computeFootingReinforcementQuantities(buildFootingSectionContext(footing), eff);
  if (readoutKey === FOUNDATION_STRUCTURAL_READOUT_KEYS.steelWeight) {
    return { value: String(Math.round(q.totalSteelWeightKg)), options: [] };
  }
  if (readoutKey === FOUNDATION_STRUCTURAL_READOUT_KEYS.ratio) {
    return { value: (q.ratio * 100).toFixed(2), options: [] };
  }
  // ADR-464 — readouts έδρασης (p_max / αξιοποίηση)· «—» όταν δεν εφαρμόζεται.
  if (readoutKey === FOUNDATION_STRUCTURAL_READOUT_KEYS.bearingPMax) {
    const b = resolveBearingResult(footing);
    return { value: b && Number.isFinite(b.pMaxKpa) ? String(Math.round(b.pMaxKpa)) : '—', options: [] };
  }
  if (readoutKey === FOUNDATION_STRUCTURAL_READOUT_KEYS.bearingUtilization) {
    const b = resolveBearingResult(footing);
    return { value: b && Number.isFinite(b.check.utilization) ? (b.check.utilization * 100).toFixed(0) : '—', options: [] };
  }
  return null;
}

/**
 * ADR-463 — Πολιτική **ανενεργού** (disabled) control: τα πεδία της προαιρετικής
 * άνω σχάρας (pad) / συνδετήρων (strip) είναι ανενεργά όταν το αντίστοιχο toggle
 * είναι OFF. Επιστρέφει `false` για κάθε άλλο πεδίο. Καταναλώνεται από το panel.
 */
export function resolveFoundationFieldDisabled(
  footing: FoundationEntity,
  commandKey: string,
): boolean {
  const r = effectiveReinforcement(footing);
  if (
    commandKey === FOUNDATION_STRUCTURAL_KEYS.padTopDiameter ||
    commandKey === FOUNDATION_STRUCTURAL_KEYS.padTopSpacing
  ) {
    return r.kind === 'pad' && !r.topMesh;
  }
  if (
    commandKey === FOUNDATION_STRUCTURAL_KEYS.stripStirrupDiameter ||
    commandKey === FOUNDATION_STRUCTURAL_KEYS.stripStirrupSpacing
  ) {
    return r.kind === 'strip' && !r.stirrups;
  }
  return false;
}

/**
 * Εφάρμοσε αλλαγή editable structural key. `code` → building setting (store)·
 * τα υπόλοιπα → patch reinforcement (από τον effective) + dispatch. Επιστρέφει
 * `true` αν το key ανήκε στο structural group και χειρίστηκε.
 */
export function applyFoundationStructuralChange(
  footing: FoundationEntity,
  commandKey: string,
  value: string,
  dispatchParams: DispatchParams,
): boolean {
  if (commandKey === FOUNDATION_STRUCTURAL_KEYS.code) {
    if (isStructuralCodeId(value)) useStructuralSettingsStore.getState().setCodeId(value);
    return true;
  }
  if (commandKey === FOUNDATION_STRUCTURAL_KEYS.soilBearing) {
    const n = Number.parseFloat(value);
    useStructuralSettingsStore.getState().setSoilBearingCapacityKpa(Number.isNaN(n) ? undefined : n);
    return true;
  }
  if (isFoundationLoadKey(commandKey)) {
    const nextParams = patchFoundationLoadField(footing.params, commandKey, value);
    if (nextParams) dispatchParams(nextParams);
    return true;
  }
  const patched = patchFoundationStructuralField(effectiveReinforcement(footing), commandKey, value);
  if (!patched) return false;
  const nextParams = withFootingReinforcement(footing.params, patched);
  if (nextParams) dispatchParams(nextParams);
  return true;
}
