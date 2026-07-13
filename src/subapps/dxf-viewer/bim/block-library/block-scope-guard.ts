/**
 * ADR-652 M3 — Το ΝΟΜΙΚΟ GATE της βιβλιοθήκης block, σε ΕΝΑ σημείο.
 *
 * Δύο ΔΙΑΦΟΡΕΤΙΚΕΣ διαδρομές οδηγούν ένα block σε κοινόχρηστο scope:
 *  - `saveBlock({ scope: 'company' | 'project' })` — αποθήκευση κατευθείαν κοινόχρηστη,
 *  - `promoteBlock({ scope: 'company' | 'project' })` — προαγωγή ιδιωτικού (M3).
 *
 * Και οι δύο ΠΡΕΠΕΙ να περνούν τον ΙΔΙΟ έλεγχο — αλλιώς η δεύτερη διαδρομή γίνεται η
 * πίσω πόρτα του gate. Γι' αυτό ο έλεγχος ζει εδώ, pure και testable, και ΚΑΝΕΝΑΣ
 * caller δεν τον ξαναγράφει (N.18: όχι δεύτερος έλεγχος copy-paste).
 *
 * Κανόνες:
 *  1. Κοινόχρηστο scope (≠ `user`) ⇒ `license.redistributable === true`.
 *     Ό,τι ήρθε από ξένο DXF είναι by default `unknown`/`false` → μένει ιδιωτικό.
 *  2. `project` scope ⇒ πρέπει να υπάρχει ενεργό έργο.
 *  3. `system` scope ⇒ ΠΟΤΕ από client (seed-only, Admin SDK).
 *
 * @see ../services/BlockLibraryService.ts — ο μοναδικός καταναλωτής (save + promote)
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md §Νομική ασφάλεια
 */

import {
  BLOCK_LIBRARY_ERRORS,
  type BlockLibraryScope,
  type BlockLicense,
} from './block-library-types';

/** Κοινόχρηστο scope = ορατό σε άλλους → απαιτεί ρητό δικαίωμα αναδιανομής. */
export function isSharedBlockScope(scope: BlockLibraryScope): boolean {
  return scope !== 'user';
}

export interface BlockScopeGuardInput {
  readonly scope: BlockLibraryScope;
  /** Η άδεια που θα ισχύει ΜΕΤΑ την ενέργεια (νέα ή αποθηκευμένη). */
  readonly license: BlockLicense;
  /** Υπάρχει ενεργό έργο; (απαιτείται για `project` scope) */
  readonly hasProjectId: boolean;
}

/**
 * Πετάει το αντίστοιχο {@link BLOCK_LIBRARY_ERRORS} code αν το block ΔΕΝ επιτρέπεται να
 * ζήσει στο ζητούμενο scope. Σιωπηλή επιστροφή = επιτρέπεται.
 */
export function assertBlockScopeAllowed(input: BlockScopeGuardInput): void {
  // Belt-and-suspenders: οι τύποι το αποκλείουν, ένα unsafe cast όχι.
  if ((input.scope as string) === 'system') {
    throw new Error(BLOCK_LIBRARY_ERRORS.SYSTEM_SCOPE_CLIENT_FORBIDDEN);
  }
  if (input.scope === 'project' && !input.hasProjectId) {
    throw new Error(BLOCK_LIBRARY_ERRORS.PROJECT_SCOPE_REQUIRES_PROJECT_ID);
  }
  // ⚖️ Το gate: δεν μοιράζεσαι περιεχόμενο που δεν έχεις δικαίωμα να αναδιανείμεις.
  if (isSharedBlockScope(input.scope) && !input.license.redistributable) {
    throw new Error(BLOCK_LIBRARY_ERRORS.SHARED_SCOPE_REQUIRES_REDISTRIBUTABLE);
  }
}

/**
 * Ίδιος κανόνας, ΧΩΡΙΣ throw — για το UI: «μπορώ να πατήσω Δημοσίευση;». Το κουμπί
 * μένει ενεργό (ο χρήστης πρέπει να ΔΕΙ τον νομικό λόγο), αλλά η φόρμα ξέρει από πριν
 * αν η τρέχουσα άδεια αρκεί.
 */
export function canPromoteToSharedScope(license: BlockLicense): boolean {
  return license.redistributable === true;
}
