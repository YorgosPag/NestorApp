/**
 * ADR-739 Φ.Δ βήμα 8 — **η επιλογή περιοχής κελιών**. Καθαρή συνάρτηση, μηδέν React/DOM.
 *
 * Αδελφό του `table-cell-navigation.ts`, και για τον ίδιο λόγο: την **ίδια** ερώτηση («ποια
 * κελιά είναι μαρκαρισμένα;») θα την κάνουν ο ζωγράφος του καμβά, οι ζώνες `A B C`, η
 * αντιγραφή σε TSV, η επικόλληση, η γραμμή κατάστασης και — αργότερα — η λαβή συμπλήρωσης
 * (Φ.Δ.9) και οι τύποι (Φ.Δ.11). Μία απάντηση, δοκιμασμένη χωρίς DOM.
 *
 * ## 🔴 Η ΕΠΙΛΟΓΗ ΔΕΝ ΕΙΝΑΙ ΤΕΤΑΡΤΗ ΚΑΤΑΣΤΑΣΗ ΔΡΟΜΕΑ — ΕΙΝΑΙ ΕΚΤΑΣΗ
 * Ο πειρασμός είναι ένα `mode: 'select'` δίπλα στα `nav`/`enter`/`edit`. Το βήμα 4 απέρριψε
 * ήδη τέταρτη κατάσταση με το ίδιο επιχείρημα, και ισχύει αυτούσιο: ο δρομέας εξακολουθεί
 * να κάθεται σε **ένα** κελί (το **ενεργό**) και να δέχεται πληκτρολόγηση. Η περιοχή είναι
 * ένα **προαιρετικό δεύτερο άκρο** πάνω στην υπάρχουσα θέση.
 *
 * ## Γιατί ξεχωριστό πεδίο στο store και ΟΧΙ μέσα στο `TableCursorPosition`
 * Το {@link TableCursorPosition} είναι **καθαρή θέση**: το παράγουν το `tableCursorAt`, το
 * `tableFirstCursorPosition`, το `moveTableCursor` και το `parseTableCellReference` (μια
 * πληκτρολογημένη αναφορά `B3` στη γραμμή τύπων). Το τελευταίο δεν έχει **καμία** σχέση με
 * επιλογή· αν η έκταση ζούσε εκεί, κάθε παραγωγός θέσης θα υποχρεωνόταν να αποφασίσει γι'
 * αυτήν, και τρεις από τους τέσσερις θα έγραφαν `undefined` για λόγους τυπικούς. Το
 * `anchorColId` που **ήδη** ταξιδεύει εκεί είναι άλλο πράγμα: είναι ιδιότητα **της κίνησης**
 * (πού επιστρέφει το `Enter`), όχι δεύτερο σημείο του πλέγματος.
 *
 * ⚠️ **ΟΡΟΛΟΓΙΑ — ομώνυμα, όχι συνώνυμα.** Σε αυτό το αρχείο η λέξη «άγκυρα» σημαίνει
 * **πάντα** άγκυρα **συγχώνευσης** (`CellSpan.anchorRowId`), ποτέ «η μία άκρη της
 * επιλογής». Η άκρη λέγεται **ενεργό κελί** (Excel: *active cell*) και **τέλος περιοχής**.
 * Το `anchorIndexAt` του `table-cell-navigation` είναι το πρώτο, όχι το δεύτερο — και
 * ακριβώς γι' αυτό δεν επαναχρησιμοποιείται εδώ ως «anchor» της επιλογής.
 *
 * ## Τι κάνουν οι μεγάλοι (ερευνήθηκε 2026-08-01, ADR-739 §26)
 * - **AutoCAD `ACAD_TABLE`**: ασυνεχής επιλογή κελιών **δεν υπάρχει** (νήμα CADTutor: η
 *   απάντηση ήταν «μόνο με προγραμματισμό»). Ένα ορθογώνιο, τίποτα άλλο.
 * - **Excel**: η ασυνεχής επιλογή υπάρχει αλλά **δεν αντιγράφεται** — `Ctrl+C` απαντά
 *   «*That command cannot be used on multiple selections*» εκτός αν οι περιοχές
 *   ευθυγραμμίζονται σε κοινές γραμμές/στήλες.
 * ⇒ Το σχήμα των δεδομένων είναι **δύο κελιά**, όχι λίστα περιοχών. Απλούστερο **και** πιο
 *   σωστό — μια δομή που δεν μπορεί καν να εκφράσει την ασυνεχή επιλογή δεν μπορεί ούτε να
 *   την αφήσει να διαρρεύσει σε αντιγραφή που δεν την υποστηρίζει.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-range
 * @see bim/table/table-cell-navigation.ts — η κίνηση ενός κελιού (επαναχρησιμοποιείται εδώ)
 * @see bim/table/table-range-merge-snap.ts — ο ΜΗΧΑΝΙΣΜΟΣ του κουμπώματος σε συγχωνεύσεις
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §26
 */

import type { TableColumnId, TableModel, TableRowId } from '../../types/table';
import { cellPairIndices, type CellOrderSource } from './table-cell-order';
// ADR-739 §27.16 — ο ΜΗΧΑΝΙΣΜΟΣ του κουμπώματος ζει δίπλα· η ΑΠΟΦΑΣΗ «ποιος κουμπώνει»
// μένει εδώ (§27.15), γιατί μόνο εδώ ζει η πρόθεση του χρήστη.
import { snapToWholeMerges, type TableRectBounds } from './table-range-merge-snap';
import { moveTableCursor, type TableCursorMove } from './table-cell-navigation';
import type { TableLayout, TableRectMm } from './table-layout-types';

/** Ένα κελί, μόνο ως ταυτότητα — χωρίς κατάσταση δρομέα, χωρίς στήλη αγκύρωσης κίνησης. */
export interface TableCellRef {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
}

/**
 * Η επιλεγμένη περιοχή σε **δείκτες** του μοντέλου, **κλειστό** διάστημα και στα δύο άκρα
 * (`firstRow ≤ lastRow`, `firstCol ≤ lastCol`).
 *
 * Δείκτες και όχι ταυτότητες γιατί η έννοια «ορθογώνιο» **είναι** γεωμετρία θέσης: με
 * ταυτότητες, κάθε ερώτηση «είναι αυτό μέσα;» θα ήταν μια αναζήτηση. Οι ταυτότητες
 * επιστρέφονται από το {@link tableRangeMembership} για όποιον τις χρειάζεται.
 *
 * §27.16 — **ένας** ορισμός, δύο ονόματα: το σχήμα ζει δίπλα στην άλγεβρα που το χειρίζεται
 * (`TableRectBounds`) και επανεξάγεται εδώ με το όνομα που ξέρουν ήδη 30+ καταναλωτές. Ένα
 * δεύτερο `interface` με τα ίδια τέσσερα πεδία θα ήταν διπλότυπο που αποκλίνει σιωπηλά.
 */
export type TableCellRangeBounds = TableRectBounds;

/** Πόσο μεγάλη είναι — αυτό που δείχνει η **γραμμή κατάστασης** (§4.2). */
export interface TableRangeSize {
  readonly rows: number;
  readonly columns: number;
}

/**
 * Ιδιότητα μέλους ανά **άξονα**, όχι ανά κελί.
 *
 * ## Γιατί δύο σύνολα και όχι ένα σύνολο κλειδιών κελιού — ADR-735
 * Ένα `Set<CellKey>` για επιλογή 500 × 20 είναι **10.000 κλειδιά, χτισμένα ανά καρέ**. Είναι
 * κυριολεκτικά το σχήμα O(εμβαδόν) που ο ADR-735 πλήρωσε σε παραγωγή. Ένα ορθογώνιο όμως
 * είναι **γινόμενο** δύο διαστημάτων: «το κελί είναι μέσα» ⇔ «η γραμμή του είναι μέσα **και**
 * η στήλη του είναι μέσα». Άρα δύο σύνολα μεγέθους `γραμμές + στήλες` απαντούν **ακριβώς**
 * την ίδια ερώτηση σε O(1), με O(περίμετρος) κόστος κατασκευής.
 *
 * Δώρο: αυτά ακριβώς τα δύο σύνολα χρειάζονται και οι ζώνες `A B C` / `1 2 3` για να ανάψουν
 * ολόκληρη την περιοχή — μία δομή, δύο καταναλωτές, καμία δεύτερη απάντηση.
 */
export interface TableRangeMembership {
  readonly rowIds: ReadonlySet<TableRowId>;
  readonly colIds: ReadonlySet<TableColumnId>;
}

/**
 * Το **ακατέργαστο** ορθογώνιο δύο άκρων: κανονικοποιημένο, **χωρίς** κούμπωμα.
 *
 * `null` όταν κάποιο άκρο δεν υπάρχει στο μοντέλο — μπαγιάτικη επιλογή μετά από undo ή
 * διαγραφή γραμμής.
 *
 * ## 🔴 ADR-754 Β1 — γιατί έπαψε να είναι ιδιωτικό
 * Έγραφε εδώ «κανείς έξω δεν χρειάζεται περιοχή χωρίς δηλωμένο είδος», και ήταν σωστό όσο ο
 * μόνος καταναλωτής ήταν η **επιλογή** του χρήστη. Μια **αναφορά τύπου** είναι άλλο πράγμα:
 * το `=SUM(A1:B2)` διαβάζει **ακριβώς** τα τέσσερα κελιά που ονομάζει — αν κάποιο από αυτά
 * είναι μέρος συγχώνευσης, ο τύπος **δεν** μεγαλώνει για να την περικλείσει. Άρα το
 * περίγραμμα που δείχνει «τι διαβάζει αυτός ο τύπος» οφείλει να **μην** κουμπώνει· ένα
 * κουμπωμένο ορθογώνιο θα έδειχνε περιοχή μεγαλύτερη από όση αθροίζεται, δηλαδή θα έλεγε
 * ψέματα με το χρώμα.
 *
 * Η εναλλακτική ήταν έξι πανομοιότυπες γραμμές `indexById` + `Math.min/max` στο νέο module —
 * δηλαδή **δεύτερος ορισμός του «τι είναι ορθογώνιο κελιών»** (N.18). Εξαγωγή, όχι δίδυμο.
 *
 * ⚠️ ADR-754 Γ1 — η προειδοποίηση της προηγούμενης παραγράφου **δεν αρκούσε**: οι έξι γραμμές
 * ξαναγεννήθηκαν άλλες δύο φορές με άλλα ονόματα μεταβλητών. Πλέον η μετάφραση ζει στο
 * {@link cellPairIndices} και εδώ μένει **μόνο** η κανονικοποίηση, που είναι το πραγματικό
 * νόημα αυτής της συνάρτησης.
 */
export function rawTableCellRangeBounds(
  model: TableModel,
  a: TableCellRef,
  b: TableCellRef,
): TableCellRangeBounds | null {
  const pair = cellPairIndices(model, a, b);
  if (pair === null) return null;

  return {
    firstRow: Math.min(pair.fromRow, pair.toRow),
    lastRow: Math.max(pair.fromRow, pair.toRow),
    firstCol: Math.min(pair.fromCol, pair.toCol),
    lastCol: Math.max(pair.fromCol, pair.toCol),
  };
}

/**
 * Η περιοχή ανάμεσα σε δύο κελιά — **κανονικοποιημένη** και **κουμπωμένη** σε ολόκληρες
 * συγχωνεύσεις. Δηλαδή: η σημασιολογία της **περιοχής** ({@link TableSelectionKind}
 * `'range'`), εκφρασμένη σε δύο σκέτες γωνίες.
 *
 * `null` όταν κάποιο από τα δύο άκρα δεν υπάρχει στο μοντέλο: μπαγιάτικη επιλογή μετά από
 * undo ή διαγραφή γραμμής. Ο καλών οφείλει να τη σβήσει, όχι να μαντέψει — ίδια σύμβαση
 * με το `moveTableCursor`.
 */
export function resolveTableCellRange(
  model: TableModel,
  activeCell: TableCellRef,
  rangeEnd: TableCellRef,
): TableCellRangeBounds | null {
  const bounds = rawTableCellRangeBounds(model, activeCell, rangeEnd);
  return bounds ? snapToWholeMerges(model, bounds) : null;
}

/**
 * 🔴 ADR-739 §27.15 — **ΤΙ ΔΙΑΛΕΞΕ ο χρήστης**, όχι πόσο μεγάλο βγήκε.
 *
 * | είδος | πώς γεννιέται | κουμπώνει σε συγχωνεύσεις; |
 * |---|---|---|
 * | `range`  | `Shift+κλικ`, `Shift+βέλος`, σύρση κελιού→κελιού, `Ctrl+A` | **ΝΑΙ** |
 * | `column` | κλικ/σύρση στη ζώνη με τα γράμματα | **ΟΧΙ** |
 * | `row`    | κλικ/σύρση στη ζώνη με τους αριθμούς | **ΟΧΙ** |
 *
 * ## Γιατί οι δύο άξονες ΔΕΝ κουμπώνουν — και γιατί δεν είναι απόκλιση από τους μεγάλους
 * Το κούμπωμα (§26.5) γεννήθηκε για την **περιοχή**, όπου είναι σωστό: μισό συγχωνευμένο
 * κελί δεν αντιγράφεται, δεν σβήνεται και δεν γεμίζει. Πάνω σε **άξονα** όμως δίνει
 * παράλογο αποτέλεσμα, και ο πίνακας της σκηνής το δείχνει ακριβώς: η γραμμή τίτλου είναι
 * συγχωνευμένη σε **όλες** τις στήλες, οπότε «κλικ στο `B`» έδινε στήλη `B` → ένωση με τον
 * τίτλο → **ολόκληρος ο πίνακας μαρκαρισμένος** (Giorgio, 2026-08-02).
 *
 * Το ίδιο ελάττωμα είχε το **Excel 2003** και το **διόρθωσε στο 2010**: κλικ στο γράμμα
 * στήλης επιλέγει μόνο αυτή τη στήλη, ακόμα κι όταν συγχώνευση τη διασχίζει. Τα Google
 * Sheets το κάνουν ακόμα — καταγεγραμμένο ως ενόχληση. Άρα δεν εφευρίσκουμε συμπεριφορά:
 * **φτάνουμε το σημερινό Excel** και περνάμε τα Sheets.
 *
 * ## Γιατί το είδος ζει στην ΕΠΙΛΟΓΗ και όχι στον καλούντα
 * Ο ζωγράφος βλέπει **μόνο** δύο γωνίες — δεν ξέρει, και δεν πρέπει να ξέρει, αν τις
 * γέννησε κλικ σε γράμμα ή σύρση σε κελιά. Χωρίς το είδος αποθηκευμένο, η πρόθεση χάνεται
 * τη στιγμή που γράφεται η επιλογή και **καμία** ανάκτησή της δεν είναι δυνατή («η περιοχή
 * πιάνει όλες τις γραμμές» δεν σημαίνει «ο χρήστης διάλεξε στήλη»: μπορεί να την έσυρε).
 *
 * ⚠️ Το λεξιλόγιο είναι **δανεικό, όχι νέο**: `'column'`/`'row'` είναι ακριβώς οι λέξεις του
 * `TableIndicatorHit.axis` — μία έννοια, ένα ζευγάρι λέξεων, κανένα τέταρτο λεξιλόγιο.
 */
export type TableSelectionKind = 'range' | 'column' | 'row';

/**
 * Μια επιλογή όπως τη γράφει ο χρήστης: **δύο γωνίες + η πρόθεση**. Ζει εδώ, δίπλα στον
 * κανόνα που την ερμηνεύει· το store την κρατά αυτούσια ως κατάστασή του.
 */
export interface TableSelectionSpan {
  readonly from: TableCellRef;
  readonly to: TableCellRef;
  readonly kind: TableSelectionKind;
}

/**
 * «Ποιος άξονας, και ποιο μέλος του» — δηλαδή ό,τι χρειάζεται το {@link wholeAxisSelection}.
 *
 * ⚠️ Είναι **δομικά** το υποσύνολο του `TableIndicatorHit` (που κουβαλά επιπλέον `index`),
 * ώστε ένα `hit` να περνά αυτούσιο **χωρίς** αυτό το αρχείο — καθαρή γνώση **μοντέλου** — να
 * αποκτήσει εξάρτηση από τη **γεωμετρία σε mm** των ζωνών. Δεν είναι δεύτερο λεξιλόγιο: οι
 * λέξεις `'column'`/`'row'` είναι κυριολεκτικά οι ίδιες, όπως ορίζει το
 * {@link TableSelectionKind}.
 */
export type TableAxisTarget =
  | { readonly axis: 'column'; readonly colId: TableColumnId }
  | { readonly axis: 'row'; readonly rowId: TableRowId };

/**
 * Τα όρια μιας επιλογής — **ο ΕΝΑΣ δρόμος** από «τι διάλεξε ο χρήστης» σε «ποια κελιά
 * είναι μέσα». Ό,τι ρωτά ο ζωγράφος, η αντιγραφή, το σβήσιμο και η γραμμή κατάστασης.
 *
 * Το κούμπωμα εφαρμόζεται **μόνο** στην περιοχή — δες {@link TableSelectionKind} για το
 * γιατί. `null` με την ίδια σύμβαση: μπαγιάτικο άκρο ⇒ ο καλών σβήνει, δεν μαντεύει.
 */
export function resolveTableSelectionBounds(
  model: TableModel,
  selection: TableSelectionSpan,
): TableCellRangeBounds | null {
  const bounds = rawTableCellRangeBounds(model, selection.from, selection.to);
  if (!bounds) return null;
  return selection.kind === 'range' ? snapToWholeMerges(model, bounds) : bounds;
}

/**
 * 🔴 ADR-739 §27.16 Ε2 — **Η ΜΙΑ ΕΠΕΚΤΑΣΗ.** Η άγκυρα μένει, το **είδος** μένει, κουνιέται
 * μόνο το τέλος.
 *
 * ## Γιατί υπάρχει ως ονομασμένη συνάρτηση αντί για τρία object literals
 * Ο κανόνας γεννήθηκε στο `Shift+βέλος` (§27.15) και ήταν **μία γραμμή** μέσα στο
 * `use-table-range-actions`. Το `Shift+κλικ` σε γράμμα στήλης ζητά **τον ίδιο ακριβώς**
 * κανόνα από άλλο αρχείο. Δύο αντίγραφα μιας γραμμής δεν πιάνονται από το jscpd (κάτω από
 * τα 50 tokens) και **αποκλίνουν σιωπηλά**: αρκεί το ένα να ξεχάσει το `kind` για να
 * ξανακουμπώσει η επιλογή στη συγχώνευση του τίτλου — δηλαδή να επιστρέψει ακριβώς το
 * σφάλμα που έλυσε το §27.15, από την πίσω πόρτα.
 *
 * ⚠️ **Δεν κανονικοποιεί και δεν κουμπώνει**: παράγει την **πρόθεση**, όχι τα όρια. Η
 * ερμηνεία είναι δουλειά του {@link resolveTableSelectionBounds} — ο ΕΝΑΣ δρόμος.
 */
export function extendTableSelectionTo(
  current: TableSelectionSpan,
  rangeEnd: TableCellRef,
): TableSelectionSpan {
  return { from: current.from, to: rangeEnd, kind: current.kind };
}

/**
 * 🔴 ADR-739 §27.16 Ε2 — **Ο ΕΝΑΣ ΟΡΙΣΜΟΣ ΤΗΣ «ΟΛΟΚΛΗΡΗΣ ΣΤΗΛΗΣ/ΓΡΑΜΜΗΣ».**
 *
 * Κλικ στο «B» ⇒ `(πρώτη γραμμή, B) → (τελευταία γραμμή, B)`, είδος `'column'`. Το ενεργό
 * κελί πάει στο `from`, όπως στο Excel: εκεί αρχίζει η πληκτρολόγηση αν συνεχίσεις να γράφεις.
 *
 * ## Γιατί εδώ και όχι στον χειριστή του ποντικιού
 * Την **ίδια** απάντηση τη ζητούν ήδη **τρεις**: το κλικ στη ζώνη, το **κινούμενο άκρο** της
 * σύρσης πάνω στη ζώνη, και τώρα το `Shift+κλικ` σε δεύτερο γράμμα. Πριν από αυτή τη
 * συνάρτηση ήταν γραμμένη **δύο** φορές μέσα στον ίδιο χειριστή (`selectWholeAxis` και
 * `axisEndAt`) με το ίδιο `rows[rows.length - 1]` — και ένας τρίτος καταναλωτής θα έκανε
 * τρία. Το λεξιλόγιο (`'column'`/`'row'`) είναι **δανεικό** από το `TableIndicatorHit.axis`,
 * ακριβώς όπως το ορίζει το {@link TableSelectionKind}: μία έννοια, ένα ζευγάρι λέξεων.
 *
 * ⚠️ Το είδος **δεν** είναι `'range'`, άρα το κούμπωμα **δεν** τρέχει — αυτή είναι ολόκληρη
 * η διόρθωση του §27.15 και ζει τώρα στην **πηγή** της επιλογής άξονα, όχι στους καλούντες.
 *
 * `null` σε πίνακα χωρίς γραμμές ή χωρίς στήλες.
 */
export function wholeAxisSelection(
  model: TableModel,
  hit: TableAxisTarget,
): TableSelectionSpan | null {
  const { rows, columns } = model;
  if (rows.length === 0 || columns.length === 0) return null;

  return hit.axis === 'column'
    ? {
        from: { rowId: rows[0].id, colId: hit.colId },
        to: { rowId: rows[rows.length - 1].id, colId: hit.colId },
        kind: 'column',
      }
    : {
        from: { rowId: hit.rowId, colId: columns[0].id },
        to: { rowId: hit.rowId, colId: columns[columns.length - 1].id },
        kind: 'row',
      };
}

/**
 * `Ctrl+A` — ολόκληρο το πλέγμα. `null` για πίνακα χωρίς γραμμές ή χωρίς στήλες.
 *
 * Δεν περνά από το {@link snapToWholeMerges}: όλες οι συγχωνεύσεις είναι ήδη μέσα, εξ
 * ορισμού. Η κλήση θα ήταν ταυτοτική και θα κόστιζε μια σάρωση.
 */
export function tableWholeGridRange(model: TableModel): TableCellRangeBounds | null {
  if (model.rows.length === 0 || model.columns.length === 0) return null;
  return {
    firstRow: 0,
    lastRow: model.rows.length - 1,
    firstCol: 0,
    lastCol: model.columns.length - 1,
  };
}

/**
 * 🔴 ADR-739 §43 — **ΚΑΛΥΠΤΕΙ Η ΠΕΡΙΟΧΗ ΟΛΟΚΛΗΡΟ ΤΟ ΠΛΕΓΜΑ;**
 *
 * Υπάρχει επειδή το τετραγωνάκι της γωνίας πρέπει να **δείχνει** αν είναι πατημένο — και η
 * απάντηση οφείλει να είναι **παράγωγο** της επιλογής, ποτέ δεύτερη σημαία σε store. Μια
 * σημαία θα αποκλίνει την πρώτη φορά που η επιλογή αλλάξει από αλλού (`Shift+βέλος`, undo,
 * διαγραφή γραμμής) χωρίς να περάσει από το κουμπί.
 *
 * 🔑 Ρωτά **το ίδιο** {@link tableWholeGridRange} που **γράφει** το `selectAll()`. Άρα «τι
 * βάφεται» και «τι γράφεται» δεν είναι δύο εκφράσεις που τυχαίνει να συμφωνούν: είναι η ίδια
 * έκφραση, ρωτημένη από δύο μεριές. Αν αύριο αλλάξει ο ορισμός του «όλα» (π.χ. κρυμμένες
 * γραμμές), αλλάζουν **μαζί**.
 *
 * ⚠️ Σύγκριση σε **δείκτες** και όχι σε ταυτότητες: το `tableWholeGridRange` επιστρέφει
 * ούτως ή άλλως δείκτες, και τα όρια που φτάνουν εδώ έχουν ήδη περάσει από το
 * {@link resolveTableSelectionBounds} — δηλαδή είναι κανονικοποιημένα (ταξινομημένα,
 * κουμπωμένα σε συγχωνεύσεις). Μια σύγκριση σε `rowId`/`colId` θα ήταν τρίτο λεξιλόγιο.
 */
export function isTableWholeGridRange(
  model: TableModel,
  bounds: TableCellRangeBounds,
): boolean {
  const whole = tableWholeGridRange(model);
  return (
    whole !== null
    && bounds.firstRow === whole.firstRow
    && bounds.lastRow === whole.lastRow
    && bounds.firstCol === whole.firstCol
    && bounds.lastCol === whole.lastCol
  );
}

/** Πόσες γραμμές × πόσες στήλες — για τη γραμμή κατάστασης (§4.2). */
export function tableRangeSize(bounds: TableCellRangeBounds): TableRangeSize {
  return {
    rows: bounds.lastRow - bounds.firstRow + 1,
    columns: bounds.lastCol - bounds.firstCol + 1,
  };
}

/**
 * 🔴 ADR-739 §69 — **πόσο πιάνει αυτή η επιλογή**, από την πρόθεση κατευθείαν σε αριθμούς.
 *
 * Η σύνθεση των δύο από πάνω, ονομασμένη επειδή τη ρωτούν δύο μεριές (το πλαίσιο ονόματος
 * όσο σέρνεται το χέρι, και τα tests του) και επειδή η **σειρά** είναι το ουσιώδες: πρώτα
 * {@link resolveTableSelectionBounds} — δηλαδή **με** το κούμπωμα σε ολόκληρες συγχωνεύσεις
 * — και μόνο μετά η αφαίρεση. Η αντίστροφη σειρά θα έδινε `1R x 1C` πάνω σε επιλογή που
 * φωτίζει τέσσερα κελιά, δηλαδή αριθμό που διαφωνεί με την οθόνη.
 *
 * `null` με τη σύμβαση όλου του αρχείου: μπαγιάτικο άκρο ⇒ ο καλών δεν δείχνει τίποτα.
 */
export function tableSelectionSize(
  model: TableModel,
  selection: TableSelectionSpan,
): TableRangeSize | null {
  const bounds = resolveTableSelectionBounds(model, selection);
  return bounds === null ? null : tableRangeSize(bounds);
}

/** Είναι η περιοχή ένα και μόνο κελί; Τότε **δεν** είναι πραγματική επιλογή (§4.2). */
export function isSingleCellRange(bounds: TableCellRangeBounds): boolean {
  return bounds.firstRow === bounds.lastRow && bounds.firstCol === bounds.lastCol;
}

/** Οι ταυτότητες των γραμμών και των στηλών της περιοχής — δες {@link TableRangeMembership}. */
export function tableRangeMembership(
  model: TableModel,
  bounds: TableCellRangeBounds,
): TableRangeMembership {
  const rowIds = new Set<TableRowId>();
  const colIds = new Set<TableColumnId>();
  for (let r = Math.max(bounds.firstRow, 0); r <= Math.min(bounds.lastRow, model.rows.length - 1); r++) {
    rowIds.add(model.rows[r].id);
  }
  for (let c = Math.max(bounds.firstCol, 0); c <= Math.min(bounds.lastCol, model.columns.length - 1); c++) {
    colIds.add(model.columns[c].id);
  }
  return { rowIds, colIds };
}

/**
 * Οι ταυτότητες κάθε κελιού της περιοχής, σε σειρά **γραμμή × στήλη** — η ίδια σειρά που
 * εγγυάται το `toPersistedTableModel`, ώστε η αντιγραφή σε TSV να είναι ντετερμινιστική.
 *
 * ⚠️ Επιστρέφει **και τα καλυμμένα** κελιά μιας συγχώνευσης, όχι μόνο τις άγκυρες. Δεν είναι
 * παράλειψη: το TSV είναι **ορθογώνιο πλέγμα**, και μια συγχώνευση 1×3 πρέπει να δώσει το
 * κείμενό της στην πρώτη στήλη και **κενά** στις άλλες δύο — αλλιώς οι επόμενες στήλες
 * ολισθαίνουν αριστερά και ο πίνακας που επικολλάται στο Excel βγαίνει στραβός. Το κενό
 * έρχεται δωρεάν: το `cells` είναι **αραιό** και μόνο η άγκυρα κρατά εγγραφή, οπότε το
 * `getPersistedCellText` ενός καλυμμένου κελιού επιστρέφει ήδη κενό αλφαριθμητικό.
 *
 * ## Γιατί δέχεται {@link CellOrderSource} και όχι `TableModel` (ADR-750 Φ6, N.18)
 * Διαβάζει **μόνο** τους δύο άξονες — ποτέ `cells`/`merges`. Η στενότερη όψη δέχεται και το
 * `PersistedTableModel`, και αυτό **δεν** είναι ευκολία: το `table-cell-diagonal-ops.ts`
 * κρατούσε ιδιωτικό `cellsInBounds` **ταυτόσημο σώμα 12 γραμμών**, γεννημένο αποκλειστικά
 * επειδή η υπογραφή εδώ ζητούσε `TableModel`. Δύο σώματα για την ίδια ερώτηση σημαίνουν δύο
 * απαντήσεις στο «τι γίνεται με μπαγιάτικα όρια» — και το ένα από τα δύο θα το μάθαινε αργά.
 * Η διεύρυνση είναι καθαρά προσθετική: κάθε `TableModel` **είναι** ήδη `CellOrderSource`.
 */
export function tableRangeCellRefs(
  model: CellOrderSource,
  bounds: TableCellRangeBounds,
): readonly TableCellRef[] {
  const refs: TableCellRef[] = [];
  const lastRow = Math.min(bounds.lastRow, model.rows.length - 1);
  const lastCol = Math.min(bounds.lastCol, model.columns.length - 1);
  for (let r = Math.max(bounds.firstRow, 0); r <= lastRow; r++) {
    for (let c = Math.max(bounds.firstCol, 0); c <= lastCol; c++) {
      refs.push({ rowId: model.rows[r].id, colId: model.columns[c].id });
    }
  }
  return refs;
}

/**
 * Το ορθογώνιο της περιοχής σε **sheet-mm του πλαισίου** — ό,τι χρειάζεται ο ζωγράφος.
 *
 * ## Γιατί ΕΝΑ ορθογώνιο και όχι λίστα κελιών
 * Η περιοχή είναι ορθογώνια εξ ορισμού (και κουμπωμένη σε ολόκληρες συγχωνεύσεις), οπότε
 * τα άκρα της αρκούν: αριστερή ακμή της πρώτης στήλης → δεξιά ακμή της τελευταίας, πάνω
 * ακμή της πρώτης γραμμής → κάτω ακμή της τελευταίας. Μια λίστα κελιών θα έδινε στον
 * ζωγράφο O(εμβαδόν) δουλειά ανά καρέ για την **ίδια** εικόνα (ADR-735).
 *
 * ⚠️ Δέχεται τη **διάταξη** και όχι το μοντέλο: μόνο εκείνη ξέρει πλάτη και ύψη. Οι δείκτες
 * είναι κοινοί — η διάταξη κρατά μία εγγραφή ανά γραμμή/στήλη του μοντέλου, στην ίδια σειρά
 * (το ίδιο βασίζει ήδη το `tableColumnTicks` για να παράγει `A`, `B`, `C`…).
 *
 * `null` όταν τα όρια δεν τέμνουν τη διάταξη — άδειος πίνακας ή μπαγιάτικη επιλογή.
 */
export function tableRangeRectMm(
  layout: TableLayout,
  bounds: TableCellRangeBounds,
): TableRectMm | null {
  const firstCol = layout.columns[Math.max(bounds.firstCol, 0)];
  const lastCol = layout.columns[Math.min(bounds.lastCol, layout.columns.length - 1)];
  const firstRow = layout.rows[Math.max(bounds.firstRow, 0)];
  const lastRow = layout.rows[Math.min(bounds.lastRow, layout.rows.length - 1)];
  if (!firstCol || !lastCol || !firstRow || !lastRow) return null;
  return {
    x: firstCol.xMm,
    y: firstRow.yMm,
    w: lastCol.xMm + lastCol.widthMm - firstCol.xMm,
    h: lastRow.yMm + lastRow.heightMm - firstRow.yMm,
  };
}

/**
 * `Shift + βέλος` — μετακινεί **το τέλος** της περιοχής κατά ένα βήμα· το **ενεργό κελί**
 * μένει ακίνητο (Excel).
 *
 * 🔴 **Μηδέν νέα λογική πλοήγησης**: δανείζεται αυτούσιο το {@link moveTableCursor}. Έτσι ο
 * κανόνας «άλλαξε ο ιδιοκτήτης» — που λύνει τις συγχωνεύσεις — ισχύει αυτούσιος και για την
 * επέκταση, χωρίς να ξαναγραφτεί ούτε μία γραμμή. Ένα δεύτερο `stepOut` εδώ θα ήταν ακριβώς
 * ο structural clone που πιάνει το CHECK 3.28.
 *
 * ## ⚠️ Η στήλη αγκύρωσης της συνθετικής θέσης είναι ΑΔΙΑΦΟΡΗ — και είναι μετρημένο
 * Το `TableCursorPosition` απαιτεί `anchorColId`, αλλά **καμία** από τις κινήσεις που
 * φτάνουν εδώ δεν τη διαβάζει: την καταναλώνει μόνο το `commitVertically`, δηλαδή τα
 * `commitDown`/`commitUp` — και αυτά αντιστοιχούν στο `Enter`/`Shift+Enter`, που το
 * {@link resolveTableCellKeyIntent} χαρτογραφεί ρητά σε **κίνηση**, ποτέ σε επέκταση
 * (`Shift+Enter` = `commitUp`, όχι `extend`). Οι επεκτάσιμες κινήσεις είναι τα βέλη και τα
 * `Home`/`End`, που περνούν από `stepOut`/`rowEdge` χωρίς να την αγγίξουν.
 *
 * Ο έλεγχος μεταλλάξεων το επιβεβαίωσε: αλλοιώνοντας αυτό το πεδίο, **κανένα** test δεν
 * κοκκινίζει — ισοδύναμη μετάλλαξη. Γράφεται `rangeEnd.colId` επειδή είναι η μόνη τιμή που
 * **σημαίνει** κάτι («η στήλη όπου βρίσκομαι»), όχι επειδή την χρειάζεται κάποιος. Αν
 * κάποτε μια κάθετη-με-αγκύρωση κίνηση γίνει επεκτάσιμη, αυτή η γραμμή παύει να είναι
 * αδιάφορη — και το test «οι επεκτάσιμες κινήσεις δεν διαβάζουν αγκύρωση» θα το πει.
 *
 * `null` στην άκρη του πλέγματος ⇒ το τέλος μένει όπου είναι (ποτέ αναδίπλωση).
 */
export function extendTableCellRangeEnd(
  model: TableModel,
  rangeEnd: TableCellRef,
  move: TableCursorMove,
): TableCellRef | null {
  const next = moveTableCursor(
    model,
    { rowId: rangeEnd.rowId, colId: rangeEnd.colId, anchorColId: rangeEnd.colId },
    move,
  );
  return next ? { rowId: next.rowId, colId: next.colId } : null;
}
