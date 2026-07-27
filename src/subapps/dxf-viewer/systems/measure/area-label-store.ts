/**
 * ADR-649 / ADR-662 §12 — «Ετικέτα Εμβαδού»: FSM store (2 κλικ).
 *
 * SSoT για την κατάσταση του 2-κλικ εργαλείου, event-time read/write (χωρίς React
 * snapshot — ADR-040: το click handler διαβάζει live getter, όχι stale closure):
 *   - `awaitingEntity`    → 1ο κλικ: διάλεξε οντότητα με μετρήσιμο εμβαδόν.
 *   - `awaitingPlacement` → 2ο κλικ: τοποθέτησε την ετικέτα (κρατά το picked id).
 *
 * **Αγνωστικό ως προς τον τύπο** (ADR-662 §12): κρατά σκέτο `entityId`, όχι `hatchId`.
 * Ποιοι τύποι επιτρέπονται το αποφασίζει **αποκλειστικά** το `entity-measurement-facts`
 * (γραμμοσκίαση, τοπογραφική επιφάνεια, ό,τι έρθει μετά) — αυτό εδώ δεν ξέρει τύπους.
 * Ήταν `bim/hatch/hatch-area-label-store.ts` όσο το εργαλείο ήταν hatch-only.
 *
 * Ελάχιστο module-level state (καμία reactive subscription — το status prompt το
 * δείχνει το `toolHintOverrideStore`). `reset()` καλείται στο tool activate/
 * deactivate (`useAreaLabelTool`) ώστε καμία stale φάση να μη μεταφέρεται.
 *
 * @see ./area-label — pure builders (κείμενο/θέση/entity)
 * @see ./entity-measurement-facts — ποιοι τύποι έχουν εμβαδόν
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

export type AreaLabelPhase = 'awaitingEntity' | 'awaitingPlacement';

interface AreaLabelState {
  phase: AreaLabelPhase;
  /** Id της οντότητας που κλειδώθηκε στο 1ο κλικ (null όσο περιμένουμε επιλογή). */
  entityId: string | null;
}

const state: AreaLabelState = { phase: 'awaitingEntity', entityId: null };

/** Τρέχουσα φάση + picked id (event-time snapshot· ασφαλές — plain read). */
export function getAreaLabelState(): Readonly<AreaLabelState> {
  return state;
}

/** 1ο κλικ πέτυχε: κλείδωσε την οντότητα, πέρασε σε αναμονή τοποθέτησης. */
export function armAreaLabelPlacement(entityId: string): void {
  state.phase = 'awaitingPlacement';
  state.entityId = entityId;
}

/** Επαναφορά στην αρχική φάση (νέα επιλογή οντότητας). */
export function resetAreaLabel(): void {
  state.phase = 'awaitingEntity';
  state.entityId = null;
}
