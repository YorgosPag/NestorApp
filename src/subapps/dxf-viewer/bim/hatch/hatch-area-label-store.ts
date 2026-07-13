/**
 * ADR-649 — «Ετικέτα Εμβαδού Γραμμοσκίασης»: FSM store (2 κλικ).
 *
 * SSoT για την κατάσταση του 2-κλικ εργαλείου, event-time read/write (χωρίς React
 * snapshot — ADR-040: το click handler διαβάζει live getter, όχι stale closure):
 *   - `awaitingHatch`     → 1ο κλικ: διάλεξε γραμμοσκίαση.
 *   - `awaitingPlacement` → 2ο κλικ: τοποθέτησε την ετικέτα (κρατά το picked id).
 *
 * Ελάχιστο module-level state (καμία reactive subscription — το status prompt το
 * δείχνει το `toolHintOverrideStore`). `reset()` καλείται στο tool activate/
 * deactivate (`useHatchAreaLabelTool`) ώστε καμία stale φάση να μη μεταφέρεται.
 *
 * @see ./hatch-area-label — pure builders (κείμενο/θέση/entity)
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

export type HatchAreaLabelPhase = 'awaitingHatch' | 'awaitingPlacement';

interface HatchAreaLabelState {
  phase: HatchAreaLabelPhase;
  /** Id της γραμμοσκίασης που κλειδώθηκε στο 1ο κλικ (null όσο περιμένουμε επιλογή). */
  hatchId: string | null;
}

const state: HatchAreaLabelState = { phase: 'awaitingHatch', hatchId: null };

/** Τρέχουσα φάση + picked id (event-time snapshot· ασφαλές — plain read). */
export function getHatchAreaLabelState(): Readonly<HatchAreaLabelState> {
  return state;
}

/** 1ο κλικ πέτυχε: κλείδωσε τη γραμμοσκίαση, πέρασε σε αναμονή τοποθέτησης. */
export function armHatchAreaLabelPlacement(hatchId: string): void {
  state.phase = 'awaitingPlacement';
  state.hatchId = hatchId;
}

/** Επαναφορά στην αρχική φάση (νέα επιλογή γραμμοσκίασης). */
export function resetHatchAreaLabel(): void {
  state.phase = 'awaitingHatch';
  state.hatchId = null;
}
