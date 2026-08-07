/**
 * 🔴 ADR-768 Φ3 — **ΤΙ ΡΟΥΦΑΕΙ ΤΟ ΠΙΝΕΛΟ.** Η ανάγνωση της μορφής ενός κελιού, επιλυμένη.
 *
 * Καθαρή συνάρτηση: μηδέν εγγραφή, μηδέν React, μηδέν DOM.
 *
 * ## 🔴 ΤΕΣΣΕΡΙΣ ΑΛΥΣΙΔΕΣ, ΜΙΑ ΑΠΑΝΤΗΣΗ — καμία τους δεν ξαναγράφεται εδώ
 * Η «μορφή ενός κελιού» δεν κληρονομείται με **έναν** κανόνα. Κάθε μία από τις τέσσερις έχει
 * ήδη τον ιδιοκτήτη της, και αυτό το module τους **ρωτά**:
 *
 * ```
 *   στυλ (8 πεδία)  → resolveCellStyle       (κελί ▸ γραμμή ▸ στήλη ▸ κλάση, §28.4 / Α6)
 *   μορφή αριθμού   → resolveCellNumberFormat (κελί ▸ γραμμή ▸ στήλη ▸ valueType, ADR-760)
 *   ξεχείλισμα      → resolveCellOverflow    (κελί ▸ στήλη ▸ προεπιλογή)
 *   περιγράμματα    → resolveTableEdgeSpec   (ρητή ακμή ▸ borderTop ▸ κλάση, ADR-750 §6.5)
 * ```
 *
 * Καμία από τις τέσσερις δεν είναι γραμμένη εδώ, και αυτό είναι ολόκληρο το νόημα του αρχείου:
 * μια πέμπτη υλοποίηση της προτεραιότητας θα ήταν αόρατη όσο συμφωνεί, και θα άρχιζε να λέει
 * ψέματα την **πρώτη μέρα** που κάποια από τις τέσσερις μάθει νέο επίπεδο. Είναι ακριβώς το
 * σχήμα των δύο λιστών namespace του CHECK 3.34 — δύο εκφράσεις που *τυχαίνει* να συμφωνούν.
 *
 * ## Γιατί ένα πέρασμα και όχι τέσσερα
 * Το {@link forEachResolvedCellStyle} είναι ο **ΕΝΑΣ** βρόχος πάνω στα επιλυμένα στυλ, και
 * από τη Φ3 κουβαλά και τη θέση πλέγματος και το ωμό κελί — δηλαδή ό,τι χρειάζονται και οι
 * τέσσερις ερωτήσεις. Δεύτερος βρόχος εδώ θα ήταν structural clone (CHECK 3.28 / N.18).
 *
 * @module subapps/dxf-viewer/bim/table/table-format-read
 * @see bim/table/table-format-payload.ts — ο τύπος και οι όψεις
 * @see bim/table/table-format-paint.ts — η εγγραφή («ελάχιστη υλοποίηση»)
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import { forEachResolvedCellStyle, type TableResolvedCell } from './table-cell-style-scan';
import { resolveCellNumberFormat } from './table-cell-format';
import { resolveCellOverflow } from './table-cell-overflow';
import { resolveTableEdgeSpec } from './table-edge-resolve';
import { resolveTableModel } from './table-model-helpers';
import {
  TABLE_CELL_BORDER_SIDES,
  type TableCellBorderSide,
  type TableCellFormatPayload,
  type TableCellStyleSnapshot,
} from './table-format-payload';
import type { TableCellRef } from './table-cell-range';
import type { TableStyle } from './table-style';
import type { PersistedTableModel, TableBorderSpec, TableModel } from '../../types/table';
import type { TableEdgeOrientation } from '../../types/table-edges';

/**
 * Η μορφή αυτού του κελιού, **όπως τη βλέπει ο χρήστης**. `null` όταν το κελί δεν υπάρχει στο
 * μοντέλο.
 *
 * Το `null` δεν είναι σφάλμα: μπαγιάτικη ταυτότητα μετά από undo ή διαγραφή γραμμής είναι
 * φυσιολογικό ενδιάμεσο στάδιο — ίδια σύμβαση ανοχής με το {@link forEachResolvedCellStyle}.
 * Ο καλών σβήνει το πινέλο, δεν μαντεύει.
 */
export function readTableCellFormat(
  model: PersistedTableModel,
  style: TableStyle,
  ref: TableCellRef,
): TableCellFormatPayload | null {
  const resolved = resolveTableModel(model);
  let payload: TableCellFormatPayload | null = null;

  forEachResolvedCellStyle(model, style, [ref], (cell) => {
    payload = payloadOf(resolved, style, cell);
  });

  return payload;
}

/**
 * Το φορτίο ενός **ήδη επιλυμένου** κελιού.
 *
 * Ξεχωριστό από το {@link readTableCellFormat} επειδή ο **ζωγράφος** (`table-format-paint`)
 * το χρειάζεται μέσα στο δικό του πέρασμα, όπου η επίλυση έχει ήδη γίνει: μια δεύτερη κλήση
 * του `readTableCellFormat` ανά κελί θα ξανάτρεχε ολόκληρο τον βρόχο για ένα κελί — O(κελιά²)
 * σε περιοχή 500 γραμμών, το ακριβές σχήμα που πλήρωσε ο ADR-735.
 */
export function tableCellFormatOf(
  resolved: TableModel,
  style: TableStyle,
  cell: TableResolvedCell,
): TableCellFormatPayload {
  return payloadOf(resolved, style, cell);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

function payloadOf(
  resolved: TableModel,
  style: TableStyle,
  cell: TableResolvedCell,
): TableCellFormatPayload {
  return {
    style: styleSnapshotOf(cell),
    numberFormat: resolveCellNumberFormat(cell.overrides, cell.column.valueType),
    overflow: resolveCellOverflow(cell.overrides.cell?.overflow, cell.column.overflow),
    diagonal: cell.cell?.diagonal,
    borders: bordersOf(resolved, style, cell),
  };
}

/**
 * Τα οκτώ πεδία του επιλυμένου στυλ, ξεσηκωμένα ονομαστικά.
 *
 * ⚠️ **Ονομαστικά και όχι με spread** του {@link TableCellStyle}: εκείνο κουβαλά και τα
 * `margins`, που **δεν** είναι παρακάμψιμα από κανένα επίπεδο. Ένα φορτίο που τα περιλάμβανε
 * θα υποσχόταν κάτι που ο γραφέας δεν μπορεί να τηρήσει — και η υπόσχεση θα ήταν σιωπηλή.
 *
 * Ο τύπος {@link TableCellStyleSnapshot} είναι `Pick<…, TableCellStyleKey>`, οπότε ένα
 * ξεχασμένο πεδίο **σπάει τη μεταγλώττιση** εδώ: η απαρίθμηση δεν είναι σύμβαση που θυμάται
 * κάποιος, είναι υποχρέωση του μεταγλωττιστή.
 */
function styleSnapshotOf(cell: TableResolvedCell): TableCellStyleSnapshot {
  const s = cell.style;
  return {
    textHeightMm: s.textHeightMm,
    textColorHex: s.textColorHex,
    fillColorHex: s.fillColorHex,
    bold: s.bold,
    italic: s.italic,
    underline: s.underline,
    fontFamily: s.fontFamily,
    align: s.align,
    // 🔴 ADR-739 §59 Δ2 — **η εσοχή ταξιδεύει με το πινέλο.** Ξεχασμένη εδώ, το βάψιμο θα
    // έγραφε `indentLevel: null` σε **κάθε** κελί (η πηγή θα έλεγε `undefined`, ο στόχος `0`,
    // άρα «διαφορά») — δηλαδή θα γεννούσε βήμα undo και εγγραφή-φάντασμα σε κάθε ίδια-κλάση
    // βάψιμο. Το έπιασε ζωντανά η άγκυρα «ίδια κλάση γραμμής ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference»,
    // **όχι** ο μεταγλωττιστής: το jest μεταγλωττίζει χωρίς έλεγχο τύπων, οπότε το `Pick<…>` από
    // πάνω είναι φύλακας του `tsc`/CI και όχι της σουίτας. Δύο πύλες, όχι μία.
    indentLevel: s.indentLevel,
    // 🔴 ADR-739 §59 Δ1 — ίδιο σκεπτικό, ίδια αστοχία αν λείψει: το πινέλο θα έγραφε
    // `textRotationDeg: null` σε κάθε κελί.
    textRotationDeg: s.textRotationDeg,
  };
}

/**
 * Οι τέσσερις πλευρές του κελιού, επιλυμένες.
 *
 * 🔑 Η μετάφραση «πλευρά κελιού → θέση ακμής στο πλέγμα» γίνεται **εδώ και μόνο εδώ**: το
 * `top` του κελιού `(r, c)` είναι η οριζόντια ακμή `r`, το `bottom` η `r+1`. Είναι η ίδια
 * αριθμητική που κάνει το {@link tableRangeSideEdges} για ορθογώνια — αλλά εκείνο επιστρέφει
 * **κλειδιά** (ταυτότητες) και όχι **θέσεις**, ενώ ο επιλυτής κληρονομιάς δέχεται θέσεις.
 * Δεν είναι διπλότυπο· είναι η άλλη μισή ερώτηση.
 */
function bordersOf(
  resolved: TableModel,
  style: TableStyle,
  cell: TableResolvedCell,
): Readonly<Record<TableCellBorderSide, TableBorderSpec>> {
  const specs = {} as Record<TableCellBorderSide, TableBorderSpec>;
  for (const side of TABLE_CELL_BORDER_SIDES) {
    const at = tableCellEdgePosition(side, cell.rowIndex, cell.colIndex);
    specs[side] = resolveTableEdgeSpec(resolved, style, at.orientation, at.r, at.c);
  }
  return specs;
}

/** Πού βρίσκεται στο πλέγμα η πλευρά `side` του κελιού `(rowIndex, colIndex)`. */
export function tableCellEdgePosition(
  side: TableCellBorderSide,
  rowIndex: number,
  colIndex: number,
): { readonly orientation: TableEdgeOrientation; readonly r: number; readonly c: number } {
  switch (side) {
    case 'top':
      return { orientation: 'H', r: rowIndex, c: colIndex };
    case 'bottom':
      return { orientation: 'H', r: rowIndex + 1, c: colIndex };
    case 'left':
      return { orientation: 'V', r: rowIndex, c: colIndex };
    case 'right':
      return { orientation: 'V', r: rowIndex, c: colIndex + 1 };
  }
}
