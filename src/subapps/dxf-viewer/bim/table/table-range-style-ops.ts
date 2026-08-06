/**
 * ADR-739 — **μορφοποίηση σε ΠΕΡΙΟΧΗ κελιών**: ό,τι κάνει το `table-axis-style-ops.ts` για μια
 * γραμμή/στήλη, εδώ για τα κελιά που μαρκάρισε ο χρήστης.
 *
 * ## Τι ΔΕΝ ζει εδώ, και γιατί
 * Η **ανάγνωση** («συμφωνούν τα κελιά;») ζει στο `table-cell-style-scan.ts`, κοινή με τον
 * άξονα — δες την κεφαλίδα εκεί για την τετράδα ερωτήσεων. Εδώ μένουν μόνο οι δύο που είναι
 * όντως διαφορετικές: **πού γράφεται** (Ν κελιά στον αραιό χάρτη αντί για ένα στοιχείο άξονα)
 * και **ποιος το είπε** (`every` κελί αντί για την άγκυρα).
 *
 * ## 🔴 ΤΑ RUNS ΤΟΥ ΚΕΛΙΟΥ ΙΣΟΠΕΔΩΝΟΝΤΑΙ — ΚΑΤΑ ΠΕΔΙΟ
 * Η σειρά επίλυσης είναι **run > κελί** (ADR-753). Άρα «Β» σε κελί που περιέχει έστω ένα run με
 * `bold: false` θα έγραφε το κελί και **δεν θα φαινόταν τίποτα**: το κουμπί θα έλεγε ψέματα.
 *
 * Η απάντηση δεν είναι «σβήσε τα runs»: ένα κόκκινο γράμμα πρέπει να **μείνει** κόκκινο όταν
 * κάνεις ολόκληρο το κελί έντονο — αυτό κάνουν Word και Excel. Είναι «αφαίρεσε **το ίδιο**
 * πεδίο από τα runs», μέσω του υπάρχοντος {@link setCellRunStyleField}: το run επιβιώνει με ό,τι
 * άλλο δήλωνε, και το πεδίο που μόλις όρισε ο χρήστης κληρονομείται πλέον από το κελί.
 *
 * Ισχύει μόνο στην **τομή** των δύο συνόλων πεδίων — το `align` και το `fillColorHex` δεν έχουν
 * νόημα σε επιλογή γραμμάτων. Την τομή τη φυλάει το {@link isTableTextRunStyleKey}, δηλαδή το
 * ίδιο `Record` που ελέγχει ο μεταγλωττιστής, όχι δεύτερη λίστα ονομάτων.
 *
 * **Συνέπεια στην ανάγνωση**: ο σαρωτής διαβάζει το επιλυμένο στυλ **του κελιού** και αγνοεί τα
 * runs. Είναι συνεπές ακριβώς επειδή η εγγραφή ισοπεδώνει το ίδιο πεδίο. Μια σάρωση ανά
 * χαρακτήρα θα έκανε το `mixed` σχεδόν μόνιμο (κάθε βαμμένη λέξη θα το άναβε) και θα κόστιζε
 * O(μήκος κειμένου) ανά καρέ — για ερώτηση που ο χρήστης έκανε για το **κελί**.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-style-ops
 * @see bim/table/table-axis-style-ops.ts — ο αδελφός για τον άξονα
 * @see bim/table/table-cell-style-scan.ts — η κοινή ανάγνωση
 * @see bim/table/table-format-scope.ts — ο ΕΝΑΣ δρόμος που διαλέγει ανάμεσα στους δύο
 */

import { cellText, writePersistedCellStyles } from './table-cell-content';
import { cellKey, resolveTableModel } from './table-model-helpers';
import { tableRangeCellRefs, type TableCellRangeBounds } from './table-cell-range';
import { patchStyleOverride } from './table-style-override';
import {
  resolveCellsFormat,
  type TableCellStyleKey,
  type TableFormatState,
} from './table-cell-style-scan';
import {
  clearCellRunStyles,
  isTableTextRunStyleKey,
  setCellRunStyleField,
} from './table-cell-run-ops';
import type { TableCellStyle, TableStyle } from './table-style';
import type {
  PersistedTableModel,
  TableCell,
  TableCellStyleOverride,
  TableCellTextRun,
} from '../../types/table';

/**
 * Θέτει **ένα** πεδίο στην παράκαμψη κάθε κελιού της περιοχής. Οι τρεις καταστάσεις είναι οι
 * ίδιες με του άξονα (`undefined` αφαιρεί · `null` ρητά κανένα · αλλιώς ρητή τιμή), γιατί είναι
 * το ίδιο σχήμα παράκαμψης.
 *
 * ## Οι δύο εγγυήσεις που κληρονομεί από τον μαζικό γραφέα
 * - **Καμία εγγραφή-φάντασμα**: κελί που δεν υπάρχει αποκτά εγγραφή **μόνο** για ρητή τιμή. Ένα
 *   `Ctrl+A` + «αφαίρεση έντονων» σε πίνακα 500×8 θα γεννούσε αλλιώς 4.000 κελιά που δηλώνουν
 *   το τίποτα — και ο χάρτης είναι αραιός επίτηδες.
 * - **Ταυτότητα by-reference στο no-op**: αν κανένα κελί δεν άλλαξε, επιστρέφεται το **ίδιο**
 *   μοντέλο ⇒ καμία εντολή, κανένα βήμα undo, καμία ακύρωση των `WeakMap` μνημών.
 */
export function setRangeStyleField<K extends keyof TableCellStyleOverride>(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  key: K,
  value: TableCellStyleOverride[K] | undefined,
): PersistedTableModel {
  return writePersistedCellStyles(model, tableRangeCellRefs(model, bounds), {
    update: (existing) => {
      const runs = runsWithoutField(existing, key);
      // Η σύγκριση είναι `===` σε **τρεις** καταστάσεις ταυτόχρονα: απόν και ρητά-`undefined`
      // δίνουν και τα δύο `undefined` (άρα ίσα, σωστά), ενώ το `null` παραμένει διακριτό.
      if (existing.styleOverride?.[key] === value && runs === existing.runs) return null;
      return {
        ...existing,
        styleOverride: patchStyleOverride(existing.styleOverride, key, value),
        runs,
      };
    },
    create: () =>
      value === undefined
        ? null
        : { kind: 'text', value: '', styleOverride: { [key]: value } as TableCellStyleOverride },
  });
}

/**
 * Σβήνει **κάθε** ρητή μορφοποίηση των κελιών — η «Απαλοιφή μορφοποίησης» του Excel.
 *
 * ## 🔴 Δύο ρητές αποφάσεις που αλλάζουν το αποτέλεσμα
 *
 * **1. Σβήνει ΚΑΙ τα runs.** Και τα δύο είναι «ρητή μορφοποίηση που ζήτησε ο χρήστης»· αν τα
 * runs επιβίωναν, θα πατούσες «Επαναφορά» και το κελί θα έμενε μισοβαμμένο — δηλαδή το κουμπί
 * δεν θα έκανε αυτό που λέει το όνομά του. Είναι η μόνη πράξη αυτού του module που **χάνει
 * δεδομένα**· γι' αυτό ζει πίσω από ρητό κουμπί και αναιρείται με `Ctrl+Z`.
 *
 * **2. ΔΕΝ αγγίζει ποτέ τη γραμμή ή τη στήλη.** Η παγίδα θα ήταν θανάσιμη: «επαναφορά» ενός
 * κελιού που καθάριζε και τον άξονά του θα ξεγύμνωνε ολόκληρη τη γραμμή. Ρητή —και αποδεκτή—
 * συνέπεια: **μετά την επαναφορά το κελί μπορεί να φαίνεται ακόμη έντονο**, επειδή το λέει η
 * γραμμή ή η κλάση της. Το χειριστήριο το δείχνει σωστά ως `value: true, overridden: false`,
 * και η επαναφορά του άξονα παραμένει δουλειά του άξονα.
 */
export function clearRangeStyleOverride(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): PersistedTableModel {
  return writePersistedCellStyles(model, tableRangeCellRefs(model, bounds), {
    update: (existing) => {
      const runs = clearedRuns(existing);
      if (existing.styleOverride === undefined && runs === existing.runs) return null;
      return { ...existing, styleOverride: undefined, runs };
    },
    // Κελί που δεν υπάρχει δεν δηλώνει τίποτα — δεν υπάρχει τι να καθαριστεί.
    create: () => null,
  });
}

/**
 * Δηλώνει η περιοχή **οτιδήποτε** ρητά; Η ερώτηση του κουμπιού «Επαναφορά»: χωρίς παράκαμψη
 * πουθενά, δεν έχει τι να σβήσει και το λέει (ανενεργό) αντί να είναι σιωπηλό no-op.
 *
 * `some`, όχι `every` — και είναι η **ίδια** επιλογή με το `hasAnyAxisStyleOverride`: η ερώτηση
 * είναι «υπάρχει τι να επαναφερθεί;». Με ένα στα είκοσι κελιά ρητό, η απάντηση είναι ναι.
 * ⚠️ Άλλη ερώτηση από το `overridden` του {@link resolveRangeFormat} (εκεί: `every`) — η μία
 * οδηγεί **ενέργεια**, η άλλη **ένδειξη**.
 */
export function hasAnyRangeStyleOverride(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): boolean {
  const cells = resolveTableModel(model).cells;
  return tableRangeCellRefs(model, bounds).some((ref) => {
    const cell = cells.get(cellKey(ref.rowId, ref.colId));
    return cell !== undefined && (cell.styleOverride !== undefined || cell.runs !== undefined);
  });
}

/**
 * Τι δείχνει ένα χειριστήριο για ολόκληρη την περιοχή.
 *
 * Τα δύο πρώτα πεδία τα απαντά ο κοινός σαρωτής. Το `overridden` είναι `every`: ο δείκτης λέει
 * «το βλέπεις επειδή το ζήτησες **εσύ**», και με ένα στα είκοσι κελιά να το δηλώνει, αυτό δεν
 * ισχύει. Ίδιος κανόνας με το `resolveAxesFormat` για πολλούς άξονες.
 */
export function resolveRangeFormat<K extends TableCellStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  bounds: TableCellRangeBounds,
  key: K,
): TableFormatState<TableCellStyle[K]> | null {
  const refs = tableRangeCellRefs(model, bounds);
  const shared = resolveCellsFormat(model, style, refs, key);
  if (!shared) return null;

  const cells = resolveTableModel(model).cells;
  const overridden = refs.every(
    (ref) => cells.get(cellKey(ref.rowId, ref.colId))?.styleOverride?.[key] !== undefined,
  );
  return { ...shared, overridden };
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — η ισοπέδωση των runs
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα runs του κελιού **χωρίς** αυτό το πεδίο· το ίδιο αντικείμενο by-reference όταν δεν άλλαξε
 * τίποτα (κελί χωρίς runs, ή πεδίο που δεν υπάρχει σε run).
 *
 * Το εύρος είναι **ολόκληρο** το κείμενο επειδή ο χρήστης μόρφωσε ολόκληρο το κελί: μια μερική
 * ισοπέδωση θα άφηνε τα υπόλοιπα γράμματα να αγνοούν την εντολή που μόλις δόθηκε.
 *
 * 🔴 **ADR-768 Φ3 — εξάγεται** επειδή απέκτησε δεύτερο καταναλωτή: ο ζωγράφος του πινέλου
 * μορφοποίησης γράφει **διαφορετική** τιμή σε κάθε κελί (άπλωμα μοτίβου), άρα δεν μπορεί να
 * περάσει από το {@link setRangeStyleField} — αλλά χρωστά **ακριβώς την ίδια** ισοπέδωση.
 * Δεύτερο αντίγραφο θα σήμαινε ότι το πινέλο βάφει το κελί κόκκινο και ένα μισό του μένει
 * μπλε, γιατί τα runs **νικούν** το κελί στην επίλυση — σφάλμα ορατό μόνο σε κελιά με
 * μορφοποίηση ανά χαρακτήρα, δηλαδή στο 1% που κανείς δεν δοκιμάζει.
 */
export function runsWithoutField(cell: TableCell, key: string): readonly TableCellTextRun[] | undefined {
  if (cell.runs === undefined || !isTableTextRunStyleKey(key)) return cell.runs;
  const length = cellText(cell).length;
  return setCellRunStyleField(cell.runs, length, { start: 0, end: length }, key, undefined);
}

/** Ό,τι μένει από τα runs μετά την «Απαλοιφή» — δηλαδή τίποτα, με την ίδια εγγύηση ταυτότητας. */
function clearedRuns(cell: TableCell): readonly TableCellTextRun[] | undefined {
  if (cell.runs === undefined) return undefined;
  const length = cellText(cell).length;
  return clearCellRunStyles(cell.runs, length, { start: 0, end: length });
}
