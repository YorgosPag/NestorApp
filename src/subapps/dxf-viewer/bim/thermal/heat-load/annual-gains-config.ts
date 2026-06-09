/**
 * ADR-422 L7.1 — Αξιοποίηση θερμικών κερδών: config SSoT (gain utilisation).
 *
 * Config-only SSoT για τη **μέθοδο αξιοποίησης κερδών** (gain utilisation factor,
 * EN ISO 13790 §12.2.1.1 simplified seasonal / ΤΟΤΕΕ 20701-1). Το L7 δίνει τη
 * **μεικτή** ετήσια ζήτηση (gross losses, κέρδη αμελημένα → άνω όριο)· το L7.1 αφαιρεί
 * τα **αξιοποιήσιμα** κέρδη (εσωτερικά + ηλιακά) ώστε να προκύψει η **καθαρή** ζήτηση
 * `Q_H,net = max(0, Q_loss − η_gn·(Q_int + Q_sol))`, όπως οι «μεγάλοι παίχτες» (Revit
 * Energy / 4M-FineHEAT-KENAK).
 *
 * Περιέχει (καθαρά δεδομένα/σταθερές + pure getters — εξαιρείται 500-line):
 *   - εσωτερικά κέρδη ανά **χρήση** (`ThermalSpaceUseType`, reuse — ΟΧΙ fork),
 *   - ώρες περιόδου θέρμανσης + εποχιακή ηλιακή ακτινοβολία ανά **κλιματική ζώνη**
 *     (`ClimateZone`, reuse· συνεπή με τα HDD του L7),
 *   - οπτικοί συντελεστές υαλοπίνακα (g/πλαίσιο/σκίαση),
 *   - τη pure `computeGainUtilisation(γ)` (συντελεστής `η_gn`).
 *
 * Isolation (mirror της D-B των L6/L7) — ΞΕΧΩΡΙΣΤΟ SRP από το `annual-energy-config`
 * (βαθμοημέρες/bands μένουν εκεί). Documented, advisory, εύκολα editable defaults.
 * Καμία inline literal στον engine (`derive-annual-energy`).
 *
 * @see ./annual-energy-config (HDD + class bands — η μεικτή πλευρά του L7)
 * @see ./derive-annual-energy (deriveAnnualHeating — consumer)
 * @see ../kenak-thermal-config (ClimateZone — reuse) · ../../types/thermal-space-types (ThermalSpaceUseType)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.1)
 */

import type { ClimateZone } from '../kenak-thermal-config';
import type { ThermalSpaceUseType } from '../../types/thermal-space-types';

/**
 * Εσωτερικά θερμικά κέρδη ανά **χρήση** χώρου (W/m², ΤΟΤΕΕ 20701-1 — τυπικές τιμές
 * occupancy + φωτισμός + συσκευές). Documented defaults, editable. Ψηλότερα κέρδη σε
 * χώρους με μαγείρεμα/συσκευές (κουζίνα) ή υψηλή παρουσία (σαλόνι/γραφείο)· χαμηλά σε
 * διαδρόμους/WC. Πολλαπλασιάζονται επί εμβαδό × ώρες περιόδου → kWh/περίοδο.
 */
export const INTERNAL_GAIN_W_PER_M2: Record<ThermalSpaceUseType, number> = {
  bedroom: 4,
  'living-room': 6,
  kitchen: 6,
  bathroom: 4,
  wc: 2,
  hallway: 2,
  office: 6,
  generic: 4,
};

/**
 * Ώρες περιόδου θέρμανσης ανά κλιματική ζώνη (h/περίοδο = ημέρες θέρμανσης × 24).
 * Ολοκληρώνουν τα εσωτερικά κέρδη στην ίδια περίοδο που καλύπτουν οι βαθμοημέρες του
 * L7 (συνέπεια gross↔gains). Ψυχρότερη ζώνη → μεγαλύτερη περίοδος. Documented defaults:
 *   - A (νότια/νησιά): ~120 ημέρες → 2880 h
 *   - B: ~150 ημέρες → 3600 h
 *   - C: ~180 ημέρες → 4320 h
 *   - D (ορεινή/βόρεια): ~210 ημέρες → 5040 h
 */
export const HEATING_SEASON_HOURS: Record<ClimateZone, number> = {
  A: 2880,
  B: 3600,
  C: 4320,
  D: 5040,
};

/**
 * Εποχιακή ηλιακή ακτινοβολία σε **κατακόρυφη** επιφάνεια (kWh/m²·περίοδο θέρμανσης),
 * **orientation-agnostic** μέση τιμή v1 (ο προσανατολισμός = future L7.2). Documented
 * defaults — θερμότερη/νοτιότερη ζώνη → περισσότερη ακτινοβολία στην περίοδο θέρμανσης:
 *   - A: ~350 · B: ~300 · C: ~250 · D: ~200 kWh/m²·περίοδο.
 */
export const SEASONAL_SOLAR_IRRADIATION_KWHM2: Record<ClimateZone, number> = {
  A: 350,
  B: 300,
  C: 250,
  D: 200,
};

/** g-value υαλοπίνακα (ολικός συντελεστής ηλιακής διαπερατότητας) — διπλός ~0.6. */
export const GLAZING_SOLAR_FACTOR_G = 0.6;
/** Συντελεστής πλαισίου `F_F` — ποσοστό υαλοπίνακα στο άνοιγμα (~0.7). */
export const FRAME_FACTOR = 0.7;
/** Συντελεστής σκίασης `F_sh` — μέση εξωτ./ορίζοντα σκίαση (~0.9). */
export const SHADING_FACTOR = 0.9;

/**
 * Αριθμητική παράμετρος `a0` του συντελεστή αξιοποίησης (EN ISO 13790 §12.2.1.1).
 * Για simplified seasonal χωρίς δυναμική σταθερά χρόνου `a0 = 1` (documented· δίνει
 * `η = 1/(1+γ)`, με `η(γ=1)=0.5`). Editable αν εισαχθεί θερμοχωρητικότητα στο μέλλον.
 */
export const UTILISATION_NUMERIC_PARAM = 1.0;

/** Εσωτερικά κέρδη (W/m²) της χρήσης. */
export function getInternalGainWperM2(use: ThermalSpaceUseType): number {
  return INTERNAL_GAIN_W_PER_M2[use];
}

/** Ώρες περιόδου θέρμανσης (h) της ζώνης. */
export function getHeatingSeasonHours(zone: ClimateZone): number {
  return HEATING_SEASON_HOURS[zone];
}

/** Εποχιακή ηλιακή ακτινοβολία κατακόρυφης επιφάνειας (kWh/m²·περίοδο) της ζώνης. */
export function getSeasonalSolarIrradiation(zone: ClimateZone): number {
  return SEASONAL_SOLAR_IRRADIATION_KWHM2[zone];
}

/**
 * Συντελεστής αξιοποίησης κερδών `η_gn` (EN ISO 13790 §12.2.1.1, simplified seasonal)
 * συναρτήσει του λόγου κερδών/απωλειών `γ = (Q_int + Q_sol) / Q_loss`:
 *   - `γ ≤ 0` ⇒ `η = 1` (μηδέν κέρδη ή μηδενικές απώλειες → πλήρως αξιοποιήσιμα / no-op),
 *   - `γ = 1` ⇒ `η = a0 / (a0 + 1)`,
 *   - αλλιώς ⇒ `η = (1 − γ^a0) / (1 − γ^(a0+1))`.
 * Φθίνουσα στο `γ` (όσο περισσότερα κέρδη σε σχέση με απώλειες, τόσο μικρότερο ποσοστό
 * αξιοποιείται). Clamp `η ∈ [0, 1]`. Pure, idempotent, full unit-testable.
 */
export function computeGainUtilisation(gainLossRatio: number): number {
  if (!(gainLossRatio > 0)) return 1;
  const a0 = UTILISATION_NUMERIC_PARAM;
  const eta =
    gainLossRatio === 1
      ? a0 / (a0 + 1)
      : (1 - Math.pow(gainLossRatio, a0)) / (1 - Math.pow(gainLossRatio, a0 + 1));
  return Math.min(1, Math.max(0, eta));
}
