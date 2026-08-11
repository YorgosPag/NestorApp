'use client';

/**
 * 🔴 ADR-753 §28 — **ΟΙ ΤΡΕΙΣ ΠΡΑΞΕΙΣ ΠΟΥ ΚΑΝΟΥΝ ΕΝΑ ΠΕΔΙΟ «ΠΕΔΙΟ»**, για **και τα τρία**
 * πεδία της συνεδρίας: τη γραμμή τύπων (`input`), το ιστορικό `textarea`, και τον **πλούσιο**
 * επεξεργαστή κελιού (`contenteditable`).
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Ο επεξεργαστής κελιού έπρεπε να ζωγραφίζει **βαμμένα γράμματα** (§16.5), και το `textarea`
 * έχει εξ ορισμού **ένα** χρώμα και **μία** γραμματοσειρά. Η αντικατάστασή του όμως θα
 * ακύρωνε δώδεκα καταναλωτές που ρωτούν `field.value` / `field.selectionStart` /
 * `field.setSelectionRange(...)` — δηλαδή ολόκληρη τη μηχανική της συνεδρίας (πάγωμα
 * επιλογής, έλεγχος μπαγιάτικου, τοποθέτηση δρομέα, ανίχνευση αλλαγής).
 *
 * Η λύση **δεν** είναι δεύτερη μηχανική για το νέο πεδίο. Είναι ότι οι τρεις ερωτήσεις
 * απαντιούνται σε **έναν** τόπο, και οι δώδεκα καταναλωτές μένουν λέξη προς λέξη ίδιοι:
 *
 * ```
 *   «τι γράφει;»          → tableTextFieldValue
 *   «τι μάρκαρε;»         → tableTextFieldSelection
 *   «μάρκαρε ΑΥΤΟ»        → setTableTextFieldSelection
 *   «τι επιτρέπεται να    → flattenToSingleLine
 *    φτάσει στο μοντέλο;»
 * ```
 *
 * Η **τέταρτη** ήρθε εδώ από το `TableCellEditorOverlay.tsx` (N.7.1): είναι πράξη **πεδίου**,
 * όχι στοιχείου διεπαφής — και τη ρωτούν **δύο** πεδία, το κελί και η γραμμή τύπων. Όσο ζούσε
 * μέσα σε ένα component, ο δεύτερος καταναλωτής έπρεπε να εισάγει από ένα `.tsx` για να πάρει
 * μια καθαρή συνάρτηση συμβολοσειρών.
 *
 * Ένα `if (isRich)` σε καθέναν από τους δώδεκα θα ήταν δώδεκα ευκαιρίες να ξεχαστεί — και το
 * σύμπτωμα θα ήταν μορφοποίηση που βάφει λάθος γράμματα, σιωπηλά. Εδώ η διάκριση γίνεται
 * **τρεις** φορές, δίπλα-δίπλα, και ο επόμενος τη διαβάζει ολόκληρη.
 *
 * ## 🔴 Γιατί ο πλούσιος επεξεργαστής αναγνωρίζεται από **γνώρισμα** και όχι από `isContentEditable`
 * Το jsdom **δεν υλοποιεί** το `isContentEditable` — επιστρέφει πάντα `false` (τεκμηριωμένο
 * στο `keyboard-scope.ts`). Ένας έλεγχος πάνω του θα σήμαινε ότι κάθε jest test τρέχει τον
 * **λάθος** κλάδο, δηλαδή ότι η μηχανή που κρίνει τη μορφοποίηση δεν δοκιμάζεται ποτέ. Το
 * γνώρισμα το βλέπουν και οι δύο κόσμοι, με την ίδια απάντηση.
 *
 * ## 🔴 Το `Range` κάνει τη μετάφραση, ΟΧΙ δικός μας βρόχος πάνω σε κόμβους
 * «Πόσοι χαρακτήρες υπάρχουν πριν από αυτό το σημείο;» είναι ερώτηση που ο browser απαντά
 * ήδη: `range.selectNodeContents(root); range.setEnd(node, offset); range.toString().length`.
 * Ένας δικός μας βρόχος θα ήταν δεύτερη μηχανή που πρέπει να συμφωνεί με το `textContent`
 * στα όρια κάθε `span` — και τα όρια των span είναι **ακριβώς** εκεί όπου αλλάζει η
 * μορφοποίηση, δηλαδή εκεί όπου η απόκλιση θα ήταν αόρατη μέχρι να βάψει κανείς κάτι.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-text-field-ops
 * @see ui/table-cell-editor/table-text-selection.ts — ο πρώτος καταναλωτής (πάγωμα επιλογής)
 * @see ui/table-cell-editor/use-table-cell-caret.ts — ο δεύτερος (τοποθέτηση δρομέα)
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import type {
  TableRichTextField,
  TableTextField,
} from '../components/table-text-menu/table-text-toolbar-types';

/**
 * Το γνώρισμα που δηλώνει «είμαι ο **πλούσιος** επεξεργαστής κελιού».
 *
 * Ζει σε **έναν** ορισμό, ίδια αρχή με το `TABLE_CELL_SESSION_MARKER`: ένα αλφαριθμητικό
 * γραμμένο στο ένα αρχείο και διαβασμένο στο άλλο είναι διπλότυπο που κανένας μεταγλωττιστής
 * δεν ελέγχει — και μια ορθογραφική διαφορά εδώ δεν σπάει τίποτα ορατά: απλώς κάνει κάθε
 * ανάγνωση επιλογής να απαντά για **κενό** πεδίο.
 */
export const TABLE_CELL_RICH_MARKER = { 'data-table-rich-text': 'true' } as const;

const RICH_ATTRIBUTE = 'data-table-rich-text';

/** Είναι αυτό το πεδίο ο πλούσιος επεξεργαστής; */
export function isRichTableTextField(field: TableTextField): field is TableRichTextField {
  return field.getAttribute(RICH_ATTRIBUTE) === 'true';
}

/**
 * Είναι αυτό το **οποιοδήποτε** στοιχείο ένα από τα πεδία κειμένου της συνεδρίας;
 *
 * Χωριστά από το {@link isRichTableTextField} επειδή απαντά σε **άλλη** ερώτηση: εκείνο
 * διαλέγει κλάδο ανάμεσα σε πεδία που ήδη **ξέρουμε** ότι είναι πεδία· αυτό ρωτά για ό,τι
 * βρέθηκε να έχει την εστίαση, δηλαδή για `Element | null`.
 *
 * ⚠️ Ο έλεγχος του πλούσιου πεδίου γίνεται με το **γνώρισμα** και όχι με `instanceof
 * HTMLDivElement`: κάθε `div` της εφαρμογής θα περνούσε, και ένα κουμπί μενού που φέρει το
 * σημάδι της συνεδρίας θα διεκδικούσε κέρσορα που δεν έχει.
 */
export function isTableSessionTextField(el: Element | null): el is TableTextField {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return true;
  return el.getAttribute(RICH_ATTRIBUTE) === 'true';
}

/**
 * Κάθε αλλαγή γραμμής γίνεται **ένα κενό** — ποτέ δεν χάνεται λέξη.
 *
 * Το `\r\n` πιάνεται ως ένα, αλλιώς κείμενο από Windows θα άφηνε διπλά κενά. Οι διαδοχικές
 * αλλαγές γραμμής επίσης συμπτύσσονται: μια κενή γραμμή στο πρωτότυπο δεν είναι περιεχόμενο.
 */
export function flattenToSingleLine(value: string): string {
  return value.replace(/[\r\n]+/gu, ' ');
}

/** Ό,τι γράφει το πεδίο αυτή τη στιγμή. */
export function tableTextFieldValue(field: TableTextField): string {
  if (isRichTableTextField(field)) return field.textContent ?? '';
  return field.value;
}

/**
 * Τα άκρα της επιλογής, **κανονικοποιημένα** (`start <= end`).
 *
 * ⚠️ Στο πλούσιο πεδίο η επιλογή ζει στο **έγγραφο**, όχι στο στοιχείο — και το έγγραφο έχει
 * μία. Όταν δείχνει αλλού (ο χρήστης μάρκαρε κείμενο εκτός του κελιού, ή η εστίαση πήγε στη
 * γραμμή εργαλείων και ο browser την καθάρισε), η τίμια απάντηση είναι «ο δρομέας στο τέλος»
 * — η **ίδια** σύμβαση με το `readTableTextSelection` για `selectionStart === null`, όχι
 * εφευρημένο μηδέν που θα έβαφε την αρχή του κελιού.
 *
 * 🔴 Αυτή η διαφορά είναι ο λόγος που το `restoreTableTextSelection` **παύει να είναι
 * belt-and-suspenders** και γίνεται ο μηχανισμός: το `textarea` θυμόταν τα άκρα του μετά την
 * απώλεια εστίασης, το `contenteditable` δεν έχει δικά του άκρα να θυμηθεί. Το πάγωμα του
 * ADR-753 Φ4 (`selectionRef`) ήταν ήδη η σωστή απάντηση — τώρα είναι και η **μόνη**.
 */
export function tableTextFieldSelection(field: TableTextField): { start: number; end: number } {
  if (!isRichTableTextField(field)) {
    const text = field.value;
    const start = field.selectionStart ?? text.length;
    const end = field.selectionEnd ?? text.length;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  const length = (field.textContent ?? '').length;
  const selection = typeof window === 'undefined' ? null : window.getSelection();
  if (!selection || selection.rangeCount === 0) return { start: length, end: length };

  const range = selection.getRangeAt(0);
  if (!field.contains(range.startContainer) || !field.contains(range.endContainer)) {
    return { start: length, end: length };
  }
  const start = characterOffset(field, range.startContainer, range.startOffset);
  const end = characterOffset(field, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

/** Μάρκαρε αυτά τα γράμματα. Δείκτες εκτός ορίων κόβονται — ποτέ εξαίρεση. */
export function setTableTextFieldSelection(
  field: TableTextField,
  start: number,
  end: number,
): void {
  if (!isRichTableTextField(field)) {
    field.setSelectionRange(start, end);
    return;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const selection = window.getSelection();
  if (!selection) return;

  const length = (field.textContent ?? '').length;
  const from = clampIndex(start, length);
  const to = clampIndex(end, length);
  const range = document.createRange();
  const head = locateCharacter(field, Math.min(from, to));
  const tail = locateCharacter(field, Math.max(from, to));
  range.setStart(head.node, head.offset);
  range.setEnd(tail.node, tail.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

// ──────────────────────────────────────────────────────────────────────────────
// Εσωτερικά — η μετάφραση κόμβος ⇄ δείκτης χαρακτήρα
// ──────────────────────────────────────────────────────────────────────────────

/** Πόσοι χαρακτήρες του `root` προηγούνται του σημείου `(node, offset)`. */
function characterOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

/**
 * Το σημείο του DOM στο οποίο κάθεται ο χαρακτήρας `index`.
 *
 * ⚠️ Ο βρόχος δέχεται `consumed + length >= index` (και **όχι** αυστηρό `>`): στο όριο δύο
 * τμημάτων η θέση είναι εκφράσιμη με δύο τρόπους — τέλος του πρώτου ή αρχή του δεύτερου — και
 * το **τέλος του πρώτου** είναι εκείνο που κάνει τον δρομέα να κληρονομεί τη μορφοποίηση του
 * γράμματος **αριστερά** του, δηλαδή ό,τι ήδη υπόσχεται το `remapCellTextRuns`. Με αυστηρό
 * `>`, ο χαρακτήρας που θα πληκτρολογούσε ο χρήστης ακριβώς στο όριο θα έπαιρνε το στυλ του
 * επόμενου τμήματος — κάθε επεξεργαστής κειμένου κάνει το αντίθετο.
 */
function locateCharacter(root: HTMLElement, index: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.nodeValue?.length ?? 0;
    if (consumed + length >= index) return { node, offset: index - consumed };
    consumed += length;
    node = walker.nextNode();
  }
  // Κανένας κόμβος κειμένου (κενό κελί, ή DOM που δεν έχει γραφτεί ακόμη): η αρχή του ίδιου
  // του κουτιού είναι η μόνη θέση που υπάρχει, και είναι η σωστή.
  return { node: root, offset: 0 };
}

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) return length;
  return Math.min(Math.max(0, Math.trunc(value)), length);
}
