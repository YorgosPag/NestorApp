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
   * ADR-739 Φ.Δ βήμα 4 — `Ctrl+Z` / `Ctrl+Y` σε κατάσταση **πλοήγησης**: αναίρεση/επανάληψη
   * της τελευταίας **επεξεργασίας κελιού**. Δες {@link undoRedoIntent} για το γιατί.
   */
  | { readonly kind: 'history'; readonly direction: 'undo' | 'redo' }
  | { readonly kind: 'passthrough' };

const PASSTHROUGH: TableCellKeyIntent = { kind: 'passthrough' };

function move(m: TableCursorMove): TableCellKeyIntent {
  return { kind: 'move', move: m };
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
 * Η πρόθεση ενός πλήκτρου, δεδομένης της κατάστασης του δρομέα.
 *
 * ⚠️ **Τα `Ctrl`/`Meta` περνούν ανέγγιχτα**, με **δύο** ρητές εξαιρέσεις:
 * `Ctrl+Home`/`Ctrl+End` (άκρη πλέγματος) και `Ctrl+Z`/`Ctrl+Y` σε **πλοήγηση**
 * ({@link undoRedoIntent} — διάβασε εκεί γιατί η απόφαση αντιστράφηκε στο βήμα 4).
 * Το `Ctrl+C`/`Ctrl+X`/`Ctrl+V` και οι επιταχυντές της εφαρμογής μένουν ανέγγιχτοι.
 *
 * ⚠️ Το `Alt` περνά επίσης: στο Excel το `Alt+Enter` είναι αλλαγή γραμμής μέσα στο κελί.
 * Εδώ το `TableCell.value` είναι **απλό `string`** (τεκμηριωμένη απόφαση, ADR-739 Φ.Α),
 * άρα δεν το υλοποιούμε — αλλά ούτε το **κλέβουμε** για να σημαίνει κάτι άλλο.
 */
export function resolveTableCellKeyIntent(
  key: string,
  mod: TableCellKeyModifiers,
  mode: TableCellCursorMode,
): TableCellKeyIntent {
  if (mod.altKey) return PASSTHROUGH;

  const homeEnd = homeEndMove(key, mod);
  // Σε κατάσταση γραφής το Home/End ανήκουν στον **κέρσορα** του κειμένου, όχι στο πλέγμα:
  // μόλις έγραψες κάτι, «αρχή» σημαίνει αρχή της λέξης σου.
  if (homeEnd) return mode === 'nav' ? move(homeEnd) : PASSTHROUGH;

  const history = undoRedoIntent(mod, mode);
  if (history) return history;

  if (mod.ctrlKey || mod.metaKey) return PASSTHROUGH;

  const universal = universalMove(key, mod);
  if (universal) return move(universal);

  if (key === 'F2') return { kind: 'mode', to: f2Target(mode) };

  const arrow = arrowMove(key);
  // Η ΜΙΑ γραμμή που κωδικοποιεί τη διάκριση Excel: σε `edit` ο κέρσορας κρατά τα βέλη.
  if (arrow) return mode === 'edit' ? PASSTHROUGH : move(arrow);

  if ((key === 'Delete' || key === 'Backspace') && mode === 'nav') return { kind: 'clear' };

  return PASSTHROUGH;
}
