/**
 * COLUMN POLAR STORE — zero-React singleton (ADR-398 §3.13/§3.14).
 *
 * Κρατά **μόνο interaction modifiers** του Polar Magnet εργαλείου Κολώνα — ΟΧΙ snap state (το snap
 * ρέει από το κοινό `sceneSnapTargetsStore` + `resolveColumnFaceSnapFromTargets`, preview ≡ commit):
 *   · `shiftFractions` — §3.13 Q1: `true` όσο κρατιέται Shift → δακτύλιοι σε **κλάσματα ακτίνας**
 *     (R/4…3R/4) αντί nice-absolute.
 *   · `foldOverride`  — §3.14: ο χρήστης κυλά (wheel) μεταξύ {3,4,6,8,12} για το n-fold symmetry·
 *     `null` = auto-detect από τις υπάρχουσες κολώνες στον δακτύλιο.
 *
 * Mirror του `ColumnRotationStore`/`ColumnTopLeanStore` (imperative, zero React, ADR-040): writer =
 * ο column keyboard/wheel handler· readers = `column-preview-helpers` (ghost) + `mouse-handler-up`
 * (commit). Reset on tool deactivate / ESC.
 *
 * @see ./ColumnRotationStore.ts — ίδιο pattern (zero-React placement interaction store)
 * @see ../../bim/columns/polar-disk-snap.ts — ο pure resolver που καταναλώνει το `shiftFractions`
 */

/** Allowed n-fold τιμές για το §3.14 scroll override (όλες διαιρούν το 360). */
export const POLAR_FOLD_OPTIONS: readonly number[] = [3, 4, 6, 8, 12];

interface ColumnPolarState {
  /** §3.13 Q1 — Shift κρατιέται → δακτύλιοι σε κλάσματα ακτίνας. */
  readonly shiftFractions: boolean;
  /** §3.14 — n-fold override (wheel)· `null` = auto-detect. */
  readonly foldOverride: number | null;
}

let state: ColumnPolarState = { shiftFractions: false, foldOverride: null };

/** Read — imperatively στο preview draw + στο commit (zero React). */
export function getColumnPolarState(): ColumnPolarState {
  return state;
}

/** Write — §3.13 Q1: Shift down/up. */
export function setColumnPolarShiftFractions(shiftFractions: boolean): void {
  if (state.shiftFractions !== shiftFractions) state = { ...state, shiftFractions };
}

/** Write — §3.14: κύλισε το n-fold override (`null` → auto). */
export function setColumnPolarFoldOverride(foldOverride: number | null): void {
  if (state.foldOverride !== foldOverride) state = { ...state, foldOverride };
}

/** Κύλισε στο επόμενο/προηγούμενο n-fold ({3,4,6,8,12})· από auto (`null`) ξεκινά στο πρώτο. */
export function cycleColumnPolarFold(direction: 1 | -1): void {
  const opts = POLAR_FOLD_OPTIONS;
  const cur = state.foldOverride;
  const idx = cur === null ? -1 : opts.indexOf(cur);
  const next = idx < 0
    ? (direction > 0 ? opts[0] : opts[opts.length - 1])
    : opts[(idx + direction + opts.length) % opts.length];
  setColumnPolarFoldOverride(next);
}

/** Clear — αλλαγή εργαλείου / ESC / commit. */
export function resetColumnPolarState(): void {
  state = { shiftFractions: false, foldOverride: null };
}
