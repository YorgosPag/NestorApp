/**
 * 🔴 ADR-739 §57 — **ΤΟ ΕΣΩΤΕΡΙΚΟ ΠΡΟΧΕΙΡΟ ΤΟΥ ΠΙΝΑΚΑ**: τι κρατά η εφαρμογή όταν αντιγράφεις,
 * πέρα από το κείμενο που δίνει στο λειτουργικό.
 *
 * Καθαρό: μηδέν React, μηδέν DOM, μηδέν `navigator.clipboard`. Το πρόχειρο **του συστήματος**
 * ζει στο `ui/table-cell-editor/use-table-menu-clipboard.ts`· εδώ ζει μόνο **τι** ταξιδεύει.
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — το TSV χάνει τα πάντα εκτός από το κείμενο
 * Μέχρι το §57 η αντιγραφή περιοχής παρήγαγε **μόνο** TSV. Είναι το σωστό πράγμα να δίνεις στο
 * λειτουργικό (το Excel το διαβάζει), αλλά ως **μοναδική** μνήμη είναι ακρωτηριασμός: χάνονται
 * οι τύποι (το `cellText` ενός τύπου επιστρέφει το **αποτέλεσμα**), η μορφοποίηση, τα
 * περιγράμματα, οι διαγώνιοι, η μορφή αριθμού. Ο χρήστης που αντιγράφει μια βαμμένη γραμμή
 * ποσοτήτων και την επικολλά δίπλα, παίρνει **γυμνούς αριθμούς** — και το χειρότερο, χωρίς
 * κανένα μήνυμα.
 *
 * ## 🔴 ΤΟ ΜΟΝΤΕΛΟ ΕΙΝΑΙ ΤΟΥ AutoCAD, ΟΧΙ ΤΟΥ ΦΥΛΛΟΥ ΥΠΟΛΟΓΙΣΜΟΥ ΣΤΟΝ BROWSER
 * Το AutoCAD γράφει τις οντότητες σε **προσωρινό `.dwg`** στον `%temp%` και βάζει λαβή στο
 * πρόχειρο του λειτουργικού· στην επικόλληση διαλέγει *«the format that retains the most
 * information»*. Το Office κάνει το ίδιο με το Office Clipboard. Εδώ:
 *
 * ```
 *   ΑΝΤΙΓΡΑΦΗ  περιοχή ──┬─→ TSV ──────────────→ πρόχειρο ΣΥΣΤΗΜΑΤΟΣ  (το Excel το διαβάζει)
 *                        └─→ TableClipboardPayload → μνήμη ΕΦΑΡΜΟΓΗΣ (τύποι + μορφή)
 * ```
 *
 * Το σημείο σύνδεσης των δύο είναι το {@link TableClipboardPayload.text}: **κυριολεκτικά** το
 * ίδιο αλφαριθμητικό που γράφτηκε έξω. Στην επικόλληση, αν το πρόχειρο του συστήματος
 * εξακολουθεί να λέει αυτό, τότε το φορτίο **αντιστοιχεί** και μπορεί να χρησιμοποιηθεί· αν λέει
 * κάτι άλλο, ο χρήστης αντέγραψε αλλού στο μεταξύ και το φορτίο είναι μπαγιάτικο. Δεν χρειάζεται
 * ούτε ρολόι, ούτε ακροατής `clipboardchange`, ούτε άδεια — **η ίδια η σύγκριση είναι το σήμα**.
 *
 * ## 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ, ΟΧΙ ΕΝΑ — και κανένα τους δεν παράγει το άλλο
 * ```
 *   text   →  οι ΤΙΜΕΣ, σειριοποιημένες   (ό,τι θα έπαιρνε και το Excel)
 *   cells  →  το ΠΕΡΙΕΧΟΜΕΝΟ              (τύποι, runs, κλείδωμα — ό,τι το TSV δεν χωρά)
 *   brush  →  η ΜΟΡΦΗ                     (ADR-768· ό,τι το TSV δεν χωρά ούτε κατά διάνοια)
 * ```
 * Η **επικόλληση τιμών** δεν διαβάζει τα `cells`: ξαναπερνά από το {@link text}, δηλαδή από τον
 * **ίδιο** δρόμο που ακολουθεί κείμενο ερχόμενο από το Excel. Δεν είναι τεμπελιά — είναι η μόνη
 * κατασκευή που κάνει **αποδείξιμο** ότι «Επικόλληση Τιμών» από τον ΝΕΣΤΩΡ δίνει ό,τι ακριβώς θα
 * έδινε το ίδιο αντίγραφο περασμένο μέσα από το Excel. Δύο ξεχωριστοί γραφείς τιμών θα ήταν δύο
 * απαντήσεις στο «πώς κωδικοποιείται ένα κελί με στηλοθέτη μέσα του».
 *
 * ## Γιατί στιγμιότυπο και όχι αναφορά στην πηγή
 * Ίδιο επιχείρημα, λέξη προς λέξη, με το {@link TableFormatBrush} (ADR-768): μόλις αντιγράψεις,
 * η πηγή μπορεί να αλλάξει, να μετακινηθεί ή να **διαγραφεί** — το πρόχειρο εξακολουθεί να κρατά
 * ό,τι πήρε. Γι' αυτό εδώ ζουν {@link rows}/{@link columns} αντί για `bounds`: το **σχήμα**
 * επιβιώνει της διαγραφής της πηγής, τα όρια όχι.
 *
 * @module subapps/dxf-viewer/bim/table/table-clipboard-payload
 * @see bim/table/table-clipboard-paste.ts — τι γίνεται με αυτό στην επικόλληση
 * @see bim/table/table-format-payload.ts — ο ΕΝΑΣ ορισμός του «τι είναι μορφή»
 * @see bim/table/table-range-clipboard.ts — η ΜΙΑ σειριοποίηση TSV
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §57
 */

import { captureTableFormatBrush } from './table-format-paint';
import { ALL_TABLE_FORMAT_FACETS, type TableFormatBrush } from './table-format-payload';
import { tableRangeToClipboardText } from './table-range-clipboard';
import { getCell, resolveTableModel } from './table-model-helpers';
import type { TableCellRangeBounds } from './table-cell-range';
import type { TableStyle } from './table-style';
import type { PersistedTableModel, TableCell } from '../../types/table';

/**
 * 🔴 **ΤΟ ΦΟΡΤΩΜΕΝΟ ΠΡΟΧΕΙΡΟ** — ένα στιγμιότυπο της περιοχής, αποκομμένο από το μοντέλο.
 */
export interface TableClipboardPayload {
  /**
   * Ύψος και πλάτος του αντιγραμμένου ορθογωνίου, σε κελιά (≥1).
   *
   * ⚠️ Είναι **κυριολεκτικά** τα `brush.rows` / `brush.columns` — δεν ξαναϋπολογίζονται από τα
   * όρια. Δύο αριθμητικές για το ίδιο ορθογώνιο θα ήταν δύο ευκαιρίες να διαφωνήσουν, και η
   * διαφωνία θα εκδηλωνόταν ως **ολισθημένο** μοτίβο επικόλλησης, όχι ως σφάλμα.
   */
  readonly rows: number;
  readonly columns: number;
  /**
   * Τα κελιά της πηγής, **row-major**, μήκους `rows × columns`.
   *
   * `undefined` σημαίνει «κενό κελί» και είναι **φυσιολογικό**: ο χάρτης του μοντέλου είναι
   * αραιός, και τα **καλυμμένα** κελιά μιας συγχώνευσης δεν κρατούν εγγραφή (το περιεχόμενο ζει
   * στην άγκυρα). Ο καταναλωτής το περνά αυτούσιο στο `transferredCell`, που ήδη ξέρει ότι
   * «πηγή `undefined` ⇒ ο στόχος αδειάζει πραγματικά».
   */
  readonly cells: readonly (TableCell | undefined)[];
  /** ADR-768 — η **επιλυμένη** μορφή κάθε κελιού, με **όλες** τις όψεις φορτωμένες. */
  readonly brush: TableFormatBrush;
  /**
   * Οι δείκτες πλέγματος της **πάνω-αριστερής** γωνίας της πηγής.
   *
   * 🔴 Δείκτες και **όχι** ταυτότητες (`rowId`/`colId`), και είναι όλη η διαφορά: η επικόλληση
   * επιτρέπεται σε **άλλον πίνακα**, όπου οι ταυτότητες της πηγής δεν σημαίνουν τίποτα. Οι
   * δείκτες όμως αρκούν για το μόνο που τους χρειάζεται — τη μετατόπιση των **σχετικών
   * αναφορών** ενός τύπου (`=A1` ένα κελί δεξιότερα γίνεται `=B1`), που είναι αριθμητική πάνω
   * στο πλέγμα **του στόχου**.
   */
  readonly origin: { readonly row: number; readonly col: number };
  /**
   * 🔑 **ΤΟ ΑΠΟΤΥΠΩΜΑ** — κυριολεκτικά το TSV που γράφτηκε στο πρόχειρο του λειτουργικού.
   *
   * Δύο ρόλοι, και οι δύο ουσιώδεις:
   *  1. **Ταυτοποίηση**: `readText() === text` ⇒ το πρόχειρο του συστήματος είναι ακόμη το δικό
   *     μας ⇒ το φορτίο ισχύει. Καμία άλλη ερώτηση δεν χρειάζεται απάντηση.
   *  2. **Επικόλληση τιμών**: ξαναπερνά από τον εξωτερικό δρόμο — δες την κεφαλίδα.
   */
  readonly text: string;
}

/**
 * Φορτώνει το πρόχειρο από μια περιοχή. `null` όταν δεν υπάρχει τίποτα να αντιγραφεί ή όταν τα
 * όρια είναι **μπαγιάτικα** (τρύπα στο ορθογώνιο μετά από undo ή διαγραφή γραμμής).
 *
 * ## 🔑 Ο φύλακας είναι ΕΝΑΣ: το πινέλο
 * Το {@link captureTableFormatBrush} αρνείται όταν έστω **ένα** κελί του ορθογωνίου δεν υπάρχει.
 * Άρα, όταν επιστρέψει φορτίο, κάθε θέση `source.firstRow + r` / `source.firstCol + c` είναι
 * **εγγυημένα** μέσα στο πλέγμα — και ο βρόχος από κάτω δεν χρειάζεται δικό του έλεγχο ορίων.
 * Ένας δεύτερος φύλακας εδώ θα ήταν δεύτερη απάντηση στο «τι σημαίνει έγκυρη περιοχή», που θα
 * μπορούσε κάποτε να είναι **πιο χαλαρή** από του πινέλου και να παραγάγει φορτίο με τρύπες.
 */
export function captureTableClipboard(
  model: PersistedTableModel,
  style: TableStyle,
  source: TableCellRangeBounds,
): TableClipboardPayload | null {
  const text = tableRangeToClipboardText(model, source);
  if (text === null) return null;

  // **Όλες** οι όψεις, πάντα: ποιες θα εφαρμοστούν το αποφασίζει η **επικόλληση**, όχι η
  // αντιγραφή. Το αντίθετο θα σήμαινε ότι ο χρήστης οφείλει να ξέρει τι θα θελήσει αργότερα —
  // και ότι το «Επικόλληση Ειδική ▸ Περιγράμματα» θα ήταν άδειο επειδή αντέγραψε «λάθος».
  const brush = captureTableFormatBrush(model, style, source, ALL_TABLE_FORMAT_FACETS);
  if (brush === null) return null;

  const resolved = resolveTableModel(model);
  const cells: (TableCell | undefined)[] = [];
  for (let r = 0; r < brush.rows; r++) {
    for (let c = 0; c < brush.columns; c++) {
      const row = resolved.rows[source.firstRow + r];
      const column = resolved.columns[source.firstCol + c];
      cells.push(getCell(resolved, row.id, column.id));
    }
  }

  return {
    rows: brush.rows,
    columns: brush.columns,
    cells,
    brush,
    origin: { row: source.firstRow, col: source.firstCol },
    text,
  };
}

/**
 * Το κελί στη θέση `(r, c)` του μοτίβου. Ολική — δες την εγγύηση μήκους στο {@link cells}.
 *
 * Ονομασμένη συνάρτηση και όχι ωμό `cells[r * columns + c]` στους καλούντες, για τον ίδιο λόγο
 * που υπάρχει το `tableFormatBrushCellAt`: η αριθμητική row-major γραμμένη σε δύο σημεία είναι
 * δύο ευκαιρίες να γραφτεί `columns` εκεί που χρειάζεται `rows` — σφάλμα που δεν σπάει τίποτα,
 * απλώς επικολλά το **λάθος κελί**.
 */
export function tableClipboardCellAt(
  payload: TableClipboardPayload,
  patternRow: number,
  patternCol: number,
): TableCell | undefined {
  return payload.cells[patternRow * payload.columns + patternCol];
}
