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
