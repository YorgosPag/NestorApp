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
import type { HeatLoadBoundaryKind } from './heat-load-types';
import type { SolarOrientation } from './annual-gains-shading-tables';
import { SOLAR_ORIENTATIONS } from './annual-gains-shading-tables';

// Shading tables — surgical split (≤500 γραμμές/αρχείο): L7.3 Slice B/C/D
// SolarOrientation + SOLAR_ORIENTATIONS ορίζονται στο shading-tables και re-export-άρονται εδώ.
export type {
  SolarOrientation,
  OverhangShadingBand,
  HorizonShadingLevel,
  FinShadingLevel,
} from './annual-gains-shading-tables';
export {
  SOLAR_ORIENTATIONS,
  OVERHANG_SHADING_FACTOR,
  getOverhangShadingFactor,
  HORIZON_SHADING_FACTOR,
  HORIZON_SHADING_LEVELS,
  DEFAULT_HORIZON_SHADING_LEVEL,
  getHorizonShadingFactor,
  FIN_SHADING_FACTOR,
  FIN_SHADING_LEVELS,
  DEFAULT_FIN_SHADING_LEVEL,
  getFinShadingFactor,
  FIN_GEOMETRY_SHADING_FACTOR,
  getFinGeometryShadingFactor,
} from './annual-gains-shading-tables';

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

/**
 * Εποχιακή ηλιακή ακτινοβολία σε **οριζόντιο** επίπεδο (kWh/m²·περίοδο θέρμανσης) ανά
 * κλιματική ζώνη — ΤΟΤΕΕ 20701-1 / EN ISO 13790 §11.3.4 (στέγη / οριζόντια αδιαφανή
 * στοιχεία). Η στέγη βλέπει όλο τον ουρανό → **χωρίς προσανατολισμό** (ΟΧΙ orientation
 * table). Φυσική περιόδου θέρμανσης (χαμηλός χειμερινός ήλιος): το οριζόντιο επίπεδο
 * παίρνει λιγότερα από τη **νότια κατακόρυφη** (που ευνοείται από την κάθετη πρόσπτωση)
 * αλλά **περισσότερα από τη μέση** των 8 προσανατολισμών. Documented defaults
 * (≈1.2× της orientation-agnostic μέσης `SEASONAL_SOLAR_IRRADIATION_KWHM2`· φθίνον με
 * την ψυχρότητα της ζώνης· editable):
 *   - A: ~420 · B: ~360 · C: ~300 · D: ~240 kWh/m²·περίοδο.
 * Βαθμονόμηση: `mean(zone) < I_horizontal(zone) < I_south_vertical(zone)` τον χειμώνα
 * (π.χ. ζώνη Β: 300 < 360 < 510). SSoT — ο aggregator διαβάζει ΜΟΝΟ από εδώ.
 */
export const SEASONAL_SOLAR_IRRADIATION_HORIZONTAL_KWHM2: Record<ClimateZone, number> = {
  A: 420,
  B: 360,
  C: 300,
  D: 240,
};

/**
 * Εποχιακή ηλιακή ακτινοβολία **κατακόρυφης** επιφάνειας ανά κλιματική ζώνη **και
 * προσανατολισμό** (kWh/m²·περίοδο θέρμανσης) — ΤΟΤΕΕ 20701-1 / EN ISO 13790
 * §11.3.2, documented defaults. Φυσική περιόδου θέρμανσης (χαμηλός χειμερινός
 * ήλιος → κάθετη πρόσπτωση στη νότια κατακόρυφη):
 *   - **Ν μέγιστο**, **Β ελάχιστο** (μόνο διάχυτη), Α/Δ ενδιάμεσα, ΝΑ/ΝΔ κοντά στο Ν.
 *
 * **Βαθμονόμηση:** ο μέσος όρος των 8 προσανατολισμών κάθε ζώνης ≈ η orientation-
 * agnostic `SEASONAL_SOLAR_IRRADIATION_KWHM2[zone]` του L7.1 (σχετικοί συντελεστές
 * Β/ΒΑ/Α/ΝΑ/Ν 0.40/0.55/0.95/1.45/1.70 με μέσο 1.00) → ισοκατανεμημένοι προσανατολισμοί
 * δίνουν ≈ το παλιό αποτέλεσμα (zero-scale-shock). Editable defaults.
 */
export const SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION: Record<
  ClimateZone,
  Record<SolarOrientation, number>
> = {
  A: { N: 140, NE: 193, E: 333, SE: 508, S: 595, SW: 508, W: 333, NW: 193 },
  B: { N: 120, NE: 165, E: 285, SE: 435, S: 510, SW: 435, W: 285, NW: 165 },
  C: { N: 100, NE: 138, E: 238, SE: 363, S: 425, SW: 363, W: 238, NW: 138 },
  D: { N: 80, NE: 110, E: 190, SE: 290, S: 340, SW: 290, W: 190, NW: 110 },
};

/** Πλάτος τομέα ανά προσανατολισμό (8 × 45° = 360°). */
const ORIENTATION_SECTOR_DEG = 360 / 8;

/** g-value υαλοπίνακα (ολικός συντελεστής ηλιακής διαπερατότητας) — διπλός ~0.6. */
export const GLAZING_SOLAR_FACTOR_G = 0.6;
/** Συντελεστής πλαισίου `F_F` — ποσοστό υαλοπίνακα στο άνοιγμα (~0.7). */
export const FRAME_FACTOR = 0.7;
/** Συντελεστής σκίασης `F_sh` — μέση εξωτ./ορίζοντα σκίαση (~0.9). */
export const SHADING_FACTOR = 0.9;

// ─── L7.3 — Συντελεστής σκίασης από εξωτερικά εμπόδια (obstruction) ────────────

/**
 * Επίπεδο σκίασης υαλοπίνακα από **εξωτερικά εμπόδια** (γειτονικά κτίρια / πρόβολοι
 * / πλευρικά πτερύγια) — ο discriminator του πρόσθετου συντελεστή σκίασης
 * `F_sh,obstruction` της EN ISO 13790 §11.4.3 (`F_sh,gl = F_hor·F_ov·F_fin`) /
 * ΤΟΤΕΕ 20701-1 (πίνακες σκίασης ορίζοντα/προβόλων/πλευρικών). **Ξεχωριστό** από τη
 * βασική `SHADING_FACTOR` (γενική γωνία πρόσπτωσης/ορίζοντα) — πολλαπλασιάζεται μαζί
 * της. Default χώρου `none` (obstruction 1.0 ⇒ zero-regression vs L7.2).
 */
export type SolarShadingLevel = 'none' | 'light' | 'moderate' | 'heavy';

/**
 * Συντελεστής σκίασης εξωτερικών εμποδίων `F_sh,obstruction` ∈ (0,1] ανά επίπεδο —
 * EN ISO 13790 §11.4.3 / ΤΟΤΕΕ 20701-1 αντιπροσωπευτικές defaults (φθίνον με την
 * ένταση εμποδίων· editable). Μειώνει τα ηλιακά κέρδη του υαλοπίνακα:
 *   - `none`     → 1.00  (ελεύθερος ορίζοντας — default, zero-regression)
 *   - `light`    → 0.90  (μερική σκίαση / ρηχός πρόβολος / μακρινά εμπόδια)
 *   - `moderate` → 0.70  (γειτονικό κτίριο / βαθύς πρόβολος / πλευρικά πτερύγια)
 *   - `heavy`    → 0.50  (ψηλό γειτονικό κτίριο / βαθιά εσοχή — έντονη σκίαση)
 * SSoT — ο engine διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const SOLAR_SHADING_OBSTRUCTION_FACTOR: Readonly<Record<SolarShadingLevel, number>> = {
  none: 1.0,
  light: 0.9,
  moderate: 0.7,
  heavy: 0.5,
};

/** Σειρά εμφάνισης επιπέδων σκίασης (για dropdown options). */
export const SOLAR_SHADING_LEVELS: readonly SolarShadingLevel[] = [
  'none',
  'light',
  'moderate',
  'heavy',
] as const;

/** Default επίπεδο σκίασης χώρου — `none` (obstruction 1.0, zero-regression). */
export const DEFAULT_SOLAR_SHADING_LEVEL: SolarShadingLevel = 'none';

/** Συντελεστής σκίασης εμποδίων ενός επιπέδου (πάντα ορισμένο — exhaustive Record). */
export function getSolarShadingObstructionFactor(level: SolarShadingLevel): number {
  return SOLAR_SHADING_OBSTRUCTION_FACTOR[level];
}

// ─── L7.6 — Ηλιακή απορρόφηση αδιαφανών εξωτ. στοιχείων (opaque solar) ──────────

/**
 * Επίπεδο **απόχρωσης** της εξωτ. επιφάνειας αδιαφανούς στοιχείου (σοβάς/βαφή) — ο
 * discriminator της ηλιακής απορροφητικότητας `α_S` (solar absorptance) της EN ISO
 * 13790 §11.3.4 / ΤΟΤΕΕ 20701-1. Σκουρότερη επιφάνεια → μεγαλύτερη απορρόφηση → πιο
 * αποδοτικός «συλλέκτης» ηλιακής ακτινοβολίας. Default χώρου `medium` (α=0.6, τυπικός
 * ανοιχτός σοβάς). Mirror του `SolarShadingLevel` (L7.3).
 */
export type SurfaceColorLevel = 'light' | 'medium' | 'dark';

/**
 * Ηλιακή απορροφητικότητα `α_S` ∈ (0,1) αδιαφανούς εξωτ. επιφάνειας ανά απόχρωση —
 * EN ISO 13790 §11.3.4 / ΤΟΤΕΕ 20701-1 αντιπροσωπευτικές defaults (αύξον με τη
 * σκουρότητα· editable):
 *   - `light`  → 0.30  (ανοιχτή/λευκή επιφάνεια — υψηλή ανακλαστικότητα)
 *   - `medium` → 0.60  (τυπικός σοβάς/μεσαία απόχρωση — default)
 *   - `dark`   → 0.90  (σκούρα επιφάνεια — υψηλή απορρόφηση)
 * SSoT — ο resolver διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const SOLAR_ABSORPTANCE_BY_LEVEL: Readonly<Record<SurfaceColorLevel, number>> = {
  light: 0.3,
  medium: 0.6,
  dark: 0.9,
};

/** Σειρά εμφάνισης επιπέδων απόχρωσης (για μελλοντικό dropdown options). */
export const SURFACE_COLOR_LEVELS: readonly SurfaceColorLevel[] = [
  'light',
  'medium',
  'dark',
] as const;

/** Default απόχρωση εξωτ. επιφάνειας χώρου — `medium` (α=0.6, τυπικός σοβάς). */
export const DEFAULT_SURFACE_COLOR_LEVEL: SurfaceColorLevel = 'medium';

/**
 * Εξωτερική επιφανειακή θερμική αντίσταση `R_se` (m²K/W) — ΤΟΤΕΕ 20701-2 / EN ISO
 * 6946 τυπική τιμή για κατακόρυφη επιφάνεια προς εξωτ. αέρα. Συντελεστής της
 * ενεργού συλλεκτικής επιφάνειας `A_sol = α_S·R_se·U_c·A_c` (EN ISO 13790 §11.3.4).
 */
export const EXTERNAL_SURFACE_RESISTANCE_R_SE = 0.04;

/** Ηλιακή απορροφητικότητα `α_S` ενός επιπέδου (πάντα ορισμένο — exhaustive Record). */
export function getSolarAbsorptance(level: SurfaceColorLevel): number {
  return SOLAR_ABSORPTANCE_BY_LEVEL[level];
}

// ─── L7.3 Slice B — Συντελεστής σκίασης οριζόντιου προβόλου (F_ov) ─────────────

// ─── L7.9 — Δυναμικός `a0` με θερμική μάζα (gain utilisation / time constant) ────

/**
 * Κατηγορία **θερμικής αδράνειας / μάζας** του χώρου (κατασκευαστική κλάση) — ο
 * discriminator της εσωτερικής θερμοχωρητικότητας `C_m` της EN ISO 13790 §12.3.1.2
 * (5 τυπικές κλάσεις) / ΤΟΤΕΕ 20701-1. Βαρύτερη κατασκευή (μπετόν/τοιχοποιία) →
 * μεγαλύτερη `C_m` → μεγαλύτερη σταθερά χρόνου `τ` → μεγαλύτερο `a0` → **αξιοποιεί
 * περισσότερα** κέρδη (η μάζα τα αποθηκεύει & αποδίδει αργότερα). Per-space override
 * (Revit construction class). **Absent ⇒ `a0_ref` (=1.0) ⇒ simplified ⇒
 * zero-regression** (δεν μοντελοποιείται μάζα). Mirror του `SolarShadingLevel` (L7.3).
 */
export type ThermalMassLevel = 'very-light' | 'light' | 'medium' | 'heavy' | 'very-heavy';

/**
 * Εσωτερική θερμοχωρητικότητα `C_m` ανά **m² δαπέδου** (J/K·m²) ανά κλάση μάζας —
 * EN ISO 13790 §12.3.1 Πίν. 12 documented defaults (αύξον με τη βαρύτητα κατασκευής·
 * editable): ελαφρά μεταλλική/γυψοσανίδα → βαριά μπετόν/τοιχοποιία. Πολλαπλασιάζεται
 * επί το εμβαδό δαπέδου → `C_m [J/K]`. SSoT — ο engine διαβάζει ΜΟΝΟ από εδώ.
 */
export const THERMAL_MASS_CAPACITY_J_PER_K_M2: Readonly<Record<ThermalMassLevel, number>> = {
  'very-light': 80000,
  light: 110000,
  medium: 165000,
  heavy: 260000,
  'very-heavy': 370000,
};

/** Σειρά εμφάνισης κλάσεων μάζας (για μελλοντικό dropdown «Θερμική Αδράνεια»). */
export const THERMAL_MASS_LEVELS: readonly ThermalMassLevel[] = [
  'very-light',
  'light',
  'medium',
  'heavy',
  'very-heavy',
] as const;

/** Εσωτερική θερμοχωρητικότητα `C_m` (J/K·m²) μιας κλάσης (πάντα ορισμένο — exhaustive). */
export function getThermalMassCapacity(level: ThermalMassLevel): number {
  return THERMAL_MASS_CAPACITY_J_PER_K_M2[level];
}

/**
 * Αριθμητική παράμετρος αναφοράς `a0,ref` του συντελεστή αξιοποίησης (EN ISO 13790
 * §12.2.1.1, **monthly reference pair** `a_H,0=1.0`). Στο `τ=0` (απουσία μάζας)
 * αναπαράγει ΑΚΡΙΒΩΣ το simplified `η = 1/(1+γ)` (zero-regression baseline). Η θερμική
 * μάζα **προσθέτει** πάνω της (`a0 = a0,ref + τ/τ0`).
 */
export const UTILISATION_REFERENCE_PARAM_A0 = 1.0;

/**
 * Σταθερά χρόνου αναφοράς `τ0` (h) του συντελεστή αξιοποίησης (EN ISO 13790 §12.2.1.1,
 * **monthly reference pair** `τ_H,0=15 h` — συνεπής με `a0,ref=1.0`). Κανονικοποιεί τη
 * σταθερά χρόνου του κτιρίου: `a0 = a0,ref + τ/τ0`.
 */
export const UTILISATION_REFERENCE_TIME_CONSTANT_H = 15;

/**
 * Σταθερά χρόνου κτιρίου `τ = C_m / H` (h) — EN ISO 13790 §12.2.1.1. `C_m` σε J/K, `H`
 * (συντ. απωλειών) σε W/K· το `3600` μετατρέπει W·h→J ώστε `τ` σε ώρες. Μεγάλη μάζα ή
 * μικρές απώλειες → μεγάλη `τ` (το κτίριο «κρατά» τη θερμότητα). Guard `H ≤ 0 ⇒ 0`
 * (μηδέν απώλειες → fallback στο reference `a0`, ΟΧΙ άπειρο). Pure, idempotent.
 */
export function computeTimeConstantHours(cmJPerK: number, hWperK: number): number {
  if (!(hWperK > 0)) return 0;
  return cmJPerK / (hWperK * 3600);
}

/**
 * Αριθμητική παράμετρος `a0 = a0,ref + τ/τ0` (EN ISO 13790 §12.2.1.1) από τη σταθερά
 * χρόνου `τ` (h). Clamp `a0 ≥ a0,ref` (μη-αρνητικό `τ`). `τ=0` ⇒ `a0,ref` (simplified
 * baseline). Pure, idempotent. Τροφοδοτεί το `computeGainUtilisation(γ, a0)`.
 */
export function computeNumericParam(tauHours: number): number {
  const a0 = UTILISATION_REFERENCE_PARAM_A0 + Math.max(0, tauHours) / UTILISATION_REFERENCE_TIME_CONSTANT_H;
  return Math.max(UTILISATION_REFERENCE_PARAM_A0, a0);
}

/** Εσωτερικά κέρδη (W/m²) της χρήσης. */
export function getInternalGainWperM2(use: ThermalSpaceUseType): number {
  return INTERNAL_GAIN_W_PER_M2[use];
}

/** Ώρες περιόδου θέρμανσης (h) της ζώνης. */
export function getHeatingSeasonHours(zone: ClimateZone): number {
  return HEATING_SEASON_HOURS[zone];
}

/**
 * Αντιστοιχίζει αζιμούθιο (deg, 0°=Βορράς, clockwise) σε έναν από τους 8
 * προσανατολισμούς — τομείς των 45° **με κέντρο** κάθε σημείο πυξίδας: [337.5,22.5)→N,
 * [22.5,67.5)→NE, … wrap-safe (κανονικοποιεί αρνητικά/≥360). Pure, idempotent.
 */
export function azimuthToOrientation(azimuthDeg: number): SolarOrientation {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  const shifted = (normalized + ORIENTATION_SECTOR_DEG / 2) % 360;
  const index = Math.floor(shifted / ORIENTATION_SECTOR_DEG) % SOLAR_ORIENTATIONS.length;
  return SOLAR_ORIENTATIONS[index];
}

/**
 * Εποχιακή ηλιακή ακτινοβολία κατακόρυφης επιφάνειας (kWh/m²·περίοδο) της ζώνης.
 * Χωρίς `orientation` → **orientation-agnostic** μέση τιμή (L7.1, backward-compatible)·
 * με `orientation` → η τιμή ανά προσανατολισμό (L7.2).
 */
export function getSeasonalSolarIrradiation(zone: ClimateZone): number;
export function getSeasonalSolarIrradiation(
  zone: ClimateZone,
  orientation: SolarOrientation,
): number;
export function getSeasonalSolarIrradiation(
  zone: ClimateZone,
  orientation?: SolarOrientation,
): number {
  if (orientation === undefined) return SEASONAL_SOLAR_IRRADIATION_KWHM2[zone];
  return SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION[zone][orientation];
}

/**
 * Εποχιακή ηλιακή ακτινοβολία **οριζόντιου** επιπέδου (kWh/m²·περίοδο) της ζώνης —
 * για στέγη / οριζόντια αδιαφανή στοιχεία (ADR-422 L7.7, EN ISO 13790 §11.3.4). Χωρίς
 * προσανατολισμό (η στέγη βλέπει όλο τον ουρανό). Pure — exhaustive Record.
 */
export function getHorizontalSolarIrradiation(zone: ClimateZone): number {
  return SEASONAL_SOLAR_IRRADIATION_HORIZONTAL_KWHM2[zone];
}

// ─── L7.8 — Sky-radiation correction αδιαφανών εξωτ. στοιχείων (long-wave loss) ─

/**
 * Εξωτερικός συντελεστής ακτινοβολίας `h_r` (W/m²K) — EN ISO 13790 §11.3.5 / EN ISO
 * 6946. Ο ρυθμός ανταλλαγής long-wave ακτινοβολίας μεταξύ της εξωτ. επιφάνειας και
 * του περιβάλλοντος/ουρανού: `h_r = 4·ε·σ·T_m³` → για τυπική εκπεμπτικότητα `ε≈0.9`
 * αδιαφανούς δομικού στοιχείου σε εύκρατο κλίμα ≈ 4.5–5.1 W/m²K. Documented default
 * **5.0** (editable). Συντελεστής της στιγμιαίας ροής `Φ_r = R_se·U_c·A_c·h_r·Δθ_er`.
 */
export const EXTERNAL_RADIATIVE_COEFFICIENT_H_R = 5;

/**
 * Μέση διαφορά θερμοκρασίας εξωτ. αέρα ↔ **φαινόμενης θερμοκρασίας ουρανού** `Δθ_er`
 * (K) — EN ISO 13790 §11.3.5. Ο (ψυχρός) ουρανός είναι κατά μέσο όρο `Δθ_er` πιο
 * κρύος από τον εξωτ. αέρα, οπότε κάθε εξωτ. αδιαφανές στοιχείο εκπέμπει καθαρά
 * προς τον ουρανό. ISO τιμές: ~9 K τροπικά, ~11 K υποπολικά → εύκρατη Ελλάδα ~10–11 K.
 * Documented default **11 K** (μέσης περιόδου θέρμανσης — όχι peak· editable).
 */
export const SKY_TEMP_DIFFERENCE_DELTA_THETA_ER = 11;

/**
 * Συντελεστής θέασης ουρανού `F_r` (form factor προς ουρανό) ανά **τύπο** στοιχείου —
 * EN ISO 13790 §11.3.5. **Γεωμετρική** ιδιότητα προσανατολισμού (όχι user choice):
 * οριζόντια **στέγη** βλέπει ΟΛΟ τον ουρανό → `1.0`· κατακόρυφος **τοίχος** βλέπει τον
 * **μισό** ημισφαίριο ουρανού (το άλλο μισό = έδαφος) → `0.5`· κατακόρυφο **παράθυρο**
 * (L7.8-B) επίσης `0.5` — ίδια γεωμετρία θέασης με τον τοίχο (το γυαλί είναι το πιο
 * ακτινοβόλο στοιχείο, υψηλό `U`). Τα υπόλοιπα kinds (`door`/`floor`/`ceiling`) → `0`
 * (`getSkyViewFactor`). Πλήρης θέαση (χωρίς partial sky-view από γειτονικά κτίρια) =
 * v1· tilt/μερική θέαση/per-glazing emissivity (low-e) = future.
 */
export const SKY_VIEW_FACTOR_BY_KIND: Partial<Record<HeatLoadBoundaryKind, number>> = {
  roof: 1.0,
  wall: 0.5,
  window: 0.5,
};

/**
 * Συντελεστής θέασης ουρανού `F_r` του τύπου στοιχείου (στέγη 1.0 / τοίχος 0.5 /
 * παράθυρο 0.5)· οποιοδήποτε άλλο kind (door/floor/ceiling) → `0` (δεν συμμετέχει στο
 * sky-radiation balance v1). Pure, idempotent. SSoT — ο aggregator διαβάζει ΜΟΝΟ από εδώ.
 */
export function getSkyViewFactor(kind: HeatLoadBoundaryKind): number {
  return SKY_VIEW_FACTOR_BY_KIND[kind] ?? 0;
}

/**
 * Συντελεστής αξιοποίησης κερδών `η_gn` (EN ISO 13790 §12.2.1.1) συναρτήσει του λόγου
 * κερδών/απωλειών `γ = (Q_int + Q_sol) / Q_loss` και της αριθμητικής παραμέτρου `a0`:
 *   - `γ ≤ 0` ⇒ `η = 1` (μηδέν κέρδη ή μηδενικές απώλειες → πλήρως αξιοποιήσιμα / no-op),
 *   - `γ = 1` ⇒ `η = a0 / (a0 + 1)`,
 *   - αλλιώς ⇒ `η = (1 − γ^a0) / (1 − γ^(a0+1))`.
 * Φθίνουσα στο `γ` (όσο περισσότερα κέρδη σε σχέση με απώλειες, τόσο μικρότερο ποσοστό
 * αξιοποιείται)· **αύξουσα στο `a0`** (μεγαλύτερη θερμική μάζα → περισσότερη αξιοποίηση,
 * L7.9). Το `a0` είναι προαιρετικό — **absent ⇒ `UTILISATION_REFERENCE_PARAM_A0` (=1.0)
 * ⇒ simplified `η = 1/(1+γ)`** (zero-regression· οι υπάρχοντες callers αμετάβλητοι). Με
 * δηλωμένη θερμική μάζα ο caller περνά δυναμικό `a0 = a0,ref + τ/τ0`. Clamp `η ∈ [0, 1]`.
 * Pure, idempotent, full unit-testable.
 */
export function computeGainUtilisation(
  gainLossRatio: number,
  a0: number = UTILISATION_REFERENCE_PARAM_A0,
): number {
  if (!(gainLossRatio > 0)) return 1;
  const eta =
    gainLossRatio === 1
      ? a0 / (a0 + 1)
      : (1 - Math.pow(gainLossRatio, a0)) / (1 - Math.pow(gainLossRatio, a0 + 1));
  return Math.min(1, Math.max(0, eta));
}
