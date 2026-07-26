/**
 * ADR-711 — Keyboard scope SSoT: «ποιος κατέχει το πληκτρολόγιο αυτή τη στιγμή;»
 *
 * Framework-free επίτηδες: το εισάγουν και τα κοινά `src/components/ui/**` (Radix
 * dialogs) και το `src/subapps/dxf-viewer/**` (global accelerators). Καμία εξάρτηση
 * από React, κανένα import κύκλου.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-364 §10.15, μετρημένα ελαττώματα Ε1/Ε4) ──
 *
 * Οι window-level keydown listeners του viewer ρωτούσαν **μία** ερώτηση — «γράφει ο
 * χρήστης σε πεδίο;» — και καμία δεύτερη. Μέσα σε modal το focus κάθεται σε `<button>`,
 * άρα ο φύλακας δεν έπιανε: το `use3DShortcuts` κατανάλωνε το `Tab` με
 * `preventDefault + stopPropagation` (⇒ η πλοήγηση με πληκτρολόγιο μέσα σε κάθε dialog
 * ήταν νεκρή, παραβίαση WAI-ARIA APG) και το `useKeyboardShortcuts` μετακινούσε το
 * viewport ±80px με τα βέλη πίσω από το ανοιχτό lightbox.
 *
 * ── ΓΙΑΤΙ ΟΧΙ `inert` ──
 *
 * Το `inert` αφαιρεί focusability / hit-testing **του υποδέντρου**. ΔΕΝ σταματά
 * listeners σε `window` / `document`: το dialog ζει σε portal **εκτός** του inert
 * υποδέντρου, άρα το keydown φτάνει άθικτο στο window capture. Μετρημένο ως
 * αδιέξοδο πριν γραφτεί αυτό το αρχείο — μην το ξαναδοκιμάσεις.
 *
 * ── ΤΟ ΣΧΗΜΑ ──
 *
 * Scope stack, όπως το λύνει ο κλάδος (TanStack Hotkeys, react-hotkeys-hook
 * `HotkeysProvider`, Revit/AutoCAD modal command state): ένα βάθος που αυξάνεται όσο
 * ζει ένα modal layer, και ΕΝΑ predicate που ρωτούν οι global handlers. Καμία νέα
 * εξάρτηση (N.5 δεν ενεργοποιείται).
 *
 * @see src/lib/a11y/use-modal-keyboard-scope.ts — το React binding
 * @see src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts — ο δομικός φύλακας
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. «Γράφει ο χρήστης;» — Η ΜΙΑ υλοποίηση
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ασφαλής μετατροπή σε `Element` χωρίς cast — SSR-safe (στον server δεν υπάρχει
 * `Element`, οπότε ο έλεγχος `typeof` προηγείται του `instanceof`).
 */
function asElement(target: EventTarget | Element | null | undefined): Element | null {
  if (target === null || target === undefined) return null;
  if (typeof Element === 'undefined') return null;
  return target instanceof Element ? target : null;
}

/**
 * `true` όταν ο στόχος είναι πεδίο κειμένου — INPUT / TEXTAREA / contenteditable.
 *
 * Ο SSoT των **έξι** αντιγράφων που υπήρχαν πριν το ADR-711 (`isTypingInFormField`,
 * `isEditableFocus`, `isInputFocused`, και τρία inline). Είναι **γνήσιο υπερσύνολο**
 * όλων τους: χρησιμοποιεί `isContentEditable`, που πιάνει και το `contenteditable=""`
 * και το **κληρονομημένο** contenteditable — περιπτώσεις που και οι έξι έχαναν.
 */
export function isEditableTarget(target: EventTarget | Element | null | undefined): boolean {
  const el = asElement(target);
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  // Κληρονομημένο contenteditable (παιδί επεξεργάσιμης περιοχής). ⚠️ Το jsdom ΔΕΝ
  // υλοποιεί το `isContentEditable` — επιστρέφει πάντα `false`. Άρα αυτή η γραμμή
  // είναι ζωντανή μόνο σε πραγματικό browser και ΔΕΝ καλύπτεται από jest.
  if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  // Κατά προδιαγραφή HTML, `contenteditable=""` σημαίνει `true`. Και τα έξι
  // προηγούμενα αντίγραφα σύγκριναν μόνο με τη συμβολοσειρά 'true' και το έχαναν.
  const attr = el.getAttribute('contenteditable');
  return attr === 'true' || attr === '';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. «Κατέχει modal το πληκτρολόγιο;» — ο σωρός
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Βάθος, όχι boolean: ένα dialog μπορεί να ανοίξει ConfirmDialog από πάνω του, και το
 * κλείσιμο του δεύτερου ΔΕΝ πρέπει να ξεκλειδώνει τους global accelerators όσο ζει το
 * πρώτο. Ο μόνος γραφέας είναι το {@link pushModalKeyboardScope}.
 */
let modalScopeDepth = 0;

/**
 * Δηλώνει ότι ένα modal layer κατέχει από τώρα το πληκτρολόγιο.
 *
 * @returns συνάρτηση αποδέσμευσης. **Ιδempotent** — δεύτερη κλήση είναι no-op, ώστε
 * το διπλό effect του React StrictMode να μην αφήνει το βάθος αρνητικό.
 */
export function pushModalKeyboardScope(): () => void {
  modalScopeDepth += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    modalScopeDepth = Math.max(0, modalScopeDepth - 1);
  };
}

/** `true` όσο έστω ένα modal layer είναι ανοιχτό. */
export function isModalKeyboardScopeActive(): boolean {
  return modalScopeDepth > 0;
}

/** Dev/test παρατηρητής — το ισοδύναμο του `escapeBus.inspect()` για το scope. */
export function inspectModalKeyboardScope(): { readonly depth: number } {
  return { depth: modalScopeDepth };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Η ΜΙΑ ερώτηση που κάνουν οι global accelerators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `true` όταν ένας **global** (window-level) accelerator ΔΕΝ επιτρέπεται να δράσει.
 *
 * Belt-and-suspenders (N.7.2 #4), δύο ανεξάρτητα μονοπάτια:
 *  1. **Πρωτεύον** — ενεργό modal scope· O(1) ανάγνωση, ισχύει ό,τι κι αν κρατά το focus.
 *  2. **Δίχτυ** — ο στόχος ή το `activeElement` είναι πεδίο κειμένου· καλύπτει και τα
 *     layers που δεν περνούν από τα κοινά `ui/` primitives.
 *
 * ⚠️ **ΔΕΝ το καλεί ο Escape bus.** Ο bus οφείλει να δουλεύει ΜΕΣΑ στα modals — εκεί
 * ζει το slot `ESC_PRIORITY.MODAL_DIALOG` (ADR-364). Ο bus καταναλώνει μόνο το
 * {@link isEditableTarget}.
 */
export function shouldGlobalShortcutYield(event: Pick<KeyboardEvent, 'target'>): boolean {
  if (isModalKeyboardScopeActive()) return true;
  if (isEditableTarget(event.target)) return true;
  if (typeof document === 'undefined') return false;
  return isEditableTarget(document.activeElement);
}

/** Test-only — μηδενισμός του σωρού μεταξύ tests. Ο κώδικας παραγωγής ΔΕΝ το καλεί. */
export function __resetModalKeyboardScopeForTests(): void {
  modalScopeDepth = 0;
}
