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
// 1. ΟΙ ΤΡΕΙΣ ΕΡΩΤΗΣΕΙΣ — μία υλοποίηση η καθεμία, ονομασμένες
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
//
// ⚠️ ADR-724 §5.2 (2026-07-28) — **ΤΡΙΤΗ ερώτηση**, από την ίδια ακριβώς ρίζα.
//
//   3. «Θα καταναλώσει το **πλήκτρο πλοήγησης**;»  → `role=separator`: **ΝΑΙ**
//
// Το σχόλιο του {@link TYPEAHEAD_ROLES} («τι εξαιρείται επίτηδες») είχε **ήδη**
// αναγνωρίσει τον πληθυσμό — `slider`, `radio`, `tab`, `grid` πλοηγούνται με βέλη —
// αλλά δεν υπήρχε ερώτηση να τον στεγάσει, οπότε έμεινε ως προειδοποίηση. Η τρίτη
// ερώτηση **είναι** αυτή η στέγη· δεν είναι νέα ιδέα, είναι η ολοκλήρωση της §5.6.
//
// ── ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (ADR-724 Φ1, ζωντανά, 3.107 οντότητες) ──
//
// Με το `document.activeElement` επιβεβαιωμένα στο `DIV[role=separator]` του χώρου
// εργασίας και 3× `ArrowLeft`: το πλάτος της παλέτας έμεινε **670 → 670** (καμία
// αλλαγή) και το `offsetX` του καμβά πήγε **3883 → 4123** — δηλαδή τα βέλη
// **πάναραν το σχέδιο** ~80px/πάτημα αντί να ρυθμίσουν την παλέτα.
//
// Αιτία, επαληθευμένη στο ίδιο το bundle (`react-resizable-panels@4.7.2`, ο handler
// `Te`): ο listener του splitter είναι **element-level, φάση bubble**, και ξεκινά με
// `if (e.defaultPrevented) return;`. Ο global accelerator του viewer τρέχει σε
// **window capture** — δηλαδή **πρώτος** — έκανε το pan και `preventDefault()`, οπότε
// όταν το συμβάν έφτανε στο splitter είχε ήδη «καταναλωθεί». Ο χρήστης νόμιζε ότι
// ρυθμίζει την παλέτα και του έφευγε το σχέδιο.
//
// ⛔ Η διόρθωση **δεν** είναι δεύτερος μηχανισμός ιδιοκτησίας πλήκτρων μέσα στο
// subapp, ούτε `stopPropagation` στο διαχωριστικό: ο global accelerator οφείλει να
// **παραιτείται**, όπως ήδη παραιτείται μπροστά σε πεδίο κειμένου. Ίδιο σχήμα, τρίτη
// ερώτηση.
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
 *
 * 📌 ADR-724: αυτοί **δεν** χάθηκαν — μετακόμισαν στην ερώτηση 3
 * ({@link ARROW_NAVIGATION_ROLES}), όπου ανήκαν εξαρχής. Η εξαίρεση εδώ παραμένει σωστή:
 * ένας global accelerator που κλέβει **γράμμα** επιτρέπεται να τρέξει με focus σε slider.
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

/**
 * ADR-724 §5.2 — ΡΟΛΟΙ ΠΟΥ ΚΑΤΑΝΑΛΩΝΟΥΝ **ΠΛΗΚΤΡΑ ΠΛΟΗΓΗΣΗΣ** (βέλη / Home / End / Page*).
 *
 * Συμπλήρωμα του {@link TYPEAHEAD_ROLES}, όχι αντικαταστάτης: η ερώτηση 3 είναι η ένωση
 * των δύο συνόλων (δες {@link consumesDirectionalKeys}). Ένα `<input>` καταναλώνει **και**
 * χαρακτήρες **και** βέλη (κέρσορας)· ένας `slider` **μόνο** βέλη.
 *
 * ── ΚΡΙΤΗΡΙΟ ΕΙΣΟΔΟΥ ──
 *
 * Ο ρόλος μπαίνει μόνο αν (α) κατά WAI-ARIA APG τα βέλη είναι η **κύρια** αλληλεπίδρασή
 * του **και** (β) στην πράξη γίνεται `document.activeElement` / `event.target`. Το (β)
 * είναι που κρατά τη λίστα ειλικρινή: ένας ρόλος που δεν παίρνει ποτέ focus θα ήταν
 * **νεκρή εγγραφή** που δίνει ψεύτικη αίσθηση κάλυψης.
 *
 * ── ΓΙΑΤΙ ΤΟ `toolbar` ΔΕΝ ΕΙΝΑΙ ΕΔΩ (μετρημένο, όχι παράλειψη) ──
 *
 * Κατά APG το toolbar έχει **roving tabindex**: το focus κάθεται στο *κουμπί* μέσα του,
 * ποτέ στο ίδιο το toolbar. Και οι **12** `role="toolbar"` του repo είναι `<nav>` χωρίς
 * `tabIndex`. Θα ήταν εγγραφή που δεν πυροδοτείται ποτέ.
 *
 * ── ΓΙΑΤΙ ΤΟ ΔΙΑΚΟΣΜΗΤΙΚΟ `separator` ΕΙΝΑΙ ΑΒΛΑΒΕΣ ──
 *
 * Τα `role="separator"` χωρίς `tabIndex` (διαχωριστικές γραμμές μενού — `PenTablePanel`,
 * `GanttPortals`, `PickerResultsList`) **δεν** μπαίνουν ποτέ στη σειρά εστίασης, άρα δεν
 * γίνονται ούτε `activeElement` ούτε στόχος `keydown`. Μόνο το **focusable** splitter
 * (ADR-724) φτάνει εδώ — ακριβώς αυτό που θέλουμε.
 */
const ARROW_NAVIGATION_ROLES: ReadonlySet<string> = new Set([
  // Window splitter (ADR-724) — ArrowLeft/Right/Up/Down + Home/End αλλάζουν το πλάτος.
  'separator',
  // APG: βέλη = η ΜΟΝΗ αλληλεπίδρασή τους.
  'slider', 'scrollbar',
  // Composite widgets με roving tabindex — και τα δύο επίπεδα, ίδιο σκεπτικό με τους
  // item-level ρόλους του TYPEAHEAD_ROLES (το focus μπορεί να κάθεται σε οποιοδήποτε).
  'radio', 'radiogroup',
  'tab', 'tablist',
  'grid', 'gridcell', 'row', 'columnheader', 'rowheader',
]);

/**
 * ADR-724 §5.2 — Τα πλήκτρα που η ερώτηση 3 αφορά.
 *
 * `PageUp`/`PageDown` περιλαμβάνονται: κατά APG τα καταναλώνουν `slider` και `grid`, και
 * το ίδιο το `react-resizable-panels` τα προωθεί στον splitter. Το `Tab` **δεν** είναι
 * εδώ — είναι πλοήγηση εστίασης του browser, όχι πλήκτρο widget, και κανένας global
 * accelerator δεν επιτρέπεται να το διεκδικεί (ADR-711, ελάττωμα Ε1).
 */
const DIRECTIONAL_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
]);

/** `true` όταν το πλήκτρο είναι πλοηγικό — δες {@link DIRECTIONAL_KEYS}. */
export function isDirectionalKey(key: string): boolean {
  return DIRECTIONAL_KEYS.has(key);
}

/**
 * ΕΡΩΤΗΣΗ 3 — «**θα καταναλώσει αυτό το element το πλήκτρο πλοήγησης** που πάω να
 * κλέψω;» Γνήσιο υπερσύνολο της ερώτησης 2.
 *
 * = ό,τι καταναλώνει χαρακτήρες **+** APG widget που πλοηγείται με βέλη
 * ({@link ARROW_NAVIGATION_ROLES}).
 *
 * ⚠️ Ρωτιέται **μόνο** για πλοηγικά πλήκτρα ({@link isDirectionalKey}). Αν ρωτιόταν για
 * κάθε πλήκτρο, ένα `role="tab"` με εστίαση θα σκότωνε και τους accelerators γραμμάτων —
 * ακριβώς η παλινδρόμηση που προειδοποιεί το {@link TYPEAHEAD_ROLES}.
 *
 * Καταναλωτής: {@link shouldGlobalShortcutYield}.
 */
export function consumesDirectionalKeys(
  target: EventTarget | Element | null | undefined,
): boolean {
  const el = asElement(target);
  if (!el) return false;
  if (ARROW_NAVIGATION_ROLES.has(roleOf(el))) return true;
  return consumesTypedCharacters(el);
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
 *
 * ── ADR-724 §5.2: Η ΕΡΩΤΗΣΗ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΟ ΠΛΗΚΤΡΟ ──
 *
 * Ένας accelerator που κλέβει **γράμμα** και ένας που κλέβει **βέλος** δεν ανταγωνίζονται
 * τους ίδιους ιδιοκτήτες. Γι' αυτό το πλήκτρο επιλέγει την ερώτηση: πλοηγικό ⇒ ερώτηση 3
 * ({@link consumesDirectionalKeys})· οτιδήποτε άλλο ⇒ ερώτηση 2. Ένα ενιαίο, πιο πλατύ
 * predicate θα σκότωνε τους accelerators γραμμάτων με εστίαση σε slider/tab· ένα πιο στενό
 * αφήνει τα βέλη να δραπετεύσουν στον καμβά (το μετρημένο ελάττωμα του ADR-724).
 */
export function shouldGlobalShortcutYield(
  event: Pick<KeyboardEvent, 'target' | 'key'>,
): boolean {
  if (isModalKeyboardScopeActive()) return true;
  if (isDirectionalKey(event.key)) {
    return consumesDirectionalKeys(event.target) || focusConsumesDirectionalKeys();
  }
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

/**
 * Ερώτηση 3 πάνω στο τρέχον focus. Δες {@link consumesDirectionalKeys}.
 *
 * Το **δίχτυ** του {@link shouldGlobalShortcutYield} για τα πλοηγικά πλήκτρα: όταν ο
 * splitter έχει την εστίαση αλλά το `keydown` αναφέρει άλλον στόχο (π.χ. έχει ήδη
 * αναδυθεί στο `window`), η ιδιοκτησία διαβάζεται από το `document.activeElement`.
 */
export function focusConsumesDirectionalKeys(): boolean {
  return consumesDirectionalKeys(activeElementOrNull());
}

/** Test-only — μηδενισμός του σωρού μεταξύ tests. Ο κώδικας παραγωγής ΔΕΝ το καλεί. */
export function __resetModalKeyboardScopeForTests(): void {
  modalScopeDepth = 0;
}
