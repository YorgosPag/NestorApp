/**
 * ADR-422 L1 — Heat-Load engine (EN 12831 / ΤΟΤΕΕ 20701-1) — PURE SSoT.
 *
 * Υπολογισμός θερμικού φορτίου `Φ` (W) ενός θερμικού χώρου σε steady-state
 * σχεδιασμό χειμώνα:
 *
 *   Φ = Φ_T + Φ_V
 *   Φ_T (αγωγή)   = Σ Uᵢ · Aᵢ · bᵢ · (Ti − Te)
 *   Φ_V (αερισμός) = 0.34 · n · V · (Ti − Te)
 *
 * όπου `b` = μειωτικός συντελεστής θερμοκρασίας ανά οριακή συνθήκη
 * (`BOUNDARY_TEMPERATURE_FACTOR`). ΚΑΜΙΑ γεωμετρία / state / persistence —
 * μόνο αριθμητική πάνω σε resolved `SpaceHeatLoadInput`.
 *
 * ΜΟΝΑΔΕΣ: U σε W/m²K, A σε m², V σε m³, θερμοκρασίες σε °C → `Φ` σε W.
 *
 * @see ./heat-load-types (contracts) · ./heat-load-config (b-factors + 0.34)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import type {
  BoundaryHeatLoss,
  HeatLoadBoundary,
  SpaceHeatLoadInput,
  SpaceHeatLoadResult,
} from './heat-load-types';
import {
  AIR_VENTILATION_FACTOR,
  getBoundaryTemperatureFactor,
} from './heat-load-config';

/** Απώλεια αγωγής μιας οριακής επιφάνειας: U·A·b·ΔΤ (W). */
function computeBoundaryLoss(
  boundary: HeatLoadBoundary,
  deltaTC: number,
): BoundaryHeatLoss {
  const factor = getBoundaryTemperatureFactor(boundary.condition);
  const u = Number.isFinite(boundary.uValue) ? boundary.uValue : 0;
  const a = Number.isFinite(boundary.area) && boundary.area > 0 ? boundary.area : 0;
  const lossW = u * a * factor * deltaTC;
  return {
    kind: boundary.kind,
    condition: boundary.condition,
    uValue: u,
    area: a,
    factor,
    lossW,
    refId: boundary.refId,
  };
}

/** Απώλειες αερισμού: 0.34·n·V·ΔΤ (W). */
function computeVentilationLoss(
  airChangesPerHour: number,
  volumeM3: number,
  deltaTC: number,
): number {
  const n = Number.isFinite(airChangesPerHour) && airChangesPerHour > 0 ? airChangesPerHour : 0;
  const v = Number.isFinite(volumeM3) && volumeM3 > 0 ? volumeM3 : 0;
  return AIR_VENTILATION_FACTOR * n * v * deltaTC;
}

/**
 * Πλήρες θερμικό φορτίο `Φ` (W) ενός χώρου + breakdown. Pure/idempotent.
 * Αν ΔΤ ≤ 0 (Ti ≤ Te) → μηδενικό/αρνητικό φορτίο (καμία ανάγκη θέρμανσης) —
 * επιστρέφεται ως έχει (ο consumer ερμηνεύει· clamp γίνεται στο UI αν χρειαστεί).
 */
export function computeSpaceHeatLoad(input: SpaceHeatLoadInput): SpaceHeatLoadResult {
  const deltaTC = input.indoorTempC - input.outdoorTempC;

  const boundaries = input.boundaries.map((b) => computeBoundaryLoss(b, deltaTC));
  const transmissionW = boundaries.reduce((sum, b) => sum + b.lossW, 0);
  const ventilationW = computeVentilationLoss(input.airChangesPerHour, input.volume, deltaTC);
  const totalW = transmissionW + ventilationW;

  const floorArea = Number.isFinite(input.floorArea) && input.floorArea > 0 ? input.floorArea : 0;
  const specificLoadWperM2 = floorArea > 0 ? totalW / floorArea : 0;

  return {
    spaceId: input.spaceId,
    deltaTC,
    transmissionW,
    ventilationW,
    totalW,
    specificLoadWperM2,
    boundaries,
  };
}
