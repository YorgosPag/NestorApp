/**
 * ADR-739 — **ΤΙ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ ΣΕ ΑΥΤΑ ΤΑ ΚΕΛΙΑ.** Ο ΕΝΑΣ βρόχος πάνω στα επιλυμένα στυλ.
 *
 * ## Γιατί εξήχθη από το `table-axis-style-ops.ts`
 * Η μορφοποίηση πίνακα έχει **δύο** στόχους — άξονα (γραμμή/στήλη) και **περιοχή** κελιών — και
 * τέσσερις ερωτήσεις που δεν έχουν τον ίδιο βαθμό κοινότητας:
 *
 * | ερώτηση | άξονας | περιοχή | κοινό; |
 * |---|---|---|---|
 * | ποια κελιά; | όλη η γραμμή/στήλη | τα κελιά των ορίων | όχι — **αλλά** και τα δύο δίνουν `TableCellRef[]` |
 * | τι βλέπει ο χρήστης; | σάρωση επιλυμένων στυλ | ίδιο | **ΝΑΙ, κατά λέξη** |
 * | πού γράφεται; | ένα στοιχείο άξονα | Ν κελιά στον αραιό χάρτη | **όχι — και δεν ενοποιείται βίαια** |
 * | ποιος το είπε; | το `styleOverride` της άγκυρας | `every` κελί | ίδια ερώτηση, **άλλη πηγή** |
 *
 * Μόνο η **δεύτερη** γραμμή ζει εδώ. Ένα `table-range-style-ops.ts` που αντέγραφε αυτόν τον
 * βρόχο θα ήταν sibling clone πάνω από το κατώφλι του jscpd (CHECK 3.28 / N.18) — και,
 * χειρότερα, δύο σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα προτεραιότητας (Α6)
 * για το ίδιο κελί.
 *
 * ## 🔴 Γιατί το {@link resolveCellsFormat} ΔΕΝ επιστρέφει `overridden`
 * Είναι η μόνη από τις τέσσερις ερωτήσεις που **εξαρτάται από τον στόχο**: ο άξονας τη
 * διαβάζει από το `styleOverride` της άγκυρας του, η περιοχή απαιτεί να τη δηλώνουν **όλα** τα
 * κελιά. Ένα κοινό σώμα που την επέστρεφε θα ήταν αναγκασμένο να μαντέψει. Ο τύπος το κάνει
 * **μη εκφράσιμο να ξεχαστεί**: ο καλών παίρνει `Omit<…, 'overridden'>` και ο μεταγλωττιστής
 * τον υποχρεώνει να απαντήσει ο ίδιος.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-style-scan
 * @see bim/table/table-axis-style-ops.ts — ο στόχος «άξονας»
 * @see bim/table/table-style.ts — `resolveCellStyle`, η σειρά προτεραιότητας (§28.4)
 */

import { cellKey, indexById, resolveTableModel } from './table-model-helpers';
import {
  resolveCellStyle,
  type TableCellStyle,
  type TableStyle,
  type TableStyleOverrides,
} from './table-style';
import type { TableCellRef } from './table-cell-range';
import type {
  PersistedTableModel,
  TableAxisStyleOverride,
  TableCell,
  TableColumn,
  TableRowClass,
} from '../../types/table';

/**
 * Τα πεδία που μπορεί να παρακάμψει ένα επίπεδο **και** εμφανίζονται στο επιλυμένο στυλ.
 *
 * Η τομή δεν είναι φορμαλισμός: το `margins` ζει στο {@link TableCellStyle} αλλά **δεν**
 * παρακάμπτεται, ενώ το `overflow` και το `numberFormat` παρακάμπτονται αλλά **δεν** ζουν στο
 * επιλυμένο στυλ. Ο τύπος κρατά τα δύο σύνολα ευθυγραμμισμένα χωρίς τρίτη χειρόγραφη λίστα.
 */
export type TableCellStyleKey = keyof TableAxisStyleOverride & keyof TableCellStyle;

/**
 * Τα πεδία του {@link TableCellStyleKey} που ο ζωγράφος επιλύει σε **αριθμό**.
 *
 * Παράγεται από τον ίδιο τον τύπο του επιλυμένου στυλ αντί για χειρόγραφη ένωση ονομάτων:
 * την ημέρα που ένα πεδίο αλλάξει τύπο, ο μεταγλωττιστής το λέει εδώ — μια λίστα
 * `'textHeightMm' | …` θα έμενε πίσω σιωπηλά.
 */
export type TableCellNumericKey = {
  [K in TableCellStyleKey]: TableCellStyle[K] extends number ? K : never;
}[TableCellStyleKey];

/**
 * Τι δείχνει ένα χειριστήριο μορφοποίησης. **Δύο ορθογώνιες** ερωτήσεις, όχι μία.
 *
 * Το Excel απαντά μόνο την πρώτη, και γι' αυτό δεν μπορεί ποτέ να σου πει αν τα έντονα που
 * βλέπεις τα ζήτησες εσύ ή τα λέει το στυλ — ούτε να σε γυρίσει πίσω. Τα εργαλεία που
 * διαχειρίζονται **κληρονομιά** (Revit «By Category», Figma detached override, Blender library
 * override) απαντούν και τις δύο, και δείχνουν ρητά τη διαφορά.
 */
export interface TableFormatState<T> {
  /** Η **κοινή** επιλυμένη τιμή όλων των κελιών· `undefined` όταν {@link mixed}. */
  readonly value: T | undefined;
  /** Τα κελιά δεν συμφωνούν — Figma «Mixed», Revit «<varies>». */
  readonly mixed: boolean;
  /** Ο στόχος δηλώνει **ρητά** αυτό το πεδίο (δεν το κληρονομεί). */
  readonly overridden: boolean;
}

/** Τα άκρα μιας αριθμητικής ιδιότητας πάνω σε ένα σύνολο κελιών. */
export interface TableNumericRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Ένα κελί όπως το βλέπει ο ζωγράφος — **και** ό,τι χρειάζεται όποιος ρωτά «γιατί».
 *
 * ⚠️ Τα `overrides` και `column` **δεν** είναι πλεονασμός για τον σημερινό καταναλωτή: η μορφή
 * αριθμού (ADR-760) κληρονομείται με **άλλη** αλυσίδα από το στυλ (κελί→γραμμή→στήλη→
 * `valueType` της στήλης) και δεν εμφανίζεται καθόλου στο {@link TableCellStyle}. Χωρίς αυτά τα
 * δύο πεδία, το πρώτο χειριστήριο μορφής αριθμού θα ήταν αναγκασμένο να ανοίξει **δεύτερο**
 * βρόχο πάνω στα ίδια κελιά — δηλαδή ακριβώς ο κλώνος που αυτό το module υπάρχει για να
 * αποτρέψει. Το κόστος τους είναι δύο αναφορές ανά κελί, μηδέν επιπλέον δουλειά.
 */
export interface TableResolvedCell {
  readonly ref: TableCellRef;
  readonly style: TableCellStyle;
  readonly overrides: TableStyleOverrides;
  readonly column: TableColumn;
  /**
   * 🔴 ADR-768 Φ3 — η **θέση στο πλέγμα**, για ό,τι δεν απαντιέται με ταυτότητες.
   *
   * Τα περιγράμματα είναι ιδιότητα του **πλέγματος**, όχι του κελιού (ADR-750 §6): μια ακμή
   * ζει ανάμεσα σε δύο κελιά και ο επιλυτής της ({@link resolveTableEdgeSpec}) δέχεται
   * **δείκτες**, όχι `rowId`/`colId`. Χωρίς αυτά τα δύο πεδία, το πινέλο μορφοποίησης θα ήταν
   * αναγκασμένο να ξανακάνει `resolveTableModel` + δύο `indexById` — δηλαδή **δεύτερο
   * αντίγραφο** αυτού ακριβώς του βρόχου, που αυτό το module υπάρχει για να αποτρέψει.
   *
   * Το κόστος τους είναι μηδέν: ο βρόχος τα **έχει ήδη** και τα πετούσε.
   */
  readonly rowIndex: number;
  readonly colIndex: number;
  /**
   * 🔴 ADR-768 Φ3 — η **κλάση** της γραμμής (τίτλος / κεφαλίδα / δεδομένα).
   *
   * Είναι η βάση της επίλυσης, και το πινέλο μορφοποίησης τη χρειάζεται για να κάνει την
   * **αντίστροφη** ερώτηση: «τι θα έδειχνε αυτό το κελί **χωρίς** τη δική του παράκαμψη;»
   * — δηλαδή `resolveCellStyle(rowClasses[rowClass], { column, row })`. Χωρίς αυτήν, η
   * «ελάχιστη υλοποίηση» δεν έχει με τι να συγκρίνει και το πινέλο θα κάρφωνε **κάθε** πεδίο
   * σε **κάθε** κελί, σκοτώνοντας την κληρονομιά που το ADR-739 Α2 υπάρχει για να δώσει.
   */
  readonly rowClass: TableRowClass;
  /**
   * 🔴 ADR-768 Φ3 — το **ωμό** κελί, όταν υπάρχει στον αραιό χάρτη.
   *
   * Το {@link overrides}`.cell` κρατά **μόνο** το `styleOverride` του. Οι **διαγώνιοι**
   * (ADR-750 §6.3) είναι μορφοποίηση που ζει σε δικό της πεδίο του `TableCell` και δεν
   * περνά από καμία αλυσίδα κληρονομιάς — άρα δεν εμφανίζεται πουθενά στο επιλυμένο στυλ,
   * και ένα πινέλο που δεν τις έβλεπε θα άφηνε σιωπηλά πίσω του τη μισή δουλειά.
   *
   * Ίδιο επιχείρημα με τα `overrides` / `column`: μία αναφορά ανά κελί, μηδέν επιπλέον
   * δουλειά — ο βρόχος κάνει ήδη αυτό ακριβώς το `get`.
   */
  readonly cell: TableCell | undefined;
}

/**
 * Ο **ΕΝΑΣ** βρόχος πάνω στα επιλυμένα στυλ ενός συνόλου κελιών· `false` όταν **κανένα** από τα
 * κελιά δεν υπάρχει στο μοντέλο.
 *
 * Κελιά που δεν βρέθηκαν **προσπερνιούνται** αντί να μηδενίσουν την απάντηση: μια μπαγιάτικη
 * ταυτότητα μετά από undo ή διαγραφή γραμμής είναι φυσιολογικό ενδιάμεσο στάδιο, όχι σφάλμα —
 * ίδια σύμβαση ανοχής με το `buildMergeIndex`. Το `false` σημαίνει «δεν έχω τι να απαντήσω»,
 * και ο καλών το μεταφράζει σε `null`.
 *
 * Δύο αναγνώστες ρωτούν διαφορετικά πράγματα για την **ίδια** διαδρομή («συμφωνούν;» και «ποια
 * τα άκρα;»). Δύο αντίγραφα του βρόχου θα ήταν structural clone (CHECK 3.28) — και, χειρότερα,
 * δύο σημεία που μπορούν κάποτε να μάθουν διαφορετική σειρά προτεραιότητας.
 */
export function forEachResolvedCellStyle(
  model: PersistedTableModel,
  style: TableStyle,
  refs: readonly TableCellRef[],
  visit: (cell: TableResolvedCell) => void,
): boolean {
  const resolved = resolveTableModel(model);
  const rowAt = indexById(resolved.rows);
  const colAt = indexById(resolved.columns);
  let visited = false;

  for (const ref of refs) {
    const rowIndex = rowAt.get(ref.rowId);
    const colIndex = colAt.get(ref.colId);
    if (rowIndex === undefined || colIndex === undefined) continue;

    const row = resolved.rows[rowIndex];
    const column = resolved.columns[colIndex];
    const cell = resolved.cells.get(cellKey(row.id, column.id));
    const overrides: TableStyleOverrides = {
      column: column.styleOverride,
      row: row.styleOverride,
      cell: cell?.styleOverride,
    };
    visit({
      ref,
      style: resolveCellStyle(style.rowClasses[row.rowClass], overrides),
      overrides,
      column,
      rowIndex,
      colIndex,
      rowClass: row.rowClass,
      cell,
    });
    visited = true;
  }

  return visited;
}

/**
 * Συμφωνούν τα κελιά σε αυτό το πεδίο; — υπολογισμένο από την **πραγματική** επίλυση κάθε
 * κελιού, όχι από τις παρακάμψεις μόνες τους.
 *
 * 🔴 Η διάκριση είναι ουσιώδης: μια στήλη χωρίς καμία παράκαμψη περνά από γραμμή τίτλου
 * (έντονη), κεφαλίδας (έντονη) και δεδομένων (όχι) ⇒ η ειλικρινής απάντηση είναι **μεικτή**. Αν
 * διαβάζαμε μόνο το `styleOverride`, το κουμπί θα έλεγε «όχι έντονα» ενώ τα μισά κελιά είναι
 * έντονα — δηλαδή θα έλεγε ψέματα για ό,τι βλέπει ο χρήστης.
 *
 * Δες την κεφαλίδα για το γιατί λείπει το `overridden`.
 */
export function resolveCellsFormat<K extends TableCellStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  refs: readonly TableCellRef[],
  key: K,
): Omit<TableFormatState<TableCellStyle[K]>, 'overridden'> | null {
  let value: TableCellStyle[K] | undefined;
  let seen = false;
  let mixed = false;

  const visited = forEachResolvedCellStyle(model, style, refs, (cell) => {
    const current = cell.style[key];
    if (!seen) {
      value = current;
      seen = true;
    } else if (current !== value) {
      mixed = true;
    }
  });
  if (!visited) return null;

  return { value: mixed ? undefined : value, mixed };
}

/**
 * Τα άκρα μιας **αριθμητικής** ιδιότητας πάνω στα κελιά — `null` αν κανένα δεν υπάρχει.
 *
 * 🔴 Γιατί χρειάζεται χωριστά από το {@link resolveCellsFormat}: εκείνο απαντά «συμφωνούν;» και
 * σε μεικτή σειρά επιστρέφει `value: undefined` — σωστό για ένα δίτιμο κουμπί, **άχρηστο** για
 * ένα βήμα μεγέθους, που πρέπει να ξέρει *από πού* ξεκινά. Και η μεικτή σειρά **δεν είναι η
 * εξαίρεση εδώ**: κάθε στήλη περνά από γραμμή τίτλου (4mm), κεφαλίδας (3mm) και δεδομένων
 * (2.8mm), άρα το ύψος είναι μεικτό **σχεδόν πάντα**. Ένα βήμα που δεν το χειρίζεται ρητά θα
 * ήταν βήμα που δεν λειτουργεί ποτέ στην πράξη.
 */
export function resolveCellsNumericRange(
  model: PersistedTableModel,
  style: TableStyle,
  refs: readonly TableCellRef[],
  key: TableCellNumericKey,
): TableNumericRange | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  const visited = forEachResolvedCellStyle(model, style, refs, (cell) => {
    const current = cell.style[key];
    if (!Number.isFinite(current)) return;
    if (current < min) min = current;
    if (current > max) max = current;
  });
  if (!visited || !Number.isFinite(min)) return null;

  return { min, max };
}

/**
 * Τι γίνεται όταν πατηθεί ένα **δίτιμο** χειριστήριο.
 *
 * Ο κανόνας του Excel και κάθε εργαλείου με πολλαπλή επιλογή: **μεικτό ⇒ όλα ναι**. Είναι η
 * μόνη επιλογή που δίνει ορατή αλλαγή σε **κάθε** κελί που δεν συμφωνούσε — ένα «όλα όχι» θα
 * άφηνε το μισό σύνολο φαινομενικά αμετάβλητο.
 *
 * Ζει εδώ και όχι δίπλα στον γραφέα του άξονα, γιατί η ερώτηση είναι **του χειριστηρίου**: την
 * κάνουν πανομοιότυπα ο άξονας, η περιοχή και — αργότερα — η κορδέλα.
 */
export function nextBooleanFormat(state: TableFormatState<boolean> | null): boolean {
  return !(state && !state.mixed && state.value === true);
}
