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

import type { BoundaryCondition } from './heat-load-types';

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
