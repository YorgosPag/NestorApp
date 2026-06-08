/**
 * ADR-422 L2 — Radiator-sizing config SSoT (EN 442 / ΤΟΤΕΕ 20701).
 *
 * Σταθερές + presets για τη διαστασιολόγηση θερμαντικών σωμάτων (Revit «System
 * Type temperatures» / 4M-FineHEAT). ΚΑΜΙΑ αριθμητική εδώ — μόνο config:
 *
 *   - `DELTA_T_NOMINAL_K` = 50 K — η πρότυπη ονομαστική θερμοκρασιακή υπεροχή του
 *     EN 442 (αντιστοιχεί σε 75/65/20). Ο κατάλογος (`thermalOutputW`) δίνεται @ΔΤ50K.
 *   - `DEFAULT_RADIATOR_EXPONENT` = 1.30 — εκθέτης σώματος `n` (panel radiator, EN 442).
 *     Μελλοντικά per-catalog/per-kind override· σήμερα ενιαίο default.
 *   - `SYSTEM_REGIME_PRESETS` — προεπιλεγμένα ζεύγη θερμοκρασιών προσαγωγής/επιστροφής
 *     (Tsupply/Treturn σε °C) του δικτύου θέρμανσης (D4: 80/60 · 75/65 · 70/55 · 45/35).
 *   - `DEFAULT_SYSTEM_REGIME_PRESET_ID` = '75-65' — ουδέτερο default: AMTD@Ti20 = 50 K
 *     ⇒ παράγοντας διόρθωσης 1.0 (καμία μεταβολή μέχρι ο μελετητής επιλέξει regime).
 *
 * @see ./radiator-sizing (computeRequiredRadiatorOutput — pure math)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §2 D4 / §3 L2
 */

/** K — πρότυπη ονομαστική θερμοκρασιακή υπεροχή EN 442 (κατάλογος @ΔΤ50K). */
export const DELTA_T_NOMINAL_K = 50;

/** Εκθέτης σώματος `n` (panel radiator, EN 442). Config SSoT· future per-catalog. */
export const DEFAULT_RADIATOR_EXPONENT = 1.3;

/** Discriminator preset καθεστώτος θερμοκρασιών δικτύου (supply/return). */
export type SystemRegimePresetId = '80-60' | '75-65' | '70-55' | '45-35';

/** Ζεύγος θερμοκρασιών προσαγωγής/επιστροφής δικτύου (°C) + i18n label. */
export interface SystemRegimePreset {
  readonly id: SystemRegimePresetId;
  /** °C — θερμοκρασία προσαγωγής (supply). */
  readonly supplyC: number;
  /** °C — θερμοκρασία επιστροφής (return). */
  readonly returnC: number;
  /** Literal label «80/60» (numeric+symbol — επιτρεπτό ως μη-μεταφράσιμη μονάδα). */
  readonly label: string;
}

/**
 * Προεπιλεγμένα regimes (ΤΟΤΕΕ / Revit System Type). Διατεταγμένα από το πιο
 * «καυτό» στο πιο «δροσερό» (ενδοδαπέδια 45/35). Η σειρά διατηρείται στο UI.
 */
export const SYSTEM_REGIME_PRESETS: readonly SystemRegimePreset[] = [
  { id: '80-60', supplyC: 80, returnC: 60, label: '80/60' },
  { id: '75-65', supplyC: 75, returnC: 65, label: '75/65' },
  { id: '70-55', supplyC: 70, returnC: 55, label: '70/55' },
  { id: '45-35', supplyC: 45, returnC: 35, label: '45/35' },
] as const;

/** Default regime — ουδέτερο (AMTD@Ti20 = 50 K ⇒ factor 1.0). */
export const DEFAULT_SYSTEM_REGIME_PRESET_ID: SystemRegimePresetId = '75-65';

const REGIME_BY_ID: ReadonlyMap<SystemRegimePresetId, SystemRegimePreset> = new Map(
  SYSTEM_REGIME_PRESETS.map((p) => [p.id, p]),
);

/**
 * Resolve το preset καθεστώτος από id. Άγνωστο/απόν id → το default preset
 * (Revit «type default»). Ποτέ null — πάντα έγκυρο regime για τον υπολογισμό.
 */
export function resolveSystemRegime(
  presetId?: SystemRegimePresetId,
): SystemRegimePreset {
  if (presetId) {
    const found = REGIME_BY_ID.get(presetId);
    if (found) return found;
  }
  // Non-null: το default ID είναι πάντα στο preset map.
  return REGIME_BY_ID.get(DEFAULT_SYSTEM_REGIME_PRESET_ID) as SystemRegimePreset;
}
