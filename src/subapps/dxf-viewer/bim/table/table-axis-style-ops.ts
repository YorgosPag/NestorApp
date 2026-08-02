/**
 * ADR-739 Φ.Ε (Α2) — **μορφοποίηση σε επίπεδο άξονα**: οι καθαρές πράξεις πίσω από το mini
 * toolbar των ζωνών δείκτη. Μηδέν React, μηδέν DOM.
 *
 * ## Ένα σώμα, δύο άξονες
 * Γραμμή και στήλη κάνουν **την ίδια** πράξη πάνω στο ίδιο σχήμα ({@link TableAxisStyleOverride}).
 * Δύο ξεχωριστές οικογένειες συναρτήσεων θα ήταν ακριβώς το sibling clone που πιάνει το
 * CHECK 3.28 (jscpd, N.18) — και, χειρότερα, δύο σημεία που μπορούν κάποτε να μάθουν
 * διαφορετικό κανόνα για την ίδια ερώτηση.
 *
 * ## 🔴 Δύο εγγυήσεις που ΔΕΝ είναι λεπτομέρειες
 *
 * ### 1. Πάντα νέο αντικείμενο, ποτέ mutation
 * Δύο αλυσιδωμένα `WeakMap` κρέμονται από την **ταυτότητα** του μοντέλου:
 * ```
 *   PersistedTableModel ──RESOLVED_MODEL_CACHE──▶ TableModel ──LAYOUT_CACHE──▶ TableLayout
 * ```
 * Μια επιτόπια μεταβολή αφήνει την ταυτότητα ίδια ⇒ και οι δύο μνήμες επιστρέφουν την
 * **παλιά** διάταξη ⇒ η μορφοποίηση δεν φαίνεται **ποτέ**, μέχρι reload (§28.7 ρίσκο 2).
 *
 * ### 2. Το ίδιο μοντέλο by-reference στο no-op
 * Πατάς «Β» σε στήλη που είναι ήδη έντονη ⇒ **καμία** εντολή, **κανένα** βήμα undo. Ίδια
 * εγγύηση με το `setPersistedCellText` και τα `insertTableColumn` / `deleteTableRow`: χωρίς
 * αυτήν, κάθε άνοιγμα μενού θα γέμιζε το ιστορικό με αναιρέσεις που δεν αναιρούν τίποτα.
 *
 * @module subapps/dxf-viewer/bim/table/table-axis-style-ops
 * @see bim/table/table-style.ts — `resolveCellStyle`, η σειρά προτεραιότητας (§28.4)
 * @see bim/table/table-row-column-ops.ts — οι δομικές πράξεις (εισαγωγή/διαγραφή)
 */

import { cellKey, resolveTableModel } from './table-model-helpers';
import { resolveCellStyle, type TableCellStyle, type TableStyle } from './table-style';
import type {
  PersistedTableModel,
  TableAxisStyleOverride,
  TableColumn,
  TableRow,
} from '../../types/table';

/** Ποιον άξονα αφορά η πράξη. Το `'row'` νικά το `'column'` στην επίλυση (Α6). */
export type TableStyleAxis = 'row' | 'column';

/**
 * Τα πεδία που μπορεί να παρακάμψει ένας άξονας **και** εμφανίζονται στο επιλυμένο στυλ.
 *
 * Η τομή δεν είναι φορμαλισμός: το `margins` ζει στο {@link TableCellStyle} αλλά **δεν**
 * παρακάμπτεται, και το `overflow` παρακάμπτεται σε επίπεδο κελιού αλλά δεν είναι στυλ. Ο
 * τύπος κρατά τα δύο σύνολα ευθυγραμμισμένα χωρίς τρίτη χειρόγραφη λίστα.
 */
export type TableAxisStyleKey = keyof TableAxisStyleOverride & keyof TableCellStyle;

/** Ό,τι κρατά ένας άξονας — το κοινό σχήμα γραμμής και στήλης, όσο αφορά το στυλ. */
type AxisItem = TableColumn | TableRow;

// ──────────────────────────────────────────────────────────────────────────────
// Εγγραφή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Θέτει **ένα** πεδίο της παράκαμψης ενός άξονα. Οι τρεις καταστάσεις του
 * {@link TableAxisStyleOverride}, εκφρασμένες στην υπογραφή:
 *
 * ```
 *   value === undefined  →  ΑΦΑΙΡΕΣΕ το πεδίο (πίσω στην κληρονομιά)
 *   value === null       →  ρητά ΚΑΝΕΝΑ
 *   αλλιώς               →  ρητή τιμή
 * ```
 *
 * Ένα πεδίο τη φορά και όχι patch αντικείμενο: σε ένα patch το `{ bold: undefined }` είναι
 * δυσδιάκριτο από το «δεν ανέφερα καθόλου το bold», δηλαδή η **αφαίρεση** — που είναι η
 * μισή λειτουργία αυτού του toolbar — δεν θα μπορούσε καν να εκφραστεί.
 */
export function setAxisStyleField<K extends TableAxisStyleKey>(
  model: PersistedTableModel,
  axis: TableStyleAxis,
  id: string,
  key: K,
  value: TableAxisStyleOverride[K] | undefined,
): PersistedTableModel {
  const items = axisItems(model, axis);
  const at = items.findIndex((item) => item.id === id);
  if (at < 0) return model;

  const current = items[at].styleOverride;
  // Η σύγκριση είναι `===` σε **τρεις** καταστάσεις ταυτόχρονα: απόν και ρητά-`undefined`
  // δίνουν και τα δύο `undefined` (άρα ίσα, σωστά), ενώ το `null` παραμένει διακριτό.
  if (current?.[key] === value) return model;

  return writeAxisOverride(model, axis, at, patched(current, key, value));
}

/**
 * Σβήνει **ολόκληρη** την παράκαμψη ενός άξονα — το «Επαναφορά στο στυλ» του toolbar.
 *
 * Είναι το `ByLayer` του AutoCAD και το «By Category» του Revit σε κουμπί: το Excel δεν έχει
 * δρόμο επιστροφής στο στυλ (μόνο «Απαλοιφή μορφοποίησης», που καθαρίζει και τα κελιά), και
 * αυτή είναι μία από τις θέσεις όπου ο πίνακας του σχεδίου οφείλει να είναι **καλύτερος**:
 * ο μηχανικός πρέπει να μπορεί να πει «ξέχνα ό,τι έκανα εδώ, ισχύει το στυλ του σχεδίου».
 */
export function clearAxisStyleOverride(
  model: PersistedTableModel,
  axis: TableStyleAxis,
  id: string,
): PersistedTableModel {
  const items = axisItems(model, axis);
  const at = items.findIndex((item) => item.id === id);
  if (at < 0 || !items[at].styleOverride) return model;
  return writeAxisOverride(model, axis, at, undefined);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ανάγνωση — η κατάσταση του κουμπιού
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τι δείχνει ένα χειριστήριο του toolbar. **Δύο ορθογώνιες** ερωτήσεις, όχι μία.
 *
 * Το Excel απαντά μόνο την πρώτη, και γι' αυτό δεν μπορεί ποτέ να σου πει αν τα έντονα που
 * βλέπεις τα ζήτησες εσύ ή τα λέει το στυλ — ούτε να σε γυρίσει πίσω. Τα εργαλεία που
 * διαχειρίζονται **κληρονομιά** (Revit «By Category», Figma detached override, Blender
 * library override) απαντούν και τις δύο, και δείχνουν ρητά τη διαφορά.
 */
export interface TableAxisFormatState<T> {
  /** Η **κοινή** επιλυμένη τιμή όλων των κελιών του άξονα· `undefined` όταν {@link mixed}. */
  readonly value: T | undefined;
  /** Τα κελιά του άξονα δεν συμφωνούν — Figma «Mixed», Revit «<varies>». */
  readonly mixed: boolean;
  /** Ο άξονας δηλώνει **ρητά** αυτό το πεδίο (δεν το κληρονομεί). */
  readonly overridden: boolean;
}

/**
 * Η κατάσταση ενός πεδίου για έναν ολόκληρο άξονα — υπολογισμένη από την **πραγματική**
 * επίλυση κάθε κελιού, όχι από την παράκαμψη μόνη της.
 *
 * 🔴 Η διάκριση είναι ουσιώδης: μια στήλη χωρίς καμία παράκαμψη περνά από γραμμή τίτλου
 * (έντονη), κεφαλίδας (έντονη) και δεδομένων (όχι) ⇒ η ειλικρινής απάντηση είναι **μεικτή**.
 * Αν διαβάζαμε μόνο το `styleOverride`, το κουμπί θα έλεγε «όχι έντονα» ενώ τα μισά κελιά
 * της στήλης είναι έντονα — δηλαδή θα έλεγε ψέματα για ό,τι βλέπει ο χρήστης.
 */
export function resolveAxisFormat<K extends TableAxisStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  axis: TableStyleAxis,
  id: string,
  key: K,
): TableAxisFormatState<TableCellStyle[K]> | null {
  const resolved = resolveTableModel(model);
  const anchor = axisItems(model, axis).find((item) => item.id === id);
  if (!anchor) return null;

  const rows = axis === 'row' ? resolved.rows.filter((r) => r.id === id) : resolved.rows;
  const columns = axis === 'column' ? resolved.columns.filter((c) => c.id === id) : resolved.columns;
  if (rows.length === 0 || columns.length === 0) return null;

  let value: TableCellStyle[K] | undefined;
  let seen = false;
  let mixed = false;

  for (const row of rows) {
    for (const column of columns) {
      const cellStyle = resolveCellStyle(style.rowClasses[row.rowClass], {
        column: column.styleOverride,
        row: row.styleOverride,
        cell: resolved.cells.get(cellKey(row.id, column.id))?.styleOverride,
      });
      const current = cellStyle[key];
      if (!seen) {
        value = current;
        seen = true;
      } else if (current !== value) {
        mixed = true;
      }
    }
  }

  return {
    value: mixed ? undefined : value,
    mixed,
    overridden: anchor.styleOverride?.[key] !== undefined,
  };
}

/**
 * Τι γίνεται όταν πατηθεί ένα δίτιμο χειριστήριο.
 *
 * Ο κανόνας του Excel και κάθε εργαλείου με πολλαπλή επιλογή: **μεικτό ⇒ όλα ναι**. Είναι η
 * μόνη επιλογή που δίνει ορατή αλλαγή σε **κάθε** κελί που δεν συμφωνούσε — ένα «όλα όχι»
 * θα άφηνε τον μισό άξονα φαινομενικά αμετάβλητο.
 */
export function nextBooleanFormat(state: TableAxisFormatState<boolean> | null): boolean {
  return !(state && !state.mixed && state.value === true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

function axisItems(model: PersistedTableModel, axis: TableStyleAxis): readonly AxisItem[] {
  return axis === 'row' ? model.rows : model.columns;
}

/**
 * Η νέα παράκαμψη μετά την αλλαγή ενός πεδίου· `undefined` όταν δεν έμεινε τίποτα.
 *
 * Το άδειασμα δεν είναι καλλωπισμός: ένα `styleOverride: {}` θα ταξίδευε στο JSON, θα
 * εμφανιζόταν σε κάθε diff και θα έκανε το «έχει παράκαμψη;» να απαντιέται `true` για κάτι
 * που δεν παρακάμπτει τίποτα.
 */
function patched<K extends TableAxisStyleKey>(
  current: TableAxisStyleOverride | undefined,
  key: K,
  value: TableAxisStyleOverride[K] | undefined,
): TableAxisStyleOverride | undefined {
  const next: Record<string, unknown> = { ...current };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? (next as TableAxisStyleOverride) : undefined;
}

/**
 * Γράφει την παράκαμψη στη θέση `at` του άξονα — **νέος** πίνακας, **νέο** στοιχείο, νέο
 * μοντέλο. Τρία επίπεδα αντιγραφής, γιατί και τα τρία τα βλέπει η αλυσίδα των `WeakMap`.
 *
 * Όταν η παράκαμψη φεύγει, το κλειδί γράφεται ως `undefined` αντί να αφαιρεθεί με
 * destructuring: το `JSON.stringify` **πετά** τα `undefined` πεδία, οπότε το αποθηκευμένο
 * σχήμα είναι ταυτόσημο — και ο δρόμος μένει ένας, χωρίς type assertion.
 */
function writeAxisOverride(
  model: PersistedTableModel,
  axis: TableStyleAxis,
  at: number,
  next: TableAxisStyleOverride | undefined,
): PersistedTableModel {
  if (axis === 'row') {
    const rows = model.rows.slice();
    rows[at] = { ...rows[at], styleOverride: next };
    return { ...model, rows };
  }
  const columns = model.columns.slice();
  columns[at] = { ...columns[at], styleOverride: next };
  return { ...model, columns };
}
