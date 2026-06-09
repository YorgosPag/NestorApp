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
 * Προσανατολισμός κατακόρυφης επιφάνειας — 8 σημεία πυξίδας (Revit Energy / ΤΟΤΕΕ
 * 20701-1 parity). 0°=Βορράς, **clockwise**. ADR-422 L7.2.
 */
export type SolarOrientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** Οι 8 προσανατολισμοί σε σειρά πυξίδας (Β στις 0°, clockwise) — index 0..7. */
export const SOLAR_ORIENTATIONS: readonly SolarOrientation[] = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
];

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

/** Σημείο πίνακα προβόλου: γωνία προβόλου (deg) → συντελεστής σκίασης `F_ov`. */
export interface OverhangShadingBand {
  /** Γωνία προβόλου `β = atan(d_ov/h_top)` σε μοίρες (αύξουσα σειρά). */
  readonly angle: number;
  /** Συντελεστής σκίασης `F_ov` ∈ (0,1] στη γωνία αυτή. */
  readonly factor: number;
}

/**
 * Συντελεστής σκίασης **οριζόντιου προβόλου** `F_ov` ∈ (0,1] ανά **προσανατολισμό**
 * και **γωνία προβόλου** `β` — EN ISO 13790 §11.4.4 / ΤΟΤΕΕ 20701-1 (πίνακες
 * σκίασης προβόλων), αντιπροσωπευτικές documented defaults (editable). Φυσική:
 *   - **Νότιος = μεγαλύτερη μείωση** — ο χαμηλός χειμερινός νότιος ήλιος κόβεται
 *     εύκολα από οριζόντιο πρόβολο.
 *   - **Βόρειος ≈ 1.0** — μόνο διάχυτη ακτινοβολία, ο πρόβολος ελάχιστα την κόβει.
 *   - Α/Δ ενδιάμεσα· ΝΑ/ΝΔ κοντά στον Ν· ΒΑ/ΒΔ κοντά στον Β.
 * `β=0` (κανένας πρόβολος) ⇒ `1.0` παντού ⇒ zero-regression. Γραμμική interpolation
 * μεταξύ γωνιών (βλ. `getOverhangShadingFactor`). SSoT — ο resolver διαβάζει ΜΟΝΟ από εδώ.
 */
export const OVERHANG_SHADING_FACTOR: Readonly<
  Record<SolarOrientation, readonly OverhangShadingBand[]>
> = {
  S:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.88 }, { angle: 45, factor: 0.72 }, { angle: 60, factor: 0.55 }],
  SE: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.90 }, { angle: 45, factor: 0.76 }, { angle: 60, factor: 0.60 }],
  SW: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.90 }, { angle: 45, factor: 0.76 }, { angle: 60, factor: 0.60 }],
  E:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.93 }, { angle: 45, factor: 0.83 }, { angle: 60, factor: 0.70 }],
  W:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.93 }, { angle: 45, factor: 0.83 }, { angle: 60, factor: 0.70 }],
  NE: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.97 }, { angle: 45, factor: 0.92 }, { angle: 60, factor: 0.85 }],
  NW: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.97 }, { angle: 45, factor: 0.92 }, { angle: 60, factor: 0.85 }],
  N:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.99 }, { angle: 45, factor: 0.97 }, { angle: 60, factor: 0.94 }],
};

/** Κάτω όριο του `F_ov` (αποφυγή μηδενικού/αρνητικού — διατηρεί `∈ (0,1]`). */
const PROJECTION_FACTOR_FLOOR = 0.01;

/**
 * Συντελεστής σκίασης οριζόντιου προβόλου `F_ov` για γωνία προβόλου `β` (deg) και
 * προσανατολισμό — **γραμμική interpolation** στις γωνίες του `OVERHANG_SHADING_FACTOR`.
 * `β ≤ 0` ⇒ `1.0` (κανένας πρόβολος, zero-regression)· `β` πέρα από την τελευταία
 * γωνία ⇒ ο τελευταίος συντελεστής (clamp). Αποτέλεσμα clamped `∈ (0,1]`. Pure.
 */
export function getOverhangShadingFactor(angleDeg: number, orientation: SolarOrientation): number {
  const bands = OVERHANG_SHADING_FACTOR[orientation];
  if (!(angleDeg > 0)) return 1;
  let result = bands[bands.length - 1].factor;
  for (let i = 0; i < bands.length - 1; i++) {
    const lo = bands[i];
    const hi = bands[i + 1];
    if (angleDeg <= hi.angle) {
      const span = hi.angle - lo.angle;
      const tt = span > 0 ? (angleDeg - lo.angle) / span : 0;
      result = lo.factor + tt * (hi.factor - lo.factor);
      break;
    }
  }
  return Math.min(1, Math.max(PROJECTION_FACTOR_FLOOR, result));
}

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
