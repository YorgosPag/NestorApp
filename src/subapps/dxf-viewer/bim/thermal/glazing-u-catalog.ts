/**
 * ADR-422 L1 — Συντελεστής θερμοπερατότητας κουφωμάτων `Ug` (W/m²K) — config SSoT.
 *
 * Config-only (αντιπροσωπευτικές τιμές ΤΟΤΕΕ 20701-1 / EN ISO 10077· editable).
 * Δίνει το `U` ενός ανοίγματος (παράθυρο/πόρτα) για τον υπολογισμό απωλειών
 * αγωγής Φ_T = Σ U·A·b·ΔΤ (ADR-422 L1).
 *
 * Μοντέλο «type default → instance override» (Revit· mirror του Ti/ACH στο
 * `thermal-space-use-catalog`):
 *   1. Ρητό `ugWperM2K` στο effective opening (instance override ?? type) → wins.
 *   2. Αλλιώς, υαλοπίνακες (`glazingPanes`) → πίνακας `GLAZING_U_BY_PANES`.
 *   3. Μη-υαλωμένο (αδιαφανής πόρτα) → `DEFAULT_DOOR_U_WPER_M2K`.
 *
 * @see ../types/opening-types (OpeningParams.ugWperM2K — instance override)
 * @see ../types/bim-family-type (OpeningTypeParams.ugWperM2K — type default)
 * @see ./kenak-thermal-config (Te) · ./heat-load/heat-load-config (b-factors)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import type { OpeningKind, OpeningParams } from '../types/opening-types';
import { isGlazedKind } from '../types/opening-types';

/** Αριθμός υαλοπινάκων (1 μονό / 2 διπλό / 3 τριπλό). */
export type GlazingPanes = 1 | 2 | 3;

/**
 * Αντιπροσωπευτικά `Ug` (W/m²K) ανά αριθμό υαλοπινάκων (ΤΟΤΕΕ 20701-1 / EN
 * ISO 10077 τυπικές τιμές, με συνηθισμένη πλήρωση). SSoT — editable.
 *   - 1 (μονό): 5.7
 *   - 2 (διπλό): 2.8
 *   - 3 (τριπλό): 1.6
 */
export const GLAZING_U_BY_PANES: Readonly<Record<GlazingPanes, number>> = {
  1: 5.7,
  2: 2.8,
  3: 1.6,
};

/** Default υαλοπίνακες όταν `glazingPanes` δεν ορίζεται (διπλός — σύγχρονο πρότυπο). */
export const DEFAULT_GLAZING_PANES: GlazingPanes = 2;

/** Default `U` (W/m²K) αδιαφανούς πόρτας (μονωμένο φύλλο· αντιπροσωπευτικό). */
export const DEFAULT_DOOR_U_WPER_M2K = 3.0;

/** `Ug` (W/m²K) από αριθμό υαλοπινάκων (πάντα ορισμένο). */
export function getGlazingUValue(panes: GlazingPanes = DEFAULT_GLAZING_PANES): number {
  return GLAZING_U_BY_PANES[panes];
}

/**
 * Effective `U` (W/m²K) ενός ανοίγματος. Pure SSoT — το L1 heat-load engine /
 * resolver διαβάζει ΜΟΝΟ από εδώ. `params` = **effective** opening params
 * (μετά `resolveEffectiveOpeningParams`): ρητό `ugWperM2K` υπερισχύει, αλλιώς
 * υαλοπίνακες/τύπος ανοίγματος.
 */
export function resolveOpeningUValue(
  params: Pick<OpeningParams, 'kind' | 'glazingPanes' | 'ugWperM2K'>,
): number {
  if (params.ugWperM2K !== undefined && Number.isFinite(params.ugWperM2K) && params.ugWperM2K > 0) {
    return params.ugWperM2K;
  }
  if (isGlazedKind(params.kind)) {
    return getGlazingUValue(params.glazingPanes ?? DEFAULT_GLAZING_PANES);
  }
  return DEFAULT_DOOR_U_WPER_M2K;
}

/** True όταν το άνοιγμα είναι θερμικά υαλωμένο (helper re-export semantic). */
export function isGlazedOpeningKind(kind: OpeningKind): boolean {
  return isGlazedKind(kind);
}
