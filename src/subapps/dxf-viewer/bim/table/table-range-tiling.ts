/**
 * 🔴 ADR-768 Φ2 — **ΠΟΙΟ ΚΕΛΙ ΤΗΣ ΠΗΓΗΣ ΑΝΤΙΣΤΟΙΧΕΙ ΣΕ ΠΟΙΟ ΚΕΛΙ ΤΟΥ ΣΤΟΧΟΥ**, όταν τα δύο
 * ορθογώνια **δεν** έχουν το ίδιο σχήμα. Καθαρή γεωμετρία: μηδέν μοντέλο, μηδέν εγγραφή.
 *
 * ## Γιατί εξήχθη από το `table-fill-apply.ts`
 * Ο κυκλικός δείκτης ζούσε ως ιδιωτική `fillCells` της λαβής συμπλήρωσης. Το **πινέλο
 * μορφοποίησης** κάνει την **ίδια ακριβώς** ερώτηση — και είναι η ψυχή της ισοδυναμίας με το
 * Excel (γραμμές 6/7/8 της προδιαγραφής του ADR-768):
 *
 * ```
 *   πηγή εύρος    → στόχος ΕΝΑ κελί      : η μορφή απλώνεται με το ΣΧΗΜΑ της πηγής
 *   πηγή εύρος    → στόχος ΜΕΓΑΛΥΤΕΡΟ    : ΕΠΑΝΑΛΗΨΗ του μοτίβου
 *   πηγή ΕΝΑ κελί → στόχος εύρος         : ίδια μορφή σε ΟΛΑ
 * ```
 *
 * Και οι τρεις είναι **η ίδια** συνάρτηση: με ύψος/πλάτος πηγής `1` το υπόλοιπο είναι πάντα
 * `0`, οπότε η τρίτη γραμμή δεν είναι ξεχωριστός κλάδος. Ένα δεύτερο αντίγραφο εδώ θα ήταν
 * sibling clone πάνω από το κατώφλι του jscpd (CHECK 3.28 / N.18) — και, χειρότερα, δύο
 * σημεία που μπορούν κάποτε να μάθουν διαφορετικό πρόσημο υπολοίπου, δηλαδή να συμφωνούν
 * προς τα κάτω και να διαφωνούν προς τα πάνω.
 *
 * ## 🔑 ΤΟ ΠΡΟΣΗΜΟ ΤΟΥ ΥΠΟΛΟΙΠΟΥ **ΕΙΝΑΙ** Η ΟΡΘΟΤΗΤΑ
 * Το `%` της JavaScript κρατά το πρόσημο του **μερισταίου**, οπότε γέμισμα ή βάψιμο **προς τα
 * πάνω/αριστερά** από την πηγή δίνει αρνητικό δείκτη και διαβάζει εκτός ορθογωνίου. Το
 * {@link positiveMod} το κλείνει, και το κλείνει **μία** φορά για όλους τους καλούντες.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-tiling
 * @see bim/table/table-fill-apply.ts — ο πρώτος καταναλωτής (λαβή συμπλήρωσης, ADR-754 Γ4)
 * @see bim/table/table-format-paint.ts — ο δεύτερος (πινέλο μορφοποίησης, ADR-768)
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import { positiveMod } from '@/lib/number/positive-mod';
import type { TableModel } from '../../types/table';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';

/**
 * Το **μοτίβο**: πόσο μεγάλο είναι και πού «κουμπώνει» η αρχή του πάνω στο πλέγμα.
 *
 * 🔴 Η **αφετηρία** είναι παράμετρος και όχι σταθερά, επειδή οι δύο καταναλωτές έχουν
 * πραγματικά διαφορετική:
 *
 * ```
 *   λαβή συμπλήρωσης → αφετηρία = η ΠΗΓΗ   (σέρνεις από αυτήν· είναι γειτονική εξ ορισμού)
 *   πινέλο μορφής    → αφετηρία = ο ΣΤΟΧΟΣ (η πηγή μπορεί να είναι οπουδήποτε — ή σβησμένη)
 * ```
 *
 * Χωρίς αυτήν, το πινέλο θα ήταν αναγκασμένο να γράψει δικό του `positiveMod` — δηλαδή τον
 * **δεύτερο** κυκλικό κανόνα που αυτό το module υπάρχει για να αποτρέψει.
 */
export interface TableTilePattern {
  readonly rows: number;
  readonly columns: number;
  readonly originRow: number;
  readonly originCol: number;
}

/**
 * Ένα κελί του στόχου: **πού** είναι στο πλέγμα, και **ποιο κελί του μοτίβου** του αναλογεί.
 *
 * Οι δείκτες πλέγματος δεν είναι πλεονασμός: τους χρειάζεται ο ζωγράφος μορφής για να ρωτήσει
 * τον επιλυτή ακμών ({@link resolveTableEdgeSpec}), που δέχεται **θέσεις** και όχι ταυτότητες.
 * Τους έχει ήδη ο βρόχος και τους πετούσε.
 */
export interface TableTiledSlot {
  readonly at: TableCellRef;
  readonly rowIndex: number;
  readonly colIndex: number;
  /** `0 … pattern.rows − 1`. */
  readonly patternRow: number;
  /** `0 … pattern.columns − 1`. */
  readonly patternCol: number;
}

/**
 * 🔑 **Ο ΕΝΑΣ ΚΥΚΛΙΚΟΣ ΚΑΝΟΝΑΣ** — κάθε κελί του στόχου, με τον δείκτη μοτίβου του.
 *
 * Ο στόχος **ψαλιδίζεται** στα όρια του μοντέλου: μπαγιάτικα όρια μετά από undo ή διαγραφή
 * γραμμής είναι φυσιολογικό ενδιάμεσο στάδιο, όχι σφάλμα — ίδια σύμβαση ανοχής με το
 * `forEachResolvedCellStyle`.
 *
 * Επιστρέφει **κενό** όταν ο στόχος δεν τέμνει το μοντέλο, ή όταν το μοτίβο είναι εκφυλισμένο
 * (μηδενικό ύψος/πλάτος): διαίρεση με το μηδέν δεν είναι «κανένα κελί», είναι `NaN` που
 * ταξιδεύει σιωπηλά μέχρι να γίνει `undefined` κελί.
 */
export function tileTableTarget(
  model: TableModel,
  target: TableCellRangeBounds,
  pattern: TableTilePattern,
): readonly TableTiledSlot[] {
  if (pattern.rows <= 0 || pattern.columns <= 0) return [];

  const slots: TableTiledSlot[] = [];
  const lastRow = Math.min(target.lastRow, model.rows.length - 1);
  const lastCol = Math.min(target.lastCol, model.columns.length - 1);

  for (let r = Math.max(target.firstRow, 0); r <= lastRow; r++) {
    for (let c = Math.max(target.firstCol, 0); c <= lastCol; c++) {
      slots.push({
        at: { rowId: model.rows[r].id, colId: model.columns[c].id },
        rowIndex: r,
        colIndex: c,
        patternRow: positiveMod(r - pattern.originRow, pattern.rows),
        patternCol: positiveMod(c - pattern.originCol, pattern.columns),
      });
    }
  }
  return slots;
}

/**
 * Ένα κελί του στόχου: **πού** γράφεται, **από πού** διαβάζει, και **πόσο** μετατοπίστηκε.
 *
 * Η μετατόπιση δεν είναι πλεονασμός: τη χρειάζεται η **ολίσθηση τύπων** της λαβής
 * συμπλήρωσης ({@link offsetTableFormula}), και υπολογίζεται εδώ δωρεάν — είναι η αφαίρεση
 * που μόλις έγινε. Ο υπολογισμός της αλλού θα σήμαινε ότι κάποιος ξαναβρίσκει τον
 * δείκτη-πηγή, δηλαδή **δεύτερη** εκτέλεση του ίδιου κυκλικού κανόνα.
 */
export interface TableTiledCell {
  readonly at: TableCellRef;
  readonly from: TableCellRef;
  /** Γραμμές στόχου − γραμμές πηγής (θετικό = προς τα κάτω). */
  readonly rows: number;
  /** Στήλες στόχου − στήλες πηγής (θετικό = προς τα δεξιά). */
  readonly columns: number;
  /**
   * 🔴 ADR-828 §4 — **Η ΘΕΣΗ ΣΤΗ ΣΕΙΡΑ**: `rowIndex − pattern.originRow`. Αρνητική προς τα
   * πάνω.
   *
   * Δεν είναι το ίδιο με το {@link rows}. Το `rows` είναι η **μετατόπιση από το κελί-πηγή
   * που αντιγράφεται** (κυκλική, ξαναμηδενίζεται σε κάθε επανάληψη του μοτίβου)· αυτό είναι
   * η **απόσταση από την αρχή του μοτίβου**, που μεγαλώνει μονότονα. Η πρώτη απαντά «τι
   * αντιγράφω»· η δεύτερη «πόσο μακριά έχω φτάσει», δηλαδή τον **πολλαπλασιαστή του βήματος**
   * μιας σειράς. Δύο ερωτήσεις, δύο πεδία.
   *
   * 🔑 **Γιατί αυτό και όχι ο δείκτης κύκλου.** Ο κύκλος (`⌊(r − αρχή) / γραμμές⌋`)
   * υπολογίζεται ήδη και πετιέται από το {@link positiveMod}. Θα ήταν όμως το **λάθος**
   * εξαγόμενο: η σειρά χρειάζεται `patternRow + κύκλος·γραμμές`, που τηλεσκοπεί ακριβώς σε
   * `r − αρχή`. Εξάγοντας τον κύκλο θα αναγκάζαμε τον καλούντα να ξαναπολλαπλασιάσει —
   * δηλαδή να **ξαναεκτελέσει** σε δεύτερο module την αποσύνθεση που μόλις έγινε εδώ.
   * Εξάγεται η **απάντηση**, όχι τα συστατικά της. Ίδια δοκτρίνα με τη μετατόπιση παραπάνω.
   */
  readonly rowOrdinal: number;
  /** `colIndex − pattern.originCol`. Αρνητική προς τα αριστερά. Δες {@link rowOrdinal}. */
  readonly colOrdinal: number;
}

/**
 * Η αντιστοίχιση «κάθε κελί του στόχου ← ποιο **κελί** της πηγής» — η όψη που θέλει η λαβή
 * συμπλήρωσης, χτισμένη πάνω στο {@link tileTableTarget}.
 *
 * ⚠️ Η **πηγή** δεν ψαλιδίζεται: αν είναι μπαγιάτικη, ο κυκλικός δείκτης θα έδειχνε σε γραμμή
 * που δεν υπάρχει, οπότε ο καλών οφείλει να έχει ήδη επιλύσει τα όριά της
 * (`resolveTableSelectionBounds` / `tableFormatScopeBounds`) — και το κάνει.
 */
export function tileTableRange(
  model: TableModel,
  source: TableCellRangeBounds,
  target: TableCellRangeBounds,
): readonly TableTiledCell[] {
  const pattern: TableTilePattern = {
    rows: source.lastRow - source.firstRow + 1,
    columns: source.lastCol - source.firstCol + 1,
    originRow: source.firstRow,
    originCol: source.firstCol,
  };

  return tileTableTarget(model, target, pattern).map((slot) => {
    const sourceRow = source.firstRow + slot.patternRow;
    const sourceCol = source.firstCol + slot.patternCol;
    return {
      at: slot.at,
      from: { rowId: model.rows[sourceRow].id, colId: model.columns[sourceCol].id },
      rows: slot.rowIndex - sourceRow,
      columns: slot.colIndex - sourceCol,
      rowOrdinal: slot.rowIndex - pattern.originRow,
      colOrdinal: slot.colIndex - pattern.originCol,
    };
  });
}
