/**
 * ADR-422 L7.9-B — Geometry-derived effective areal heat capacity `κ_m` (PURE SSoT).
 *
 * Υπολογισμός της εσωτερικής **επιφανειακής** θερμοχωρητικότητας `κ_m` (J/m²K) μιας
 * σύνθετης δομικής διάταξης (assembly) από τις στρώσεις της, κατά EN ISO 13790
 * §12.3.1.1 (simplified effective-thickness — ΟΧΙ ISO 13786 detailed):
 *
 *   κ_m = Σ_layer ρ·c·d_eff           [J/m²K]
 *
 * όπου `ρ` = πυκνότητα (kg/m³), `c` = ειδική θερμοχωρητικότητα (J/kgK), `d_eff` =
 * **ενεργό πάχος** στρώσης (m). Το άθροισμα γίνεται **από την εσωτερική επιφάνεια
 * προς τα μέσα** έως το πρώτο από:
 *   (a) `d_eff,max ≈ 0.10 m` (σωρευτικό clamp — μάζα βαθύτερα δεν «προλαβαίνει» να
 *       φορτιστεί/εκφορτιστεί στον ημερήσιο κύκλο), ή
 *   (b) την **πρώτη μονωτική στρώση** (`λ ≤ threshold`) — η μάζα πέρα από εσωτερική
 *       μόνωση είναι θερμικά αποσυνδεδεμένη («thickness to first insulation»).
 *
 * Ο caller (`space-boundary-resolver`) πολλαπλασιάζει επί την επιφάνεια κάθε ορίου
 * → `C_m = Σ_boundary κ_m·A` [J/K] (total, ΟΧΙ ανά m² δαπέδου). Mirror του
 * `wall-assembly-thermal.ts` (U-value): ίδιο DNA→layers pattern, με ρ/c αντί για λ.
 *
 * ΜΟΝΑΔΕΣ: meters-in (πάχος), J/m²K-out. Καμία γεωμετρία / state / persistence εδώ.
 *
 * @see ../wall-assembly-thermal (wallDnaToThermalLayers — πρότυπο DNA→layers με λ)
 * @see ../../walls/wall-material-catalog (getDensity/getSpecificHeat/getThermalConductivityLambda — ρ/c/λ SSoT)
 * @see ./annual-gains-config (computeTimeConstantHours — consumer του C_m)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.9-B)
 */

import type { WallDna } from '../../types/wall-dna-types';
import {
  getDensity,
  getSpecificHeat,
  getThermalConductivityLambda,
} from '../../walls/wall-material-catalog';

/**
 * Μέγιστο ενεργό πάχος `d_eff,max` (m) — EN ISO 13790 §12.3.1.1. Σωρευτικό όριο: η
 * μάζα βαθύτερα από ~10 cm από την εσωτερική επιφάνεια δεν συμμετέχει ουσιαστικά
 * στη δυναμική αποθήκευση του εποχιακού/μηνιαίου ισοζυγίου. Documented, editable.
 */
export const THERMAL_MASS_EFFECTIVE_THICKNESS_MAX_M = 0.1;

/**
 * Όριο θερμικής αγωγιμότητας `λ` (W/mK) κάτω από το οποίο μια στρώση θεωρείται
 * **μονωτική** — η μάζα πέρα από αυτήν (από την εσωτερική πλευρά) αποσυνδέεται
 * θερμικά («thickness to first insulation», EN ISO 13790 §12.3.1.1). Διαχωρίζει
 * καθαρά τα μονωτικά του καταλόγου (λ ≤ 0.09: EPS/XPS/ορυκτοβάμβακας/θερμοσοβάς)
 * από τα δομικά (λ ≥ 0.25: γυψοσανίδα/σοβάς/μπετόν/τοιχοποιία). Documented, editable.
 */
export const THERMAL_MASS_INSULATION_LAMBDA_THRESHOLD = 0.1;

/** Μία στρώση για τον υπολογισμό `κ_m`: πάχος (m) + ρ (kg/m³) + c (J/kgK) + λ (W/mK). */
export interface HeatCapacityLayer {
  /** Πάχος στρώσης σε ΜΕΤΡΑ. */
  readonly thickness_m: number;
  /** Πυκνότητα ρ (kg/m³). */
  readonly density: number;
  /** Ειδική θερμοχωρητικότητα c (J/kgK). */
  readonly specificHeat: number;
  /** Θερμική αγωγιμότητα λ (W/mK) — για insulation-stop· `undefined` ⇒ μη-μονωτικό. */
  readonly lambda?: number;
}

/** Παράμετροι του κανόνα effective-thickness (overridable defaults). */
export interface ArealHeatCapacityOptions {
  /** Μέγιστο ενεργό πάχος (m). Default `THERMAL_MASS_EFFECTIVE_THICKNESS_MAX_M`. */
  readonly dEffMaxM?: number;
  /** Όριο λ μονωτικής στρώσης (W/mK). Default `THERMAL_MASS_INSULATION_LAMBDA_THRESHOLD`. */
  readonly insulationLambdaThreshold?: number;
}

/**
 * Επιφανειακή θερμοχωρητικότητα `κ_m = Σ ρ·c·d_eff` (J/m²K) μιας διάταξης. Οι στρώσεις
 * δίνονται **interior-first** (από την εσωτερική επιφάνεια προς τα μέσα). Σωρευτικό clamp
 * στο `d_eff,max`· **διακοπή** στην πρώτη μονωτική στρώση (`λ ≤ threshold` — η μάζα πέρα
 * αποσυνδέεται)· degenerate/μη-θετικές στρώσεις αγνοούνται. Pure, idempotent.
 */
export function computeArealHeatCapacity(
  layers: readonly HeatCapacityLayer[],
  opts: ArealHeatCapacityOptions = {},
): number {
  const dEffMax = opts.dEffMaxM ?? THERMAL_MASS_EFFECTIVE_THICKNESS_MAX_M;
  const insulationLambda = opts.insulationLambdaThreshold ?? THERMAL_MASS_INSULATION_LAMBDA_THRESHOLD;
  let kappa = 0;
  let used = 0;
  for (const layer of layers) {
    if (used >= dEffMax) break;
    // Πρώτη μονωτική στρώση: η μάζα πέρα από αυτήν (προς τα έξω) αποσυνδέεται.
    if (layer.lambda !== undefined && layer.lambda <= insulationLambda) break;
    const { thickness_m, density, specificHeat } = layer;
    if (!Number.isFinite(thickness_m) || thickness_m <= 0) continue;
    if (!Number.isFinite(density) || density <= 0) continue;
    if (!Number.isFinite(specificHeat) || specificHeat <= 0) continue;
    const dEff = Math.min(thickness_m, dEffMax - used);
    kappa += density * specificHeat * dEff;
    used += dEff;
  }
  return kappa;
}

/**
 * Μετατρέπει `WallDna` σε `HeatCapacityLayer[]` σε σειρά **interior-first**. Τα
 * `WallDna.layers` είναι ordered **exterior → interior** (βλ. `wall-dna-types.ts`)·
 * το `κ_m` αθροίζει από την εσωτερική επιφάνεια προς τα μέσα → καταναλώνουμε σε
 * **αντίστροφη** σειρά. Στρώσεις χωρίς γνωστό ρ **ή** c (custom/θερμικά άσχετα υλικά,
 * π.χ. vapor barrier) παραλείπονται — μηδέν συνεισφορά μάζας (mirror `wallDnaToThermalLayers`).
 */
export function wallDnaToHeatCapacityLayers(dna: WallDna): HeatCapacityLayer[] {
  const out: HeatCapacityLayer[] = [];
  for (let i = dna.layers.length - 1; i >= 0; i--) {
    const layer = dna.layers[i];
    const density = getDensity(layer.materialId);
    const specificHeat = getSpecificHeat(layer.materialId);
    if (density === undefined || specificHeat === undefined) continue;
    out.push({
      thickness_m: layer.thickness * 0.001,
      density,
      specificHeat,
      lambda: getThermalConductivityLambda(layer.materialId),
    });
  }
  return out;
}

/**
 * Επιφανειακή θερμοχωρητικότητα `κ_m` (J/m²K) ενός τύπου τοίχου από τα υπάρχοντα
 * `WallDna` layers (EN ISO 13790 §12.3.1.1). `0` αν καμία στρώση έχει resolvable
 * μάζα (custom/άγνωστα υλικά) → ο caller πέφτει στο fallback κατηγορίας (zero-regression).
 */
export function computeWallArealHeatCapacity(
  dna: WallDna,
  opts?: ArealHeatCapacityOptions,
): number {
  return computeArealHeatCapacity(wallDnaToHeatCapacityLayers(dna), opts);
}
