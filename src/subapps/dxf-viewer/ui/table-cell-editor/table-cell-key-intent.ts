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

/** Οι τροποποιητές που εξετάζονται — υποσύνολο του `KeyboardEvent`, ώστε τα tests να μη στήνουν συμβάντα. */
export interface TableCellKeyModifiers {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
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

/** `F2`: nav → edit· enter ⇄ edit (το «διπλό F2»). */
function f2Target(mode: TableCellCursorMode): TableCellCursorMode {
  return mode === 'edit' ? 'enter' : 'edit';
}

/**
 * Η πρόθεση ενός πλήκτρου, δεδομένης της κατάστασης του δρομέα.
 *
 * ⚠️ **Τα `Ctrl`/`Meta` περνούν ανέγγιχτα** (εκτός από `Ctrl+Home`/`Ctrl+End`): εκεί ζουν
 * το `Ctrl+Z`, το `Ctrl+C` και οι επιταχυντές της εφαρμογής. Ένα κελί που τρώει το undo
 * του χρήστη είναι χειρότερο από ένα κελί χωρίς πλοήγηση.
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
