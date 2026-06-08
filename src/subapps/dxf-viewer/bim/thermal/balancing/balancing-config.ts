/**
 * ADR-422 L4 — Hydraulic balancing config SSoT (Darcy local losses + kv).
 *
 * Σταθερές για την υδραυλική εξισορρόπηση δικτύου θέρμανσης (Revit «System
 * Inspector» / 4M-FineHEAT «balancing schedule»). ΚΑΜΙΑ αριθμητική εδώ — μόνο config:
 *
 *   - `zetaForDegree` — συντελεστής τοπικής αντίστασης ζ (αδιάστατος) από τον βαθμό
 *     του junction του γράφου (topology-derived, D-A επιλογή A): straight/tap, elbow,
 *     tee. Pluggable → ένας entity-driven (mep-fitting) resolver μπαίνει πίσω από το
 *     ίδιο σχήμα χωρίς αλλαγή στους callers.
 *   - `ρ` — πυκνότητα νερού (reuse L3 `WATER_DENSITY_KG_M3`, μηδέν fork).
 *   - `TERMINAL_NOMINAL_DROP_PA` — ονομαστική πτώση σώματος/βαλβίδας ανά κύκλωμα
 *     (default 0, editable SSoT· future: per-radiator catalogue kv).
 *   - `PUMP_HEAD_SAFETY_FACTOR` — προσαύξηση μανομετρικού κυκλοφορητή επί του index.
 *   - `MIN_BALANCING_SURPLUS_PA` — κάτω από αυτό η balancing valve θεωρείται
 *     «πλήρως ανοιχτή» (kv → null) — το index κύκλωμα δεν στραγγαλίζεται.
 *
 * @see ./pressure-drop (Darcy ΔP) · ./circuit-balancing (index circuit + kv)
 * @see ../sizing/pipe-sizing-config (WATER_DENSITY_KG_M3 — reuse)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L4)
 */

import { WATER_DENSITY_KG_M3 } from '../sizing/pipe-sizing-config';

/** kg/m³ — πυκνότητα νερού @~70°C (reuse L3 SSoT, ΟΧΙ fork). */
export const BALANCING_WATER_DENSITY_KG_M3 = WATER_DENSITY_KG_M3;

/** ζ — straight-through / dead-end tap (degree ≤1): αμελητέα τοπική αντίσταση. */
export const ZETA_STRAIGHT = 0;

/** ζ — γωνία/elbow (degree 2): απότομη αλλαγή κατεύθυνσης 90°. */
export const ZETA_ELBOW = 0.5;

/** ζ — ταυ/tee (degree ≥3): διακλάδωση/συμβολή ροής. */
export const ZETA_TEE = 1.0;

/**
 * Συντελεστής τοπικής αντίστασης ζ από τον βαθμό του junction (topology-derived).
 * 0/1 ακμές = άκρο (straight), 2 = elbow, 3+ = tee. Pure/idempotent.
 */
export function zetaForDegree(degree: number): number {
  if (degree >= 3) return ZETA_TEE;
  if (degree === 2) return ZETA_ELBOW;
  return ZETA_STRAIGHT;
}

/** Pa — ονομαστική πτώση πίεσης σώματος/βαλβίδας ανά κύκλωμα. Editable SSoT (v1=0). */
export const TERMINAL_NOMINAL_DROP_PA = 0;

/** Αδιάστατος — προσαύξηση μανομετρικού επί του index circuit (1.0 = ακριβώς index). */
export const PUMP_HEAD_SAFETY_FACTOR = 1.0;

/** Pa — όριο κάτω από το οποίο η balancing valve μένει «ανοιχτή» (kv → null). */
export const MIN_BALANCING_SURPLUS_PA = 100;

/** Pa ανά bar — μετατροπή για τον τύπο kv (ΔP σε bar). */
export const PA_PER_BAR = 100_000;

/** s ανά h — μετατροπή παροχής m³/s → m³/h για τον τύπο kv. */
export const SECONDS_PER_HOUR = 3600;
