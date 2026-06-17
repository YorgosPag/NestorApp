/**
 * EC8 σεισμικές παράμετροι εδάφους — SSoT (ADR-477 Slice 3).
 *
 * Κατηγορία εδάφους (A–E), συντελεστής εδάφους S (EN1998-1 §3.2.2.2 Πίν. 3.2,
 * φάσμα Τύπου 1 — Ελληνικό Εθνικό Προσάρτημα) και ο συντελεστής ε της δύναμης
 * σύνδεσης συνδετήριων δοκών (EN1998-5 §5.4.1.2(7)). ΕΝΑ μέρος που κατέχει τους
 * EC8 πίνακες — ο `tie-beam-tie-force` consumer τους διαβάζει, ποτέ δεν τους
 * αναπαράγει.
 *
 * Building-level παραδοχή: το a_gR (επιτάχυνση αναφοράς) + ground type ζουν στα
 * `StructuralSettings` (Revit: Project → Seismic). Pure data + factor — zero deps
 * (importable από settings/scene/suggester χωρίς κύκλους ή Firebase).
 *
 * @see ./structural-loads-types.ts — AppliedMemberLoad (πηγή N_Ed κολονών)
 * @see ./tie-beam-tie-force.ts — ο scene-level consumer (N_tie = factor · N_Ed,mean)
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 3
 */

/** Κατηγορία εδάφους EC8 (EN1998-1 §3.1.2 Πίνακας 3.1). */
export type SeismicGroundType = 'A' | 'B' | 'C' | 'D' | 'E';

/** Default κατηγορία εδάφους όταν δεν έχει οριστεί (B — τυπικό συμπαγές έδαφος). */
export const DEFAULT_SEISMIC_GROUND_TYPE: SeismicGroundType = 'B';

/**
 * Default λόγος επιτάχυνσης αναφοράς εδάφους a_gR/g όταν δεν έχει οριστεί. 0.16g =
 * Ελληνική Ζώνη Σεισμικής Επικινδυνότητας Ζ1 (EN1998-1 Εθνικό Προσάρτημα) — ασφαλής,
 * μη-μηδενική προεπιλογή ώστε η δύναμη σύνδεσης να μην είναι σιωπηρά 0.
 */
export const DEFAULT_SEISMIC_GROUND_ACCEL_RATIO = 0.16;

const GROUND_TYPES: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'E']);

/** Type-guard: έγκυρη κατηγορία εδάφους EC8. */
export function isSeismicGroundType(v: string | undefined): v is SeismicGroundType {
  return typeof v === 'string' && GROUND_TYPES.has(v);
}

/** True όταν η τιμή a_gR/g είναι έγκυρη πεπερασμένη θετική. */
export function isValidGroundAccelRatio(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Συντελεστής εδάφους S ανά κατηγορία (EN1998-1 §3.2.2.2 Πίνακας 3.2 — φάσμα Τύπου 1).
 * Πολλαπλασιάζει την επιτάχυνση σχεδιασμού (a_g·S).
 */
const SOIL_FACTOR_S: Readonly<Record<SeismicGroundType, number>> = {
  A: 1.0,
  B: 1.2,
  C: 1.15,
  D: 1.35,
  E: 1.4,
};

/**
 * Συντελεστής ε της δύναμης σύνδεσης (EN1998-5 §5.4.1.2(7)) ανά κατηγορία εδάφους.
 * Κατηγορία A (βράχος) → 0: δεν απαιτούνται συνδετήριες δοκοί. B/C/D/E → 0.3/0.4/0.6/0.6.
 */
const TIE_FORCE_EPSILON: Readonly<Record<SeismicGroundType, number>> = {
  A: 0,
  B: 0.3,
  C: 0.4,
  D: 0.6,
  E: 0.6,
};

/** Συντελεστής εδάφους S της κατηγορίας (EN1998-1 Πίν. 3.2). */
export function soilFactorS(groundType: SeismicGroundType): number {
  return SOIL_FACTOR_S[groundType];
}

/**
 * EN1998-5 §5.4.1.2(7) — αδιάστατος συντελεστής δύναμης σύνδεσης `ε·α·S`, όπου
 * `α = a_gR/g`. Η αξονική δύναμη σύνδεσης μιας συνδετήριας δοκού είναι
 * `N_tie = factor · N_Ed,mean` (N_Ed,mean = μέσος όρος αξονικών των συνδεόμενων
 * υποστυλωμάτων). Κατηγορία A ή μη-θετική επιτάχυνση → 0 (μηδέν δύναμη σύνδεσης).
 */
export function seismicTieForceFactor(
  groundType: SeismicGroundType,
  groundAccelRatio: number,
): number {
  const alpha = isValidGroundAccelRatio(groundAccelRatio) ? groundAccelRatio : 0;
  return TIE_FORCE_EPSILON[groundType] * alpha * SOIL_FACTOR_S[groundType];
}
