/**
 * ADR-711 / ADR-364 §10.15 — Ο δομικός φύλακας των global accelerators του viewer.
 *
 * ── ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ ──
 *
 * Ο viewer έχει **43** window-level keydown listeners. Ο καθένας τους έγραφε μόνος του
 * έναν φύλακα «γράφει ο χρήστης σε πεδίο;» — έξι διαφορετικά αντίγραφα, τέσσερα
 * ονόματα — και **κανένας** δεν ρωτούσε «κατέχει modal το πληκτρολόγιο;». Αποτέλεσμα
 * (μετρημένο): το `Tab` πέθαινε μέσα σε κάθε dialog του viewer και τα βέλη μετακινούσαν
 * το viewport ±80px πίσω από ανοιχτό lightbox.
 *
 * Η προφανής διόρθωση — «βάλε τον έλεγχο και στα 43» — σαπίζει στον 44ο listener.
 * Εδώ ο φύλακας είναι **δομικός**: χρησιμοποιείς τον wrapper, τον παίρνεις δωρεάν.
 * Ίδιο σχήμα με τα scope stacks του κλάδου (TanStack Hotkeys, react-hotkeys-hook
 * `HotkeysProvider`) και με το modal command state των Revit / AutoCAD.
 *
 * ── ΠΟΙΟΣ **ΔΕΝ** ΤΟ ΧΡΗΣΙΜΟΠΟΙΕΙ (by design) ──
 *
 *  - `systems/escape-bus/**` — ο bus οφείλει να δουλεύει ΜΕΣΑ στα modals· εκεί ζει το
 *    slot `ESC_PRIORITY.MODAL_DIALOG` (ADR-364). Θα αυτοακυρωνόταν.
 *  - Listeners που ανήκουν σε input/overlay (Dynamic Input, Command Line, Radial ring):
 *    το πεδίο τους **είναι** ο ιδιοκτήτης του πλήκτρου· gate εκεί θα τους σκότωνε.
 *
 * @see src/lib/a11y/keyboard-scope.ts — το predicate SSoT
 */

import {
  isModalKeyboardScopeActive,
  shouldGlobalShortcutYield,
} from '@/lib/a11y/keyboard-scope';

export interface GlobalShortcutListenerOptions {
  /**
   * Φάση capture. Προεπιλογή `true` — οι accelerators του viewer ανταγωνίζονται
   * ιστορικά στη φάση capture του `window`.
   */
  readonly capture?: boolean;

  /**
   * Ο listener εξακολουθεί να τρέχει όταν το focus είναι σε πεδίο κειμένου —
   * **αλλά ΠΟΤΕ όταν modal κατέχει το πληκτρολόγιο**.
   *
   * Ίδιο λεξιλόγιο με το `EscapeHandler.allowWhenEditable` (ADR-364 §3.4), και για
   * τον ίδιο λόγο: υπάρχουν handlers που **κατέχουν** τον χρόνο πληκτρολόγησης.
   * Μετρημένο παράδειγμα: το `useDimensionKeyboardRouting` δέχεται `Enter` ενώ το
   * Dynamic Input έχει focus, κάνει blur για να δεσμευτεί η τιμή και μετά προωθεί.
   * Καθολικός φύλακας εκεί θα ήταν **παλινδρόμηση**, όχι διόρθωση.
   */
  readonly allowWhenEditable?: boolean;
}

/**
 * Εγκαθιστά window-level keydown listener που **παραιτείται** όταν το πληκτρολόγιο
 * ανήκει σε modal ή σε πεδίο κειμένου.
 *
 * @returns συνάρτηση αποδέσμευσης — επιστρέψτε την κατευθείαν από το `useEffect`.
 */
export function addGlobalShortcutListener(
  onKeyDown: (event: KeyboardEvent) => void,
  options: GlobalShortcutListenerOptions = {},
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const capture = options.capture ?? true;
  const yields = options.allowWhenEditable
    ? (): boolean => isModalKeyboardScopeActive()
    : shouldGlobalShortcutYield;

  const listener = (event: KeyboardEvent): void => {
    if (yields(event)) return;
    onKeyDown(event);
  };

  window.addEventListener('keydown', listener, { capture });
  return () => window.removeEventListener('keydown', listener, { capture });
}
