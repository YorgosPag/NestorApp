/**
 * Structural loads model — types (ADR-464, Slice 1).
 *
 * FEM-free loads model (Revit-without-Robot): τα φορτία προέρχονται από (α)
 * χειροκίνητα analytical loads που ορίζει ο μηχανικός (`AppliedMemberLoad`,
 * persisted) ή (β) tributary load takedown (Slice 4, DERIVED). Και τα δύο
 * εκφράζονται ως **χαρακτηριστικές (service) G/Q συνιστώσες** — οι συνδυασμοί
 * (ULS/SLS) εφαρμόζονται στο `load-combinations.ts` (EN1990).
 *
 * Μονάδες: αξονικά σε kN (θλίψη ΘΕΤΙΚΗ), ροπές σε kNm. Σύμβαση εκκεντρότητας:
 * `momentX` = ροπή που παράγει εκκεντρότητα **κατά τον άξονα X (πλάτος)** του
 * ίχνους → e_x = momentX/N· αντίστοιχα `momentY` → e_y κατά Y (μήκος).
 *
 * Pure types + pure resolvers — zero React/DOM/Firestore.
 *
 * @see ./load-combinations.ts — EN1990 ULS/SLS συνδυασμοί
 * @see ../footing-design/footing-design-types.ts — ο καταναλωτής (design engine)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

/** Προέλευση φορτίου: χειροκίνητο (μηχανικός) ή tributary takedown (Slice 4). */
export type MemberLoadSource = 'manual' | 'takedown';

/**
 * Persisted χειροκίνητο service φορτίο μέλους (χαρακτηριστικές G/Q τιμές). Τα
 * αξονικά είναι υποχρεωτικά· οι ροπές προαιρετικές (absent → 0). Optional/non-
 * breaking στα params (absent → ο design engine παραμένει αδρανής).
 */
export interface AppliedMemberLoad {
  /** Μόνιμο αξονικό G (kN). */
  readonly deadAxialKn: number;
  /** Μεταβλητό αξονικό Q (kN). */
  readonly liveAxialKn: number;
  /** Μόνιμη ροπή περί άξονα → e_x (kNm). */
  readonly deadMomentXKnm?: number;
  /** Μεταβλητή ροπή → e_x (kNm). */
  readonly liveMomentXKnm?: number;
  /** Μόνιμη ροπή → e_y (kNm). */
  readonly deadMomentYKnm?: number;
  /** Μεταβλητή ροπή → e_y (kNm). */
  readonly liveMomentYKnm?: number;
  /**
   * ADR-464 Slice 4 — προέλευση του φορτίου: `manual` (μηχανικός το όρισε στο panel)
   * ή `takedown` (αυτόματο tributary). Absent → manual (legacy/default). Ο tributary
   * takedown ΠΟΤΕ δεν αντικαθιστά χειροκίνητο φορτίο (source≠'takedown'). Persisted
   * literal (Firestore-safe) — omit-when-manual upstream ώστε να μη γράφεται explicit.
   */
  readonly source?: MemberLoadSource;
}

/**
 * Πλήρως αναλυμένο φορτίο μέλους — όλες οι G/Q συνιστώσες ρητές (μηδέν optional)
 * + προέλευση. DERIVED από `AppliedMemberLoad` ή takedown· είσοδος στους συνδυασμούς.
 */
export interface MemberLoad {
  readonly deadAxialKn: number;
  readonly liveAxialKn: number;
  readonly deadMomentXKnm: number;
  readonly liveMomentXKnm: number;
  readonly deadMomentYKnm: number;
  readonly liveMomentYKnm: number;
  readonly source: MemberLoadSource;
}

/** Συνδυασμένο φορτίο σχεδιασμού (ULS ή SLS) — μετά τους συντελεστές EN1990. */
export interface CombinedLoad {
  /** Αξονικό (kN). */
  readonly axialKn: number;
  /** Ροπή → e_x (kNm). */
  readonly momentXKnm: number;
  /** Ροπή → e_y (kNm). */
  readonly momentYKnm: number;
}

/** Μηδενικό MemberLoad (default/no-op). */
export const ZERO_MEMBER_LOAD: MemberLoad = {
  deadAxialKn: 0,
  liveAxialKn: 0,
  deadMomentXKnm: 0,
  liveMomentXKnm: 0,
  deadMomentYKnm: 0,
  liveMomentYKnm: 0,
  source: 'manual',
};

/** True όταν το φορτίο είναι ουσιαστικά μηδενικό (engine αδρανές → skip). */
export function isZeroMemberLoad(load: MemberLoad): boolean {
  return (
    load.deadAxialKn === 0 &&
    load.liveAxialKn === 0 &&
    load.deadMomentXKnm === 0 &&
    load.liveMomentXKnm === 0 &&
    load.deadMomentYKnm === 0 &&
    load.liveMomentYKnm === 0
  );
}

/** Πεπερασμένος αριθμός ή 0 (sanitize persisted/legacy input). */
function num(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * `AppliedMemberLoad` (persisted, optional ροπές) → πλήρες `MemberLoad`. Μη-έγκυρες/
 * absent τιμές → 0 (μηδέν explicit undefined, Firestore-safe upstream).
 */
export function resolveAppliedMemberLoad(
  applied: AppliedMemberLoad | undefined | null,
  source: MemberLoadSource = 'manual',
): MemberLoad {
  if (!applied) return { ...ZERO_MEMBER_LOAD, source };
  return {
    deadAxialKn: num(applied.deadAxialKn),
    liveAxialKn: num(applied.liveAxialKn),
    deadMomentXKnm: num(applied.deadMomentXKnm),
    liveMomentXKnm: num(applied.liveMomentXKnm),
    deadMomentYKnm: num(applied.deadMomentYKnm),
    liveMomentYKnm: num(applied.liveMomentYKnm),
    // Η αποθηκευμένη προέλευση υπερισχύει· absent → ο default (manual).
    source: applied.source ?? source,
  };
}

/**
 * ADR-464 Slice 4 — Επιτρέπεται στο tributary takedown να (επαν)γράψει το φορτίο
 * αυτού του πεδίλου; ΟΧΙ αν ο μηχανικός το όρισε χειροκίνητα (manual) με μη-μηδενικό
 * φορτίο. Επιτρέπεται όταν: απών, μηδενικό, ή ήδη takedown-derived (idempotent refresh).
 */
export function isTakedownWritable(applied: AppliedMemberLoad | undefined | null): boolean {
  if (!applied) return true;
  if (applied.source === 'takedown') return true;
  // source απών/'manual' → manual μόνο αν έχει ουσιαστικό φορτίο (αλλιώς ελεύθερο).
  return isZeroMemberLoad(resolveAppliedMemberLoad(applied));
}
