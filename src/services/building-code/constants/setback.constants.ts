/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * ΝΟΚ setback constants — Δ/δ minimum values per ν.4067/2012 Art. 9.
 */

/** Minimum lateral setback δ (m) — ΝΟΚ ν.4067/2012. */
export const DEFAULT_DELTA_MIN_M = 2.5;

/** Minimum buildable side rule (m) — ΝΟΚ 9.00m οικοδομησιμότητα check. */
export const MIN_BUILDABLE_SIDE_M = 9.0;

/** Minimum adjacent clearance (m) — sanity guard for very narrow plots. */
export const MIN_ADJACENT_CLEARANCE_M = 1.0;
