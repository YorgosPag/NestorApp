/**
 * ADR-739 Φ.Δ βήμα 2 — **ποιο πλήκτρο τι σημαίνει** μέσα σε κελί πίνακα. Καθαρή συνάρτηση.
 *
 * Χωριστό από τον React hook επίτηδες: εδώ ζει ΟΛΗ η σημασιολογία που ερευνήθηκε (§20.1
 * του ADR), και δοκιμάζεται με σκέτα αντικείμενα — καμία `KeyboardEvent`, κανένα jsdom,
 * καμία εστίαση. Ένα λάθος εδώ είναι λάθος **απόφασης**, όχι καλωδίωσης, και πρέπει να
 * φαίνεται ως τέτοιο σε ένα test που διαβάζεται σαν πίνακας προδιαγραφής.
 *
 * ## Η διάκριση που κάνει τη διαφορά: `enter` vs `edit` (Excel)
 * Και οι δύο έχουν πρόχειρο κείμενο· διαφέρουν **μόνο στα βέλη**:
 *
 * - `enter` (πληκτρολόγησες πάνω σε επιλεγμένο κελί) → το βέλος **δεσμεύει και μετακινεί**.
 *   Έτσι γράφεις μια γραμμή BOQ χωρίς να αγγίξεις Tab: γράφω, δεξί βέλος, γράφω…
 * - `edit` (`F2` ή διπλό κλικ) → το βέλος μετακινεί τον **κέρσορα** μέσα στο κείμενο,
 *   γιατί μπήκες εκεί ακριβώς για να διορθώσεις ένα γράμμα.
 *
 * Το `F2` εναλλάσσει τις δύο (το «διπλό F2» του Excel). Χωρίς αυτή τη διάκριση το βέλος
 * είναι διφορούμενο: ή χάνεις την πλοήγηση μόλις αρχίσεις να γράφεις, ή δεν μπορείς ποτέ
 * να διορθώσεις χαρακτήρα στη μέση. Αυτό ακριβώς ήταν το ανοιχτό σχεδιαστικό ερώτημα.
 *
 * ## Τι ΔΕΝ αποφασίζεται εδώ
 * - Το `Escape`: δρομολογείται **πάντα** από τον escape-bus (ADR-364 / CHECK 3.7), ποτέ με
 *   σύγκριση `key === 'Escape'`. Γι' αυτό δεν εμφανίζεται σε καμία περίπτωση παρακάτω.
 * - Οι **εκτυπώσιμοι χαρακτήρες**: επιστρέφουν `passthrough` και μπαίνουν στο `<input>` με
 *   τον φυσικό δρόμο του browser. Καμία συνθετική επανεκπομπή — έτσι δουλεύουν δωρεάν οι
 *   νεκροί τόνοι, το IME και τα ελληνικά, που ένα `if (/^[a-z]$/)` θα τα έσπαγε.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-key-intent
 * @see bim/table/table-cell-navigation.ts — τι σημαίνει κάθε κίνηση πάνω στο μοντέλο
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §20
 */

import type { TableCursorMove } from '../../bim/table/table-cell-navigation';
import type { TableCellCursorMode } from '../../state/table-cell-cursor-store';

/**
 * Το υποσύνολο του `KeyboardEvent` που εξετάζεται — ώστε τα tests να μη στήνουν συμβάντα.
 *
 * ⚠️ Το {@link code} είναι **φυσική θέση πλήκτρου**, όχι χαρακτήρας, και είναι ο ΜΟΝΟΣ
 * ασφαλής τρόπος να αναγνωριστεί το `Ctrl+Z` σε **ελληνική διάταξη**: εκεί το `key` του
 * ίδιου πλήκτρου είναι `'ζ'`. Το `useCommandHistory` έκανε ήδη αυτή την επιλογή
 * (`event.code === 'KeyZ'`)· εδώ την **τηρούμε**, αλλιώς το undo θα δούλευε μόνο σε
 * λατινική διάταξη — δηλαδή ποτέ, για τον χρήστη αυτής της εφαρμογής.
 *
 * Προαιρετικό γιατί καμία **άλλη** απόφαση δεν το χρειάζεται: τα βέλη, το `Tab` και το
 * `F2` έχουν ίδιο `key` σε κάθε διάταξη.
 */
export interface TableCellKeyModifiers {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly code?: string;
}

/**
 * Τι πρέπει να συμβεί. `passthrough` σημαίνει «**μην** αγγίξεις το συμβάν» — το `<input>`
 * ή ο υπόλοιπος viewer το χειρίζονται μόνοι τους.
 */
export type TableCellKeyIntent =
  /** Δέσμευσε ό,τι γράφτηκε και πήγαινε στο κελί που ορίζει η κίνηση. */
  | { readonly kind: 'move'; readonly move: TableCursorMove }
  /** `F2` — εναλλαγή κατάστασης προς την `to`. */
  | { readonly kind: 'mode'; readonly to: TableCellCursorMode }
  /** `Delete` / `Backspace` σε κατάσταση πλοήγησης — άδειασε το κελί (Excel). */
  | { readonly kind: 'clear' }
  /**
   * 🔴 ADR-751 Φ8.γ — `Alt+Enter` σε κατάσταση **πλοήγησης**: άνοιξε τη διεύθυνση του κελιού.
   *
   * ## Γιατί ΑΚΡΙΒΩΣ αυτό το πλήκτρο, και γιατί ΜΟΝΟ σε πλοήγηση
   * Είναι η συντόμευση των **Google Sheets** για «άνοιγμα συνδέσμου», και η επιλογή δεν είναι
   * αυθαίρετη: το **Excel δεν έχει καμία** — ο μόνος δρόμος του χωρίς ποντίκι είναι
   * `Shift+F10` και μετά βέλη μέσα στο μενού (ερευνήθηκε 2026-08-04).
   *
   * Το ίδιο πλήκτρο όμως σημαίνει στο Excel **αλλαγή γραμμής μέσα στο κελί** — και γι' αυτό
   * ακριβώς ήταν {@link SUPPRESS} εδώ μέχρι σήμερα (ADR-739 Φ.Δ βήμα 6: το `<textarea>` θα
   * έγραφε πραγματικό `\n` σε τιμή που είναι απλό `string`).
   *
   * Οι δύο σημασίες **δεν συγκρούονται**, γιατί ζουν σε διαφορετική κατάσταση — και έτσι
   * ακριβώς τις ξεχωρίζουν και τα Sheets:
   *
   * | Κατάσταση | `Alt+Enter` | Ποιανού πρότυπο |
   * |---|---|---|
   * | `nav` (κελί επιλεγμένο) | **άνοιγμα συνδέσμου** | Google Sheets |
   * | `enter` / `edit` (γράφεις) | κατάπιε το — αλλαγή γραμμής **δεσμευμένη** | Excel |
   *
   * ⚠️ Η δεύτερη γραμμή μένει `suppress` **επίτηδες** και δεν είναι παράλειψη: όταν έρθει το
   * `overflow: 'wrap'` (ADR-739 Φ.Δ.10) η αναδίπλωση γίνεται υπαρκτή έννοια του μοντέλου και
   * **εκεί** αλλάζει, σε ένα σημείο. Μια «απλοποίηση» που έδινε άνοιγμα συνδέσμου και σε
   * γραφή θα έκλεβε το πλήκτρο από τη μελλοντική αλλαγή γραμμής.
   */
  | { readonly kind: 'openLink' }
  /**
   * ADR-739 Φ.Δ βήμα 4 — `Ctrl+Z` / `Ctrl+Y` σε κατάσταση **πλοήγησης**: αναίρεση/επανάληψη
   * της τελευταίας **επεξεργασίας κελιού**. Δες {@link undoRedoIntent} για το γιατί.
   */
  | { readonly kind: 'history'; readonly direction: 'undo' | 'redo' }
  /**
   * ADR-739 Φ.Δ βήμα 6 — «**κατάπιε το, μην κάνεις τίποτα**»: πλήκτρο που το πεδίο κειμένου
   * θα εκτελούσε μόνο του με αποτέλεσμα που το μοντέλο δεν μπορεί να εκφράσει.
   *
   * Διαφέρει από το `passthrough` όσο διαφέρει η σιωπή από τη συγκατάθεση, και υπάρχει
   * επειδή το βήμα 6 άλλαξε το στοιχείο σε `<textarea>`: μέχρι τότε το `<input>` **δεν είχε**
   * δεύτερη γραμμή, οπότε το `Alt+Enter` του Excel δεν έκανε τίποτα από μόνο του και η σωστή
   * απάντηση ήταν «μην το αγγίξεις». Τώρα θα έγραφε πραγματικό `\n` μέσα στην τιμή.
   */
  | { readonly kind: 'suppress' }
  /**
   * 🔴 ADR-739 Φ.Δ βήμα 8 — `Shift + βέλος/Home/End`: μεγάλωσε την **περιοχή**, μην
   * μετακινήσεις τον δρομέα. Το ενεργό κελί μένει ακίνητο· κουνιέται μόνο το άλλο άκρο.
   *
   * Είναι **ίδια κίνηση, άλλος στόχος** — γι' αυτό κουβαλά το ίδιο {@link TableCursorMove}
   * και όχι δικό της λεξιλόγιο: η απάντηση στο «ποιο είναι το επόμενο κελί;» είναι μία, και
   * ζει στο `moveTableCursor`.
   */
  | { readonly kind: 'extend'; readonly move: TableCursorMove }
  /** ADR-739 Φ.Δ βήμα 8 — `Ctrl+A` σε **πλοήγηση**: όλα τα κελιά **αυτού** του πίνακα. */
  | { readonly kind: 'selectAll' }
  | { readonly kind: 'passthrough' };

const PASSTHROUGH: TableCellKeyIntent = { kind: 'passthrough' };
const SUPPRESS: TableCellKeyIntent = { kind: 'suppress' };
const OPEN_LINK: TableCellKeyIntent = { kind: 'openLink' };
const SELECT_ALL: TableCellKeyIntent = { kind: 'selectAll' };

function move(m: TableCursorMove): TableCellKeyIntent {
  return { kind: 'move', move: m };
}

/**
 * Η **ίδια** κίνηση, ερμηνευμένη ως μετακίνηση ή ως επέκταση περιοχής.
 *
 * Ο κανόνας του `Shift` ισχύει **μόνο σε πλοήγηση**: σε γραφή το `Shift+βέλος` ανήκει στην
 * **επιλογή κειμένου** του πεδίου, όπως ακριβώς και το σκέτο βέλος σε κατάσταση `edit`.
 * Ίδιο επιχείρημα με το `Ctrl+Z` (§`undoRedoIntent`): ό,τι κάνει ήδη σωστά ο browser πάνω
 * σε εστιασμένο κείμενο, δεν το αγγίζουμε.
 */
function moveOrExtend(
  m: TableCursorMove,
  mod: TableCellKeyModifiers,
  mode: TableCellCursorMode,
): TableCellKeyIntent {
  return mod.shiftKey && mode === 'nav' ? { kind: 'extend', move: m } : move(m);
}

/**
 * Τα βέλη ως κινήσεις — `null` για κάθε άλλο πλήκτρο.
 *
 * ⚠️ Ο άξονας **δεν** αντιστρέφεται: ο πίνακας μετριέται με +v προς τα **κάτω**
 * (`table-layout-types`), οπότε `ArrowDown` = επόμενη γραμμή, χωρίς καμία μετατροπή.
 * Ο DXF άξονας που κοιτά ψηλά ζει μόνο στην προβολή, όχι στο μοντέλο.
 */
function arrowMove(key: string): TableCursorMove | null {
  switch (key) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    default: return null;
  }
}

/**
 * `Home` / `End`, με το `Ctrl` να τα ανεβάζει από τη γραμμή στο πλέγμα — ακριβώς η
 * προδιαγραφή του WAI-ARIA APG «Grid» (και του Excel, και του Handsontable).
 */
function homeEndMove(key: string, mod: TableCellKeyModifiers): TableCursorMove | null {
  const jumpsGrid = mod.ctrlKey || mod.metaKey;
  if (key === 'Home') return jumpsGrid ? 'gridStart' : 'rowStart';
  if (key === 'End') return jumpsGrid ? 'gridEnd' : 'rowEnd';
  return null;
}

/**
 * Οι κινήσεις που ισχύουν σε **κάθε** κατάσταση: `Tab` και `Enter`.
 *
 * Το `Enter` χαρτογραφείται σε `commitDown`/`commitUp` — δηλαδή στην κίνηση που κουβαλά
 * τον κανόνα της **στήλης αγκύρωσης** του Excel. Το `Tab` σε `next`/`previous`, που
 * αναδιπλώνουν γραμμή (AutoCAD/Word) και **διατηρούν** την αγκύρωση.
 */
function universalMove(key: string, mod: TableCellKeyModifiers): TableCursorMove | null {
  if (key === 'Tab') return mod.shiftKey ? 'previous' : 'next';
  if (key === 'Enter') return mod.shiftKey ? 'commitUp' : 'commitDown';
  return null;
}

/**
 * ADR-739 Φ.Δ βήμα 4 — `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`, **μόνο σε πλοήγηση**.
 *
 * ── ΓΙΑΤΙ Η ΑΠΟΦΑΣΗ ΑΝΤΙΣΤΡΑΦΗΚΕ ──
 *
 * Μέχρι το βήμα 3 τα `Ctrl`/`Meta` περνούσαν **ανέγγιχτα**, με ρητή αιτιολογία: «εκεί ζουν
 * το Ctrl+Z και οι επιταχυντές της εφαρμογής· ένα κελί που τρώει το undo του χρήστη είναι
 * χειρότερο από ένα κελί χωρίς πλοήγηση». Αυτό ήταν **σωστό όσο** ο καμβάς άκουγε ακόμα:
 * το `useCommandHistory` είχε ωμό `window` listener χωρίς κανέναν φύλακα, οπότε το `Ctrl+Z`
 * έφτανε πάντα κάπου.
 *
 * Στο βήμα 4 ο listener μπήκε πίσω από τον δομικό φύλακα (`addGlobalShortcutListener`) και
 * η λειτουργία πίνακα δηλώνει `pushModalKeyboardScope()`. Άρα ο καμβάς **παραιτείται** — και
 * χωρίς αυτή τη γραμμή το `Ctrl+Z` μέσα στον πίνακα δεν θα έκανε **τίποτα**. Δηλαδή η ίδια
 * αρχή («μη φας το undo του χρήστη») απαιτεί τώρα το **αντίθετο** πράγμα: να το διεκδικήσεις.
 *
 * ── ΓΙΑΤΙ ΜΟΝΟ ΣΕ ΠΛΟΗΓΗΣΗ (Excel parity) ──
 *
 * Σε γραφή, το `Ctrl+Z` του Excel αναιρεί την **πληκτρολόγηση**, όχι την τελευταία εντολή.
 * Αυτό το κάνει ήδη ο browser, δωρεάν και σωστά, πάνω στο εστιασμένο `<input>` — αρκεί να
 * **μην** το αγγίξουμε. Ένα συνθετικό undo κειμένου θα έσπαγε τη στοίβα του πεδίου, τους
 * νεκρούς τόνους και το IME, ακριβώς όπως θα τα έσπαγε μια συνθετική επανεκπομπή χαρακτήρα.
 *
 * `null` για κάθε άλλο συνδυασμό.
 */
function undoRedoIntent(
  mod: TableCellKeyModifiers,
  mode: TableCellCursorMode,
): TableCellKeyIntent | null {
  if (mode !== 'nav') return null;
  if (!mod.ctrlKey && !mod.metaKey) return null;
  // Ο έλεγχος γίνεται στη ΦΥΣΙΚΗ θέση πλήκτρου — δες το σχόλιο του `code`.
  if (mod.code === 'KeyY') return { kind: 'history', direction: 'redo' };
  if (mod.code !== 'KeyZ') return null;
  return { kind: 'history', direction: mod.shiftKey ? 'redo' : 'undo' };
}

/** `F2`: nav → edit· enter ⇄ edit (το «διπλό F2»). */
function f2Target(mode: TableCellCursorMode): TableCellCursorMode {
  return mode === 'edit' ? 'enter' : 'edit';
}

/**
 * 🔴 ADR-739 Φ.Δ βήμα 8 — **ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΤΟ ΠΡΟΧΕΙΡΟ**, ανά κατάσταση δρομέα.
 *
 * ## Γιατί δεν είναι `TableCellKeyIntent`
 * Το `Ctrl+C`/`Ctrl+V` **δεν χρειάζεται να αναγνωριστεί ως πλήκτρο**: ο browser εκπέμπει
 * ήδη πραγματικά συμβάντα `copy` / `paste` πάνω στο εστιασμένο πεδίο, με έτοιμο
 * `clipboardData` — χωρίς άδεια, χωρίς `navigator.clipboard`, χωρίς χειρονομία χρήστη, και
 * σωστά σε **κάθε διάταξη πληκτρολογίου** (το `Ctrl+C` σε ελληνική διάταξη έχει `key: 'ψ'`).
 * Ένα συνθετικό `keydown` μονοπάτι θα ήταν χειρότερο σε τέσσερα μέτωπα ταυτόχρονα.
 *
 * Αυτό όμως που **πρέπει** να ζει σε ένα σημείο είναι η **απόφαση**: ποιος κατέχει το
 * πρόχειρο σε κάθε κατάσταση. Ζει εδώ, δίπλα σε κάθε άλλη απόφαση πλήκτρου του πίνακα, και
 * τη ρωτούν οι χειριστές `onCopy`/`onPaste` — αντί να ξαναγράψουν ο καθένας ένα
 * `mode === 'nav'` που κάποτε θα αποκλίνει.
 *
 * ## Γιατί σε γραφή ανήκει στον browser — και καλώς
 * Σε `enter`/`edit` ο χρήστης αντιγράφει **κείμενο μέσα στο κελί**. Ο browser το κάνει
 * σωστά και δωρεάν· μια συνθετική αντιγραφή θα έσπαγε το IME και τους ελληνικούς τόνους —
 * **ίδιο επιχείρημα** με το `Ctrl+Z` σε γραφή ({@link undoRedoIntent}). Άρα η αντιγραφή
 * **περιοχής** ζει **μόνο** σε `nav`. Δεν είναι περιορισμός· είναι η ίδια διάκριση που ήδη
 * κάνει το Excel.
 */
export type TableClipboardScope = 'range' | 'text';

export function tableClipboardScope(mode: TableCellCursorMode): TableClipboardScope {
  return mode === 'nav' ? 'range' : 'text';
}

/**
 * Η πρόθεση ενός πλήκτρου, δεδομένης της κατάστασης του δρομέα.
 *
 * ⚠️ **Τα `Ctrl`/`Meta` περνούν ανέγγιχτα**, με **τρεις** ρητές εξαιρέσεις:
 * `Ctrl+Home`/`Ctrl+End` (άκρη πλέγματος), `Ctrl+Z`/`Ctrl+Y` σε **πλοήγηση**
 * ({@link undoRedoIntent} — διάβασε εκεί γιατί η απόφαση αντιστράφηκε στο βήμα 4), και
 * `Ctrl+A` σε **πλοήγηση** (ADR-739 Φ.Δ βήμα 8 — «όλα τα κελιά», όχι «όλες οι οντότητες»).
 * Το `Ctrl+C`/`Ctrl+X`/`Ctrl+V` και οι επιταχυντές της εφαρμογής μένουν ανέγγιχτοι **εδώ**:
 * το πρόχειρο δεν περνά από πλήκτρα αλλά από τα φυσικά συμβάντα `copy`/`paste` του browser
 * — δες {@link tableClipboardScope} για το ποιος το κατέχει και γιατί.
 *
 * ⚠️ Το `Alt` περνά επίσης — με **μία** εξαίρεση, το `Alt+Enter`, που είναι το μόνο πλήκτρο
 * με **δύο** νόμιμες σημασίες και τις ξεχωρίζει η **κατάσταση**.
 *
 * ── ΓΙΑΤΙ ΤΟ `Alt+Enter` ΜΠΛΟΚΑΡΕΤΑΙ ΣΕ ΓΡΑΦΗ (ADR-739 Φ.Δ βήμα 6) ──
 *
 * Στο Excel είναι αλλαγή γραμμής μέσα στο κελί. Εδώ το `TableCell.value` είναι **απλό
 * `string`** (τεκμηριωμένη απόφαση, ADR-739 Φ.Α), άρα δεν το υλοποιούμε. Μέχρι το βήμα 5
 * αυτό αρκούσε ως «μην το αγγίξεις»: το στοιχείο ήταν `<input>`, που **δεν δέχεται** αλλαγή
 * γραμμής — η μη-υλοποίηση ήταν δωρεάν.
 *
 * Το βήμα 6 το έκανε `<textarea>` (χρειάζεται δεύτερη οπτική γραμμή). Από εκείνη τη στιγμή
 * η **ίδια** αδράνεια δίνει το **αντίθετο** αποτέλεσμα: ο browser γράφει πραγματικό `\n` στην
 * τιμή, η διάταξη το μετρά σαν γράμμα και το DXF παίρνει χαρακτήρα ελέγχου μέσα σε κελί.
 * Άρα η αρχή «μη λες ψέματα για το τι υποστηρίζεις» απαιτεί ρητή άρνηση **σε γραφή**.
 *
 * Δεν είναι μόνιμο: όταν έρθει το `overflow: 'wrap'` (Φ.Δ.10) η αναδίπλωση γίνεται υπαρκτή
 * έννοια του μοντέλου και **εδώ** αλλάζει η μία γραμμή, σε ένα σημείο.
 *
 * ── ΚΑΙ ΓΙΑΤΙ ΑΝΟΙΓΕΙ ΣΥΝΔΕΣΜΟ ΣΕ ΠΛΟΗΓΗΣΗ (ADR-751 Φ8.γ) ──
 *
 * Σε `nav` δεν γράφει κανείς, άρα το πλήκτρο ήταν **ελεύθερο** — και τα Google Sheets το
 * έχουν ήδη δώσει εκεί στο «άνοιγμα συνδέσμου». Δες το `openLink` του union για τον πίνακα
 * των δύο προτύπων και για το γιατί η διάκριση κατάστασης **δεν είναι συμβιβασμός**.
 */
export function resolveTableCellKeyIntent(
  key: string,
  mod: TableCellKeyModifiers,
  mode: TableCellCursorMode,
): TableCellKeyIntent {
  // ADR-751 Φ8.γ — το `Alt+Enter` έχει **δύο** νόμιμες σημασίες και τις ξεχωρίζει η
  // κατάσταση, όχι το πλήκτρο· δες το `openLink` του union για τον πίνακα Sheets/Excel.
  if (mod.altKey) {
    if (key !== 'Enter') return PASSTHROUGH;
    return mode === 'nav' ? OPEN_LINK : SUPPRESS;
  }

  const homeEnd = homeEndMove(key, mod);
  // Σε κατάσταση γραφής το Home/End ανήκουν στον **κέρσορα** του κειμένου, όχι στο πλέγμα:
  // μόλις έγραψες κάτι, «αρχή» σημαίνει αρχή της λέξης σου.
  // ADR-739 Φ.Δ βήμα 8 — με `Shift` η ίδια κίνηση **μεγαλώνει την περιοχή** ως την άκρη
  // της γραμμής (ή του πλέγματος με `Ctrl`), όπως σε κάθε φύλλο υπολογισμού.
  if (homeEnd) return mode === 'nav' ? moveOrExtend(homeEnd, mod, mode) : PASSTHROUGH;

  const history = undoRedoIntent(mod, mode);
  if (history) return history;

  // ADR-739 Φ.Δ βήμα 8 — `Ctrl+A` **πριν** τη γενική διέλευση των `Ctrl`: μέσα σε πίνακα
  // σημαίνει «όλα τα **κελιά**», όχι «όλες οι **οντότητες** του σχεδίου».
  //
  // Η ιδιοκτησία δεν κερδίζεται με `if` στο `useKeyboardShortcuts` — το ίδιο το αρχείο το
  // απαγορεύει («ο φύλακας είναι δομικός»). Κερδίζεται επειδή το εστιασμένο στοιχείο είναι
  // πραγματικό πεδίο κειμένου: ο `useDxfToolbarShortcuts` παραιτείται από **κάθε**
  // συντόμευση όταν ο στόχος είναι `INPUT`/`TEXTAREA`. Εδώ απλώς δηλώνουμε τι κάνουμε με το
  // πλήκτρο που μας παραχωρήθηκε — και το `preventDefault` του καταναλωτή εμποδίζει τον
  // browser να «επιλέξει όλο το κείμενο» ενός πεδίου που σε πλοήγηση είναι κενό.
  // ⚠️ Ο έλεγχος γίνεται στη **ΦΥΣΙΚΗ ΘΕΣΗ** πλήκτρου (`code`), ποτέ στον χαρακτήρα: σε
  // **ελληνική διάταξη** το `key` αυτού του πλήκτρου είναι `'α'`, οπότε ένα `key === 'a'`
  // θα δούλευε μόνο σε λατινική διάταξη — δηλαδή ποτέ, για τον χρήστη αυτής της εφαρμογής.
  // Είναι το ίδιο μάθημα που κωδικοποιεί ήδη το {@link undoRedoIntent} για το `Ctrl+Z`.
  if ((mod.ctrlKey || mod.metaKey) && !mod.shiftKey && mod.code === 'KeyA' && mode === 'nav') {
    return SELECT_ALL;
  }

  if (mod.ctrlKey || mod.metaKey) return PASSTHROUGH;

  const universal = universalMove(key, mod);
  if (universal) return move(universal);

  if (key === 'F2') return { kind: 'mode', to: f2Target(mode) };

  const arrow = arrowMove(key);
  // Η ΜΙΑ γραμμή που κωδικοποιεί τη διάκριση Excel: σε `edit` ο κέρσορας κρατά τα βέλη.
  if (arrow) return mode === 'edit' ? PASSTHROUGH : moveOrExtend(arrow, mod, mode);

  if ((key === 'Delete' || key === 'Backspace') && mode === 'nav') return { kind: 'clear' };

  return PASSTHROUGH;
}
