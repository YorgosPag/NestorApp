/**
 * ADR-422 L1 — Heat-Load config SSoT (μειωτικοί συντελεστές `b` + default
 * κατασκευές οριζόντιων στοιχείων).
 *
 * Config-only (τιμές προτύπων/κανονισμού· μηδέν logic-heavy). Καλύπτει δύο κενά
 * του ΤΟΤΕΕ 20701-1 / EN 12831 heat-load μοντέλου:
 *
 *   1. **Μειωτικός συντελεστής θερμοκρασίας `b` (temperature adjustment factor)**
 *      ανά οριακή συνθήκη. Το EN 12831 γράφει Φ_T = Σ Uᵢ·Aᵢ·bᵢ·(Ti−Te), όπου `b`
 *      μειώνει το ΔΤ όταν το στοιχείο ΔΕΝ συνορεύει απευθείας με τον εξωτ. αέρα:
 *        - `external-air`     → b = 1.0 (πλήρες ΔΤ προς Te· εξωτ. τοίχος/κούφωμα/στέγη/piloti)
 *        - `ground`           → b ≈ 0.5 (πλάκα επί εδάφους — ΤΟΤΕΕ b_g)
 *        - `unheated`         → b ≈ 0.5 (μη θερμαινόμενος γειτονικός χώρος — ΤΟΤΕΕ b_u)
 *        - `adjacent-heated`  → b = 0   (μεταξύ δύο θερμαινόμενων χώρων = μηδέν απώλεια)
 *
 *   2. **Default U (W/m²K) δαπέδου/οροφής** όταν η πλάκα ΔΕΝ έχει μοντελοποιημένες
 *      θερμικές στρώσεις — «default constructions» (όπως Revit/4M): ο μελετητής
 *      παίρνει πλήρες Φ ακόμη και χωρίς πλήρη μοντελοποίηση slab. Editable.
 *
 * @see ./heat-load-types (BoundaryCondition — ο discriminator)
 * @see ../kenak-thermal-config (Te ανά ζώνη + όρια U — το άλλο σκέλος ΚΕΝΑΚ)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import type { BoundaryCondition, HeatLoadBoundaryKind } from './heat-load-types';

/**
 * Μειωτικός συντελεστής `b` (temperature adjustment) ανά οριακή συνθήκη.
 * SSoT — το engine διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const BOUNDARY_TEMPERATURE_FACTOR: Readonly<Record<BoundaryCondition, number>> = {
  'external-air': 1.0,
  ground: 0.5,
  unheated: 0.5,
  'adjacent-heated': 0,
};

/** `b` συντελεστής μιας οριακής συνθήκης (πάντα ορισμένο — exhaustive Record). */
export function getBoundaryTemperatureFactor(condition: BoundaryCondition): number {
  return BOUNDARY_TEMPERATURE_FACTOR[condition];
}

/**
 * Default U (W/m²K) **δαπέδου επί εδάφους / piloti** όταν η πλάκα δεν έχει
 * μοντελοποιημένες θερμικές στρώσεις. Αντιπροσωπευτική μονωμένη κατασκευή· editable.
 */
export const DEFAULT_FLOOR_U_WPER_M2K = 0.5;

/**
 * Default U (W/m²K) **οροφής/στέγης** όταν η πλάκα δεν έχει μοντελοποιημένες
 * θερμικές στρώσεις. Αντιπροσωπευτική μονωμένη κατασκευή· editable.
 */
export const DEFAULT_ROOF_U_WPER_M2K = 0.4;

/**
 * Default U (W/m²K) **εξωτ. τοίχου** όταν δεν υπάρχει DNA (custom/legacy τοίχος).
 * Fallback μόνο — οι μοντελοποιημένοι τοίχοι δίνουν U από `computeWallTypeUValue`.
 */
export const DEFAULT_WALL_U_WPER_M2K = 0.5;

/**
 * Ογκομετρικός συντελεστής απωλειών αερισμού `0.34` W·h/(m³·K) = ρ·cp του αέρα
 * (≈ 1.2 kg/m³ × 1005 J/kgK / 3600). EN 12831 / ΤΟΤΕΕ 20701-1:
 * Φ_V = 0.34 · n · V · ΔΤ.
 */
export const AIR_VENTILATION_FACTOR = 0.34;

// ─── L1.6 — EN ISO 13370 ground coupling (πλάκα επί εδάφους) ───────────────────

/**
 * Θερμική αγωγιμότητα εδάφους `λ_g` (W/mK) — EN ISO 13370 / ΤΟΤΕΕ 20701-2,
 * αντιπροσωπευτικό «τυπικό έδαφος» (αργιλώδες/αμμώδες ≈ 2.0· βράχος ~3.5· editable).
 * Οδηγεί το `U_g` (χαρακτηριστική διάσταση B′ + ισοδύναμο πάχος d_t). Per-soil-type
 * catalog = future.
 */
export const SOIL_THERMAL_CONDUCTIVITY_WPER_MK = 2.0;

/**
 * Εσωτερική επιφανειακή αντίσταση δαπέδου `R_si` (m²K/W) για ροή θερμότητας **προς
 * τα κάτω** — EN ISO 6946 (πλάκα επί εδάφους). Συστατικό του ισοδύναμου πάχους `d_t`
 * (EN ISO 13370 §9.3). Editable.
 */
export const GROUND_FLOOR_INTERNAL_RESISTANCE_R_SI = 0.17;

/**
 * Αντιπροσωπευτικό πάχος εξωτ. τοίχου `w` (m) — fallback του ισοδύναμου πάχους `d_t`
 * (EN ISO 13370 §9.3) όταν δεν υπάρχουν matched εξωτ. τοίχοι για length-weighted μέσο
 * όρο. Editable· έχει μικρή επίδραση στο `U_g` (d_t κυριαρχείται από λ_g·R_f).
 */
export const DEFAULT_GROUND_WALL_THICKNESS_M = 0.3;

// ─── L1.7 — Αερισμός / Διείσδυση (EN 12831-1 §6.3.3) ──────────────────────────
//
// Διαχωρισμός του μονού `n` σε δύο φυσικά σκέλη:
//   n_inf = 2·n50·e·ε        (ανεξέλεγκτη διείσδυση μέσω στεγανότητας κελύφους)
//   n_ven = n_min·(1−η)       (σχεδιασμένος/υγιεινός αερισμός μείον ανάκτηση η)
//   n_eff = max(n_inf, n_ven) (EN 12831-1 §6.3.3 — ΜΕΓΙΣΤΟ, single-zone)
// Το `n_min` (=σημερινό `airChangesPerHour`) είναι το σχεδιασμένο σκέλος.
// Per-facade ανεμοπίεση/φαινόμενο φουγάρου + balanced-pressure μηχανικού = future.

/**
 * Κλάση αεροστεγανότητας κελύφους — ο discriminator της διείσδυσης (EN 13829 /
 * Passivhaus). Καθορίζει το `n50` (εναλλαγές αέρα στα 50 Pa) μέσω
 * `INFILTRATION_N50_PRESETS`. Default χώρου `unspecified` (n50=0 ⇒ n_inf=0 ⇒
 * zero-regression: η διείσδυση δεν λαμβάνεται υπόψη μέχρι να την ορίσει ο μελετητής).
 */
export type AirTightnessLevel = 'unspecified' | 'tight' | 'standard' | 'leaky' | 'very-leaky';

/**
 * `n50` (1/h @ 50 Pa) ανά κλάση αεροστεγανότητας — EN 12831-1 / EN 13829 / Passivhaus.
 * Αντιπροσωπευτικές τιμές (editable):
 *   - `unspecified` → 0    (δεν λαμβάνεται υπόψη — default, zero-regression)
 *   - `tight`       → 1.0  (πολύ καλή στεγανότητα / νέα κατασκευή, ~Passivhaus 0.6-1.0)
 *   - `standard`    → 3.0  (τυπική σύγχρονη κατασκευή)
 *   - `leaky`       → 6.0  (μέτρια / παλαιότερη κατασκευή)
 *   - `very-leaky`  → 10.0 (πολύ διαπερατό κέλυφος / αμελέτητη στεγανότητα)
 * SSoT — το `ventilation-model` διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const INFILTRATION_N50_PRESETS: Readonly<Record<AirTightnessLevel, number>> = {
  unspecified: 0,
  tight: 1.0,
  standard: 3.0,
  leaky: 6.0,
  'very-leaky': 10.0,
};

/** Σειρά εμφάνισης κλάσεων αεροστεγανότητας (για dropdown options). */
export const AIR_TIGHTNESS_LEVELS: readonly AirTightnessLevel[] = [
  'unspecified',
  'tight',
  'standard',
  'leaky',
  'very-leaky',
] as const;

/** Default κλάση αεροστεγανότητας χώρου — `unspecified` (n50=0, zero-regression). */
export const DEFAULT_AIR_TIGHTNESS_LEVEL: AirTightnessLevel = 'unspecified';

/** `n50` (1/h) μιας κλάσης αεροστεγανότητας (πάντα ορισμένο — exhaustive Record). */
export function getInfiltrationN50(level: AirTightnessLevel): number {
  return INFILTRATION_N50_PRESETS[level];
}

/**
 * Σύστημα αερισμού — ο discriminator της ανάκτησης θερμότητας `η`. Καθορίζει το `η`
 * μέσω `HEAT_RECOVERY_EFFICIENCY_BY_SYSTEM`. Default χώρου `natural` (η=0 ⇒
 * n_ven=n_min ⇒ zero-regression). Οι `mechanical-hr-*` παραλλαγές καλύπτουν τις
 * τυπικές αποδόσεις εναλλάκτη (καθιστούν κάθε preset ανάκτησης reachable — μηδέν dead-code).
 */
export type VentilationSystem =
  | 'natural'
  | 'mechanical'
  | 'mechanical-hr-standard'
  | 'mechanical-hr-high'
  | 'mechanical-hr-passive';

/**
 * Απόδοση ανάκτησης θερμότητας `η` ∈ [0,1) ανά σύστημα αερισμού — EN 12831-1 §6.3.3.
 * Το σχεδιασμένο σκέλος μειώνεται κατά `(1−η)`. Αντιπροσωπευτικές τιμές (editable):
 *   - `natural`                → 0    (φυσικός αερισμός — default, zero-regression)
 *   - `mechanical`             → 0    (μηχανικός χωρίς ανάκτηση)
 *   - `mechanical-hr-standard` → 0.6  (τυπικός εναλλάκτης HRV)
 *   - `mechanical-hr-high`     → 0.8  (υψηλής απόδοσης εναλλάκτης)
 *   - `mechanical-hr-passive`  → 0.9  (Passivhaus-grade εναλλάκτης)
 * SSoT — το `ventilation-model` διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const HEAT_RECOVERY_EFFICIENCY_BY_SYSTEM: Readonly<Record<VentilationSystem, number>> = {
  natural: 0,
  mechanical: 0,
  'mechanical-hr-standard': 0.6,
  'mechanical-hr-high': 0.8,
  'mechanical-hr-passive': 0.9,
};

/** Σειρά εμφάνισης συστημάτων αερισμού (για dropdown options). */
export const VENTILATION_SYSTEMS: readonly VentilationSystem[] = [
  'natural',
  'mechanical',
  'mechanical-hr-standard',
  'mechanical-hr-high',
  'mechanical-hr-passive',
] as const;

/** Default σύστημα αερισμού χώρου — `natural` (η=0, zero-regression). */
export const DEFAULT_VENTILATION_SYSTEM: VentilationSystem = 'natural';

/** Απόδοση ανάκτησης `η` ενός συστήματος (πάντα ορισμένο — exhaustive Record). */
export function getHeatRecoveryEfficiency(system: VentilationSystem): number {
  return HEAT_RECOVERY_EFFICIENCY_BY_SYSTEM[system];
}

/**
 * Συντελεστής ανεμοπροστασίας `e` (wind shielding, EN 12831-1 Πίν. — τυπική
 * προστασία) ανά αριθμό **εκτεθειμένων όψεων** του χώρου:
 *   - 0 όψεις (πλήρως εσωτερικός) → 0    (καμία διείσδυση)
 *   - 1 όψη                       → 0.02
 *   - ≥2 όψεις (γωνιακός/εκτεθειμένος) → 0.03
 * Editable. Per-orientation wind/stack coefficient = future.
 */
export const WIND_SHIELDING_NO_EXPOSED_FACADE = 0;
export const WIND_SHIELDING_SINGLE_EXPOSED_FACADE = 0.02;
export const WIND_SHIELDING_MULTIPLE_EXPOSED_FACADES = 0.03;

/** Συντελεστής ανεμοπροστασίας `e` από τον αριθμό εκτεθειμένων όψεων (clamp στο 0). */
export function getWindShieldingCoefficient(exposedFacadeCount: number): number {
  if (!Number.isFinite(exposedFacadeCount) || exposedFacadeCount <= 0) {
    return WIND_SHIELDING_NO_EXPOSED_FACADE;
  }
  return exposedFacadeCount === 1
    ? WIND_SHIELDING_SINGLE_EXPOSED_FACADE
    : WIND_SHIELDING_MULTIPLE_EXPOSED_FACADES;
}

/**
 * Συντελεστής διόρθωσης ύψους `ε` (height correction, EN 12831-1) — ≈1.0 για
 * τυπικά χαμηλά/μεσαία κτίρια. Per-storey ε (αύξηση με το ύψος λόγω φαινομένου
 * φουγάρου) = future. Editable.
 */
export const HEIGHT_CORRECTION_FACTOR_EPSILON = 1.0;

// ─── L1.5 — Θερμογέφυρες (ΔU_TB) ──────────────────────────────────────────────

/**
 * Επίπεδο θερμογεφυρών — ο discriminator της απλοποιημένης μεθόδου EN 12831-1
 * §6.3.2. Καθορίζει το `ΔU_TB` (blanket προσαύξηση του U) μέσω
 * `THERMAL_BRIDGE_SURCHARGE_PRESETS`. Default χώρου `none` (zero-regression).
 */
export type ThermalBridgeLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * `ΔU_TB` (W/m²K) ανά επίπεδο θερμογεφυρών — απλοποιημένη μέθοδος EN 12831-1
 * §6.3.2: `U_corr = U + ΔU_TB` στα αδιαφανή στοιχεία περιβλήματος. Τυπικές τιμές
 * (αντιπροσωπευτικές κανονισμού, editable):
 *   - `none`   → 0     (καμία προσαύξηση — default, zero-regression)
 *   - `low`    → 0.05  (καλά μελετημένες λεπτομέρειες / διακοπτόμενη μόνωση)
 *   - `medium` → 0.10  (τυπική κατασκευή)
 *   - `high`   → 0.15  (πολλές αμελέτητες γέφυρες / παλαιό κτίριο)
 * SSoT — το engine διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const THERMAL_BRIDGE_SURCHARGE_PRESETS: Readonly<Record<ThermalBridgeLevel, number>> = {
  none: 0,
  low: 0.05,
  medium: 0.1,
  high: 0.15,
};

/** Σειρά εμφάνισης επιπέδων θερμογεφυρών (για dropdown options). */
export const THERMAL_BRIDGE_LEVELS: readonly ThermalBridgeLevel[] = [
  'none',
  'low',
  'medium',
  'high',
] as const;

/** Default επίπεδο θερμογεφυρών χώρου — `none` (zero-regression). */
export const DEFAULT_THERMAL_BRIDGE_LEVEL: ThermalBridgeLevel = 'none';

/** `ΔU_TB` (W/m²K) ενός επιπέδου (πάντα ορισμένο — exhaustive Record). */
export function getThermalBridgeSurcharge(level: ThermalBridgeLevel): number {
  return THERMAL_BRIDGE_SURCHARGE_PRESETS[level];
}

/**
 * Οριακές συνθήκες που λαμβάνουν προσαύξηση θερμογέφυρας — μόνο όσες μεταφέρουν
 * θερμότητα προς τα έξω (`external-air`/`ground`). `adjacent-heated` (b=0) +
 * `unheated` εξαιρούνται στο v1.
 */
export const THERMAL_BRIDGE_CONDITIONS: ReadonlySet<BoundaryCondition> = new Set<BoundaryCondition>([
  'external-air',
  'ground',
]);

/**
 * Τύποι στοιχείων που λαμβάνουν προσαύξηση θερμογέφυρας — μόνο **αδιαφανή**
 * στοιχεία περιβλήματος. Παράθυρα/πόρτες εξαιρούνται (το frame TB περιλαμβάνεται
 * ήδη στο U_w του κουφώματος).
 */
export const THERMAL_BRIDGE_KINDS: ReadonlySet<HeatLoadBoundaryKind> = new Set<HeatLoadBoundaryKind>([
  'wall',
  'floor',
  'roof',
  'ceiling',
]);

/** `true` αν μια οριακή επιφάνεια λαμβάνει την προσαύξηση θερμογέφυρας ΔU_TB. */
export function boundaryReceivesThermalBridge(
  kind: HeatLoadBoundaryKind,
  condition: BoundaryCondition,
): boolean {
  return THERMAL_BRIDGE_KINDS.has(kind) && THERMAL_BRIDGE_CONDITIONS.has(condition);
}

// ─── L1.5 — Επανέναρξη / Reheat (Φ_RH) ────────────────────────────────────────

/**
 * Λειτουργία θέρμανσης — ο discriminator του πρόσθετου φορτίου επανέναρξης
 * (EN 12831 reheat). Καθορίζει το `f_RH` (W/m²) μέσω `REHEAT_FACTOR_PRESETS`.
 * Default χώρου `continuous` (f_RH=0, zero-regression).
 */
export type ReheatMode = 'continuous' | 'night-setback' | 'intermittent' | 'boost';

/**
 * `f_RH` (W/m²) ανά λειτουργία θέρμανσης — EN 12831: `Φ_RH = A_floor · f_RH`.
 * Αντιπροσωπευτικές τιμές Annex D (κατοικία, μέτρια μάζα, ~2 K ανάκαμψη), editable:
 *   - `continuous`    → 0   (συνεχής λειτουργία — default, zero-regression)
 *   - `night-setback` → 11  (νυχτερινή υποβάθμιση ~8h)
 *   - `intermittent`  → 22  (διακοπτόμενη / μεγαλύτερη υποβάθμιση)
 *   - `boost`         → 44  (γρήγορη επανέναρξη / βαριά υποβάθμιση)
 * SSoT — το engine διαβάζει ΜΟΝΟ από εδώ (ποτέ inline literal).
 */
export const REHEAT_FACTOR_PRESETS: Readonly<Record<ReheatMode, number>> = {
  continuous: 0,
  'night-setback': 11,
  intermittent: 22,
  boost: 44,
};

/** Σειρά εμφάνισης λειτουργιών θέρμανσης (για dropdown options). */
export const REHEAT_MODES: readonly ReheatMode[] = [
  'continuous',
  'night-setback',
  'intermittent',
  'boost',
] as const;

/** Default λειτουργία θέρμανσης χώρου — `continuous` (zero-regression). */
export const DEFAULT_REHEAT_MODE: ReheatMode = 'continuous';

/** `f_RH` (W/m²) μιας λειτουργίας (πάντα ορισμένο — exhaustive Record). */
export function getReheatFactor(mode: ReheatMode): number {
  return REHEAT_FACTOR_PRESETS[mode];
}
