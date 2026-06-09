/**
 * ADR-422 L1 — Heat-Load engine (EN 12831 / ΤΟΤΕΕ 20701-1) — PURE SSoT.
 *
 * Υπολογισμός θερμικού φορτίου `Φ` (W) ενός θερμικού χώρου σε steady-state
 * σχεδιασμό χειμώνα:
 *
 *   Φ = Φ_T + Φ_V + Φ_RH                                          (EN 12831, L1.5)
 *   Φ_T (αγωγή)    = Σ (Uᵢ + ΔU_TB) · Aᵢ · bᵢ · (Ti − Te)
 *   Φ_V (αερισμός) = 0.34 · n · V · (Ti − Te)
 *   Φ_RH (επανέναρξη) = A_floor · f_RH
 *
 * όπου `b` = μειωτικός συντελεστής θερμοκρασίας ανά οριακή συνθήκη
 * (`BOUNDARY_TEMPERATURE_FACTOR`), `ΔU_TB` = προσαύξηση θερμογεφυρών (απλοποιημένη
 * EN 12831-1 §6.3.2, μόνο αδιαφανή στοιχεία προς έξω) και `f_RH` = συντελεστής
 * επανέναρξης. Με `ΔU_TB=0` + `f_RH=0` (defaults) ⇒ ακριβώς ο τύπος L1
 * (zero-regression). ΚΑΜΙΑ γεωμετρία / state / persistence — μόνο αριθμητική
 * πάνω σε resolved `SpaceHeatLoadInput`.
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
  boundaryReceivesThermalBridge,
  getBoundaryTemperatureFactor,
} from './heat-load-config';

/**
 * Απώλεια αγωγής μιας οριακής επιφάνειας: `U_corr·A·b·ΔΤ` (W), όπου
 * `U_corr = U + ΔU_TB` για αδιαφανή στοιχεία προς εξωτ. αέρα/έδαφος
 * (απλοποιημένη θερμογέφυρα EN 12831-1 §6.3.2). Το `thermalBridgeW` (ΔU·A·b·ΔΤ)
 * είναι πληροφοριακό υποσύνολο του `lossW`.
 */
function computeBoundaryLoss(
  boundary: HeatLoadBoundary,
  deltaTC: number,
  thermalBridgeSurchargeWperM2K: number,
): BoundaryHeatLoss {
  const factor = getBoundaryTemperatureFactor(boundary.condition);
  const u = Number.isFinite(boundary.uValue) ? boundary.uValue : 0;
  const a = Number.isFinite(boundary.area) && boundary.area > 0 ? boundary.area : 0;
  const deltaU = boundaryReceivesThermalBridge(boundary.kind, boundary.condition)
    ? thermalBridgeSurchargeWperM2K
    : 0;
  const lossW = (u + deltaU) * a * factor * deltaTC;
  const thermalBridgeW = deltaU * a * factor * deltaTC;
  return {
    kind: boundary.kind,
    condition: boundary.condition,
    uValue: u,
    area: a,
    factor,
    lossW,
    thermalBridgeW,
    refId: boundary.refId,
    azimuthDeg: boundary.azimuthDeg, // L7.2: propagate orientation (μη-υπολογιστικό)
    overhangShadingFactor: boundary.overhangShadingFactor, // L7.3 Slice B: propagate F_ov
    solarFactorG: boundary.solarFactorG, // L7.4: propagate per-window g (μη-υπολογιστικό)
    frameFactorF: boundary.frameFactorF, // L7.5: propagate per-window F_F (μη-υπολογιστικό)
    solarAbsorptance: boundary.solarAbsorptance, // L7.6: propagate per-wall α_S (μη-υπολογιστικό)
  };
}

/** Φορτίο επανέναρξης Φ_RH = A_floor · f_RH (W). EN 12831 reheat. */
function computeReheat(floorAreaM2: number, reheatFactorWperM2: number): number {
  const a = Number.isFinite(floorAreaM2) && floorAreaM2 > 0 ? floorAreaM2 : 0;
  const f = Number.isFinite(reheatFactorWperM2) && reheatFactorWperM2 > 0 ? reheatFactorWperM2 : 0;
  return a * f;
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
  const deltaU = input.thermalBridgeSurchargeWperM2K ?? 0;

  const boundaries = input.boundaries.map((b) => computeBoundaryLoss(b, deltaTC, deltaU));
  const transmissionW = boundaries.reduce((sum, b) => sum + b.lossW, 0);
  const thermalBridgeW = boundaries.reduce((sum, b) => sum + b.thermalBridgeW, 0);
  const ventilationW = computeVentilationLoss(input.airChangesPerHour, input.volume, deltaTC);

  const floorArea = Number.isFinite(input.floorArea) && input.floorArea > 0 ? input.floorArea : 0;
  const reheatW = computeReheat(floorArea, input.reheatFactorWperM2 ?? 0);
  const totalW = transmissionW + ventilationW + reheatW;
  const specificLoadWperM2 = floorArea > 0 ? totalW / floorArea : 0;

  return {
    spaceId: input.spaceId,
    deltaTC,
    transmissionW,
    ventilationW,
    thermalBridgeW,
    reheatW,
    totalW,
    specificLoadWperM2,
    boundaries,
  };
}
