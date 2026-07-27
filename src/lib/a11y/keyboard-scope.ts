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
 * ζει ένα modal layer, και **δύο ονομασμένα** predicates που ρωτούν οι handlers — ένα
 * ανά ερώτηση (§1). Καμία νέα εξάρτηση (N.5 δεν ενεργοποιείται).
 *
 * ── ΠΟΥ ΠΑΕΙ ΤΕΛΙΚΑ ΤΟ ΣΧΗΜΑ (καταγραφή, ΟΧΙ εκκρεμότητα) ──
 *
 * Το VS Code **δεν** εξετάζει καθόλου το DOM: κάθε widget **δηλώνει** το context του
 * (`inputFocus`, `textInputFocus`, `listFocus`, `suggestWidgetVisible`) και τα keybindings
 * γράφουν `when: !inputFocus`. Είναι αυστηρότερο από κάθε DOM sniffing — ο συγγραφέας του
 * widget ξέρει τι καταναλώνει, ο φύλακας δεν το μαντεύει. Εδώ παραμένουμε στο DOM γιατί ο
 * viewer έχει **43** window-level listeners που δεν δηλώνουν context· η μετάβαση σε
 * declarative contexts είναι άλλης τάξης εργασία. Τα δύο predicates είναι η σωστή
 * **ενδιάμεση** στάση, όχι το τέρμα.
 *
 * @see src/lib/a11y/use-modal-keyboard-scope.ts — το React binding
 * @see src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts — ο δομικός φύλακας
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. ΟΙ ΔΥΟ ΕΡΩΤΗΣΕΙΣ — μία υλοποίηση η καθεμία, ονομασμένες
//
// ⚠️ Μέχρι το ADR-711 §5.6 (2026-07-27) εδώ ζούσε **ένα** predicate ονόματι
// `isEditableTarget`, και ένα δεύτερο με το **ίδιο όνομα** και **άλλο σώμα** στο
// `radial-command-ring-helpers.ts`. Δεν ήταν αντίγραφα: απαντούσαν σε δύο
// διαφορετικές ερωτήσεις που η λέξη «editable» συγχέει —
//
//   1. «Γράφει ο χρήστης κείμενο;»            → `<select>`: **ΟΧΙ**  (Escape = άκυρο πεδίο)
//   2. «Θα καταναλώσει τον χαρακτήρα;»        → `<select>`: **ΝΑΙ**  (type-ahead)
//
// Γι' αυτό και οι δύο μονόπλευρες «διορθώσεις» έσπαγαν κάτι: προσθήκη `SELECT` στο
// ένα σκότωνε το Escape των dialogs· αφαίρεσή του από το άλλο σκότωνε το type-ahead.
// Η λύση δεν ήταν να νικήσει το ένα — ήταν να **ονομαστούν και τα δύο**.
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
 * ADR-711 §5.6 — ΡΟΛΟΙ ΠΟΥ ΣΗΜΑΙΝΟΥΝ «ΠΕΔΙΟ ΚΕΙΜΕΝΟΥ» χωρίς να είναι INPUT/TEXTAREA.
 *
 * Ένα `<div role="textbox">` **είναι** πεδίο κειμένου: το `Escape` εκεί σημαίνει «άκυρο
 * πεδίο». Στην πράξη τα περισσότερα είναι και contentEditable (άρα πιάνονταν ήδη), αλλά
 * ο ρόλος είναι η **δηλωμένη** πρόθεση του συγγραφέα και δεν κοστίζει.
 * Ίδιο λεξιλόγιο με το `FORM_TAGS_AND_ROLES` του react-hotkeys-hook.
 */
const TEXT_ENTRY_ROLES: ReadonlySet<string> = new Set(['textbox', 'searchbox']);

/**
 * ADR-711 §5.6 — ΡΟΛΟΙ ΠΟΥ ΚΑΤΑΝΑΛΩΝΟΥΝ ΕΚΤΥΠΩΣΙΜΟ ΧΑΡΑΚΤΗΡΑ (type-ahead).
 *
 * ── ΓΙΑΤΙ ΡΟΛΟΙ ΚΑΙ ΟΧΙ `tagName` ──
 *
 * Το canonical dropdown της εφαρμογής (ADR-001, `@/components/ui/select`, **237 αρχεία**)
 * είναι Radix: το trigger του αποδίδεται ως `<button role="combobox">`, **ΟΧΙ** ως
 * `<select>`. Έλεγχος `tagName === 'SELECT'` πιάνει μόνο τα **47** legacy native και είναι
 * τυφλός σε ό,τι χρησιμοποιεί η εφαρμογή παντού. Με ρόλους πιάνεται και κάθε μελλοντικό
 * primitive **χωρίς νέο άγγιγμα**.
 *
 * ── ΓΙΑΤΙ ΚΑΙ ΟΙ ITEM-LEVEL ΡΟΛΟΙ (`option`, `menuitem*`, `treeitem`) ──
 *
 * Μετρημένο στο Radix Select 2.2.6: όσο είναι **ανοιχτό**, το focus κάθεται στο
 * `role="option"` (`tabIndex=-1`, `selectedItem.focus()`), ενώ ο type-ahead handler ζει
 * στον **πρόγονο** `role="listbox"`. Έλεγχος μόνο του widget ρόλου θα έχανε το ανοιχτό
 * dropdown. Οι item ρόλοι είναι απαριθμήσιμοι, άρα O(1) — **χωρίς** `closest()` walk σε
 * μονοπάτι που τρέχει σε κάθε keydown. Ίδια επιλογή με το react-hotkeys-hook.
 *
 * ── ΤΙ ΕΞΑΙΡΕΙΤΑΙ ΕΠΙΤΗΔΕΣ ──
 *
 * `slider`, `radio`, `radiogroup`, `tab`, `tablist`, `grid` — κατά WAI-ARIA APG πλοηγούνται
 * με **βέλη**, ΟΧΙ με εκτυπώσιμο χαρακτήρα. Αν μπουν εδώ, οι global accelerators του viewer
 * πεθαίνουν με focus πάνω τους — παλινδρόμηση, όχι διόρθωση. (Το react-hotkeys-hook
 * περιλαμβάνει `slider`/`radio`· εδώ **δεν** το ακολουθούμε, γιατί εκείνο απαντά «είναι
 * πεδίο φόρμας;» και εμείς «θα καταναλώσει τον χαρακτήρα;».)
 */
const TYPEAHEAD_ROLES: ReadonlySet<string> = new Set([
  // Widget-level — APG: type-ahead συνιστάται ρητά για listbox/combobox/tree/menu.
  'combobox', 'listbox', 'menu', 'menubar', 'tree',
  // Item-level — το `document.activeElement` / `event.target` όσο το widget είναι ανοιχτό.
  'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem',
  // Δέχεται ψηφία απευθείας (το `<input type="number">` πιάνεται ήδη ως INPUT).
  'spinbutton',
]);

function roleOf(el: Element): string {
  // `getAttribute` και ΟΧΙ το IDL `el.role`: το δεύτερο αντανακλά μόνο το **attribute**
  // (ίδια τιμή), αλλά δεν το υλοποιεί το jsdom σε όλες τις εκδόσεις — άρα τα tests θα
  // έλεγαν σιωπηλά `null`. Το implicit role (π.χ. `<select>`) δεν φαίνεται σε καμία από
  // τις δύο· γι' αυτό ο έλεγχος tagName παραμένει **δίπλα** στον έλεγχο ρόλου.
  return el.getAttribute('role') ?? '';
}

function isContentEditableEl(el: Element): boolean {
  // Κληρονομημένο contenteditable (παιδί επεξεργάσιμης περιοχής). ⚠️ Το jsdom ΔΕΝ
  // υλοποιεί το `isContentEditable` — επιστρέφει πάντα `false`. Άρα αυτή η γραμμή
  // είναι ζωντανή μόνο σε πραγματικό browser και ΔΕΝ καλύπτεται από jest.
  if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  // Κατά προδιαγραφή HTML, `contenteditable=""` σημαίνει `true`. Και τα δέκα
  // προηγούμενα αντίγραφα σύγκριναν μόνο με τη συμβολοσειρά 'true' και το έχαναν.
  const attr = el.getAttribute('contenteditable');
  return attr === 'true' || attr === '';
}

/**
 * ΕΡΩΤΗΣΗ 1 — «**γράφει ο χρήστης κείμενο**, ώστε το `Escape` να σημαίνει *άκυρο πεδίο*
 * και όχι *κλείσε το layer*;»
 *
 * INPUT / TEXTAREA / contentEditable / `role=textbox|searchbox`.
 *
 * Καταναλωτές: `EscapeCommandBus` (ADR-364), `useDimensionKeyboardRouting`.
 *
 * ⚠️ **ΔΕΝ περιλαμβάνει `SELECT` / combobox — επίτηδες.** Ένα κλειστό `<select>` **δεν**
 * κατέχει το `Escape`, και ένα ανοιχτό το κλείνει μόνο του. Αν μπει εδώ, το `Escape` με
 * focus σε dropdown **μέσα σε dialog** παύει να κλείνει τον dialog (ADR-364). Η ερώτηση
 * «θα καταναλώσει τον χαρακτήρα;» είναι **άλλη** — δες {@link consumesTypedCharacters}.
 *
 * @see ADR-711 §5.6 — γιατί ένα predicate δεν μπορούσε να απαντήσει σε δύο ερωτήσεις
 */
export function isTextEntryTarget(target: EventTarget | Element | null | undefined): boolean {
  const el = asElement(target);
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  if (TEXT_ENTRY_ROLES.has(roleOf(el))) return true;
  return isContentEditableEl(el);
}

/**
 * ΕΡΩΤΗΣΗ 2 — «**θα καταναλώσει αυτό το element τον εκτυπώσιμο χαρακτήρα** που πάω να
 * κλέψω;» Γνήσιο υπερσύνολο της ερώτησης 1.
 *
 * = πεδίο κειμένου **+** native `<select>` **+** APG composite widget με type-ahead.
 *
 * Καταναλωτές: {@link shouldGlobalShortcutYield} (⇒ όλοι οι global accelerators του viewer
 * μέσω `addGlobalShortcutListener`), `RadialCommandRing` (ADR-513 direct distance entry).
 *
 * ── ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (2026-07-27, ζωντανά σε localhost) ──
 *
 * Με focus στο Radix Select «Μονάδα εμφάνισης μετρήσεων» (`<button role="combobox">`) και
 * πάτημα `m`: το `event.target` ήταν το trigger, το type-ahead του Radix **δεν έτρεξε**
 * (`cm` → `cm`), και η **γραμμή εντολών** άνοιξε με `"M"` (`useKeyboardShortcuts.ts` →
 * `CommandLineStore.show`, με `preventDefault`). Αιτία: ο φύλακας ρωτούσε την ερώτηση 1,
 * όπου `<button role="combobox">` είναι `false`.
 *
 * 📌 Το δαχτυλίδι είχε το **ίδιο** κενό αλλά ήταν **καλυμμένο**: η γραμμή εντολών άρπαζε
 * πρώτη το focus, οπότε ο (τυφλός) έλεγχός του πάνω στο `document.activeElement` έβλεπε
 * το `<input>` της γραμμής και επέστρεφε τυχαία `true`. Άρα η διόρθωση **μόνο** του
 * `shouldGlobalShortcutYield` θα **αποκάλυπτε** το σφάλμα του δαχτυλιδιού αντί να το
 * λύσει — γι' αυτό και οι δύο καταναλωτές αλλάζουν στο **ίδιο** commit.
 */
export function consumesTypedCharacters(
  target: EventTarget | Element | null | undefined,
): boolean {
  const el = asElement(target);
  if (!el) return false;
  // Native `<select>`: type-ahead του browser. Δεν έχει `role` attribute, άρα ο έλεγχος
  // tagName είναι ο ΜΟΝΟΣ τρόπος να φανεί. Τα 47 legacy native του repo ζουν εδώ.
  if (el.tagName === 'SELECT') return true;
  if (TYPEAHEAD_ROLES.has(roleOf(el))) return true;
  return isTextEntryTarget(el);
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
 *  2. **Δίχτυ** — ο στόχος ή το `activeElement` καταναλώνει τον χαρακτήρα· καλύπτει και τα
 *     layers που δεν περνούν από τα κοινά `ui/` primitives.
 *
 * ⚠️ Ρωτά την **ερώτηση 2** ({@link consumesTypedCharacters}), ΟΧΙ την 1. Ένας global
 * accelerator κλέβει έναν χαρακτήρα· άρα το κριτήριο είναι «θα τον καταναλώσει κάποιος
 * άλλος;», όχι «γράφει κείμενο ο χρήστης;». Αυτό ήταν το **ανοιχτό ερώτημα** του ADR-711
 * §5.6 και έκλεισε με μέτρηση, όχι με υπόθεση: δες το ελάττωμα στο
 * {@link consumesTypedCharacters}.
 *
 * ⚠️ **ΔΕΝ το καλεί ο Escape bus.** Ο bus οφείλει να δουλεύει ΜΕΣΑ στα modals — εκεί
 * ζει το slot `ESC_PRIORITY.MODAL_DIALOG` (ADR-364). Ο bus καταναλώνει μόνο το
 * {@link isTextEntryTarget}: το `Escape` **δεν** είναι εκτυπώσιμος χαρακτήρας, άρα η
 * ερώτηση 2 δεν τον αφορά.
 */
export function shouldGlobalShortcutYield(event: Pick<KeyboardEvent, 'target'>): boolean {
  if (isModalKeyboardScopeActive()) return true;
  if (consumesTypedCharacters(event.target)) return true;
  return focusConsumesTypedCharacters();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Οι ΔΥΟ ερωτήσεις πάνω στο `document.activeElement` — SSR-safe, μία φορά
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ADR-711 §5.6 — γιατί υπάρχουν αυτά τα δύο.
 *
 * Το σχήμα `predicate(document.activeElement)` ήταν γραμμένο σε **πέντε** σημεία
 * (`EscapeCommandBus`, `useDimensionKeyboardRouting`, `RadialCommandRing`,
 * `shouldGlobalShortcutYield`, `use-polygon-clipboard-shortcuts`) με **τρεις** διαφορετικούς
 * SSR φύλακες: `isBrowser()`, `typeof document === 'undefined'`, και σε ένα σημείο
 * **κανέναν**. Δεύτερο, μικρότερο, σιωπηλότερο διπλότυπο μέσα στο ίδιο πρόβλημα.
 */
function activeElementOrNull(): Element | null {
  if (typeof document === 'undefined') return null;
  return document.activeElement;
}

/** Ερώτηση 1 πάνω στο τρέχον focus. Δες {@link isTextEntryTarget}. */
export function isTextEntryFocused(): boolean {
  return isTextEntryTarget(activeElementOrNull());
}

/** Ερώτηση 2 πάνω στο τρέχον focus. Δες {@link consumesTypedCharacters}. */
export function focusConsumesTypedCharacters(): boolean {
  return consumesTypedCharacters(activeElementOrNull());
}

/** Test-only — μηδενισμός του σωρού μεταξύ tests. Ο κώδικας παραγωγής ΔΕΝ το καλεί. */
export function __resetModalKeyboardScopeForTests(): void {
  modalScopeDepth = 0;
}
