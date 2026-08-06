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

import { resolveTableModel } from './table-model-helpers';
// ADR-739 — ο ΕΝΑΣ βρόχος πάνω στα επιλυμένα στυλ ζει πλέον στο scan module, ώστε να τον
// μοιράζεται και ο στόχος «περιοχή κελιών». Δες την κεφαλίδα εκεί για το τι είναι κοινό και
// τι όχι.
import {
  resolveCellsFormat,
  resolveCellsNumericRange,
  type TableCellNumericKey,
  type TableCellStyleKey,
  type TableFormatState,
  type TableNumericRange,
} from './table-cell-style-scan';
import { patchStyleOverride } from './table-style-override';
import type { TableCellStyle, TableStyle } from './table-style';
import type { TableCellRef } from './table-cell-range';
import type {
  PersistedTableModel,
  TableAxisStyleOverride,
  TableColumn,
  TableRow,
} from '../../types/table';

/** Ποιον άξονα αφορά η πράξη. Το `'row'` νικά το `'column'` στην επίλυση (Α6). */
export type TableStyleAxis = 'row' | 'column';

/**
 * 🔴 ADR-739 — τα τέσσερα ονόματα που **μετακόμισαν** στο `table-cell-style-scan.ts`, μαζί με
 * τον βρόχο που τα γεννά, όταν απέκτησαν δεύτερο στόχο (περιοχή κελιών).
 *
 * Επανεξάγονται ως ψευδώνυμα και **όχι** ως μετονομασία των καταναλωτών: τα ονόματα με το
 * πρόθεμα `Axis` τα εισάγουν ήδη το mini toolbar, το `table-cell-run-ops.ts` και τα tests
 * τους. Μια μετονομασία θα άλλαζε δέκα αρχεία για μηδέν κέρδος — και θα έκρυβε, μέσα στον
 * θόρυβο, την **πραγματική** αλλαγή αυτής της φάσης (ότι ο βρόχος έγινε κοινός).
 *
 * ⚠️ Δεν είναι «παλιά» ονόματα προς κατάργηση: για τον καλούντα που μιλά **μόνο** για άξονες,
 * το `TableAxisFormatState` παραμένει το ακριβέστερο όνομα της ίδιας δομής.
 */
export type TableAxisStyleKey = TableCellStyleKey;
export type TableAxisNumericKey = TableCellNumericKey;
export type TableAxisFormatState<T> = TableFormatState<T>;
export type TableAxisNumericRange = TableNumericRange;

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
 *
 * ⚠️ Το `K` δεσμεύεται σε **ολόκληρο** το `keyof TableAxisStyleOverride`, όχι στο στενότερο
 * {@link TableAxisStyleKey}: η **γραφή** μπορεί να θέσει κάθε πεδίο που δέχεται η παράκαμψη,
 * ενώ η τομή με το επιλυμένο στυλ αφορά μόνο την **ανάγνωση** ({@link resolveAxisFormat}).
 * Η μορφή αριθμού (ADR-760) είναι ακριβώς το πεδίο που ζει στην παράκαμψη χωρίς να ζει στο
 * `TableCellStyle` — με τον στενό περιορισμό δεν θα μπορούσε ποτέ να γραφτεί σε άξονα, και η
 * μόνη διέξοδος θα ήταν δεύτερος γραφέας για ένα πεδίο.
 */
export function setAxisStyleField<K extends keyof TableAxisStyleOverride>(
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

  return writeAxisOverride(model, axis, at, patchStyleOverride(current, key, value));
}

/**
 * 🔴 ADR-739 §27.17 — **η ίδια εγγραφή σε ΟΛΟΥΣ τους επιλεγμένους άξονες**, ως μία μεταβολή.
 *
 * Καμία δεύτερη υλοποίηση: αναδίπλωση πάνω σε ό,τι γράφει έναν άξονα. Οι ταυτότητες δεν
 * αλλάζουν όταν γράφεται ο γείτονας, άρα η σειρά είναι αδιάφορη.
 *
 * 🔑 **Η εγγύηση by-reference επιβιώνει και στον πληθυντικό**: αν κανένας άξονας δεν αλλάξει
 * (πατάς «Β» σε τρεις ήδη έντονες στήλες), κάθε βήμα επιστρέφει το ίδιο αντικείμενο και το
 * τελικό αποτέλεσμα είναι **ταυτοτικά** το αρχικό μοντέλο ⇒ καμία εντολή, κανένα βήμα undo.
 * Μια υλοποίηση με `map`/`slice` θα την είχε καταστρέψει σιωπηλά.
 */
export function writeEachAxis(
  model: PersistedTableModel,
  ids: readonly string[],
  write: (model: PersistedTableModel, id: string) => PersistedTableModel,
): PersistedTableModel {
  return ids.reduce((next, id) => write(next, id), model);
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
 * Δηλώνει ο άξονας **οτιδήποτε** ρητά; Η ερώτηση του «Επαναφορά στο στυλ»: χωρίς παράκαμψη,
 * το κουμπί δεν έχει τι να σβήσει και το λέει (ανενεργό) αντί να είναι σιωπηλό no-op.
 */
export function hasAxisStyleOverride(
  model: PersistedTableModel,
  axis: TableStyleAxis,
  id: string,
): boolean {
  return axisItems(model, axis).find((item) => item.id === id)?.styleOverride !== undefined;
}

/**
 * ADR-739 §27.17 — το ίδιο για **πολλούς**: `some`, όχι `every`.
 *
 * Η ερώτηση του κουμπιού είναι «**υπάρχει τι να επαναφερθεί;**». Με τρεις στήλες όπου μόνο η
 * μία δηλώνει κάτι ρητά, η απάντηση είναι **ναι** — και το πάτημα θα την καθαρίσει. Ένα
 * `every` θα άφηνε το κουμπί ανενεργό πάνω σε πίνακα που έχει σαφώς παρακάμψεις, δηλαδή θα
 * έκρυβε τη μόνη διέξοδο επιστροφής στο στυλ.
 *
 * ⚠️ Είναι **άλλη** ερώτηση από το `overridden` του {@link resolveAxesFormat} (εκεί: `every`
 * — «το βλέπεις επειδή το ζήτησες **εσύ**»). Δύο ερωτήσεις, δύο απαντήσεις, καμία σύγχυση:
 * η μία οδηγεί **ενέργεια**, η άλλη **ένδειξη**.
 */
export function hasAnyAxisStyleOverride(
  model: PersistedTableModel,
  axis: TableStyleAxis,
  ids: readonly string[],
): boolean {
  return ids.some((id) => hasAxisStyleOverride(model, axis, id));
}

/**
 * Η κατάσταση ενός πεδίου για έναν ολόκληρο άξονα — υπολογισμένη από την **πραγματική**
 * επίλυση κάθε κελιού, όχι από την παράκαμψη μόνη της.
 *
 * 🔴 Η διάκριση είναι ουσιώδης: μια στήλη χωρίς καμία παράκαμψη περνά από γραμμή τίτλου
 * (έντονη), κεφαλίδας (έντονη) και δεδομένων (όχι) ⇒ η ειλικρινής απάντηση είναι **μεικτή**.
 * Αν διαβάζαμε μόνο το `styleOverride`, το κουμπί θα έλεγε «όχι έντονα» ενώ τα μισά κελιά
 * της στήλης είναι έντονα — δηλαδή θα έλεγε ψέματα για ό,τι βλέπει ο χρήστης.
 *
 * Τα δύο πρώτα πεδία τα απαντά ο κοινός σαρωτής· το **τρίτο** μένει εδώ και είναι ο λόγος που
 * ο σαρωτής δεν το επιστρέφει: «ρητά δηλωμένο» σημαίνει, για έναν άξονα, «το λέει το
 * `styleOverride` **της άγκυρας**» — μια ερώτηση που η περιοχή κελιών απαντά αλλιώς.
 */
export function resolveAxisFormat<K extends TableAxisStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  axis: TableStyleAxis,
  id: string,
  key: K,
): TableAxisFormatState<TableCellStyle[K]> | null {
  const anchor = axisItems(model, axis).find((item) => item.id === id);
  if (!anchor) return null;

  const shared = resolveCellsFormat(model, style, axisCellRefs(model, axis, id), key);
  if (!shared) return null;

  return { ...shared, overridden: anchor.styleOverride?.[key] !== undefined };
}

/**
 * 🔴 ADR-739 §27.17 — **η ίδια ερώτηση για ΟΛΟΥΣ τους επιλεγμένους άξονες.**
 *
 * Το `TableAxisFormatState` απαντούσε ήδη «συμφωνούν τα κελιά **ενός** άξονα;». Με τρεις
 * στήλες μαρκαρισμένες η ερώτηση γίνεται «συμφωνούν τα κελιά **και οι τρεις μεταξύ τους**;» —
 * και είναι **η ίδια** ερώτηση, ένα επίπεδο πάνω. Γι' αυτό δεν υπάρχει δεύτερος τύπος: η
 * συνάθροιση παράγει ένα κανονικό `TableAxisFormatState`, που το toolbar ήδη ξέρει να δείχνει
 * (`mixed` = Figma «Mixed», Revit «<varies>»).
 *
 * ## Οι τρεις κανόνες
 * | πεδίο | κανόνας | γιατί |
 * |---|---|---|
 * | `value` | κοινή τιμή, αλλιώς `undefined` | ό,τι βλέπει ο χρήστης, μόνο αν το βλέπει παντού |
 * | `mixed` | **οποιοσδήποτε** μεικτός ή διαφωνία | μία διαφωνία αρκεί για να μην υπάρχει «η» τιμή |
 * | `overridden` | **όλοι** το δηλώνουν ρητά | ο δείκτης λέει «το ζήτησες **εσύ**» — με έναν στους τρεις, δεν ισχύει |
 *
 * ⚠️ Το `overridden` είναι `every` ενώ το {@link hasAnyAxisStyleOverride} είναι `some`, και
 * **δεν** είναι ασυνέπεια: το πρώτο απαντά «τι βλέπω», το δεύτερο «τι θα σβήσει το κουμπί».
 *
 * Άξονες που δεν βρέθηκαν **προσπερνιούνται** (μπαγιάτικη ταυτότητα μετά από undo) αντί να
 * μηδενίσουν την απάντηση· `null` μόνο όταν δεν επιβίωσε **κανείς** — ίδια σύμβαση με το
 * {@link resolveAxisFormat}, ώστε ο καλών να μη μάθει δεύτερο κανόνα.
 */
export function resolveAxesFormat<K extends TableAxisStyleKey>(
  model: PersistedTableModel,
  style: TableStyle,
  axis: TableStyleAxis,
  ids: readonly string[],
  key: K,
): TableAxisFormatState<TableCellStyle[K]> | null {
  let combined: TableAxisFormatState<TableCellStyle[K]> | null = null;

  for (const id of ids) {
    const state = resolveAxisFormat(model, style, axis, id, key);
    if (!state) continue;
    if (!combined) {
      combined = state;
      continue;
    }
    const agree = !combined.mixed && !state.mixed && combined.value === state.value;
    combined = {
      value: agree ? combined.value : undefined,
      mixed: !agree,
      overridden: combined.overridden && state.overridden,
    };
  }

  return combined;
}

/**
 * Τα άκρα μιας **αριθμητικής** ιδιότητας κατά μήκος του άξονα — `null` αν ο άξονας δεν
 * υπάρχει ή δεν έχει κελιά.
 *
 * 🔴 Γιατί χρειάζεται χωριστά από το {@link resolveAxisFormat}: εκείνο απαντά «συμφωνούν;»
 * και σε μεικτή σειρά επιστρέφει `value: undefined` — σωστό για ένα δίτιμο κουμπί, **άχρηστο**
 * για ένα βήμα μεγέθους, που πρέπει να ξέρει *από πού* ξεκινά. Και η μεικτή σειρά **δεν είναι
 * η εξαίρεση εδώ**: κάθε στήλη περνά από γραμμή τίτλου (4mm), κεφαλίδας (3mm) και δεδομένων
 * (2.8mm), άρα το ύψος είναι μεικτό **σχεδόν πάντα**. Ένα βήμα που δεν το χειρίζεται ρητά θα
 * ήταν βήμα που δεν λειτουργεί ποτέ στην πράξη.
 */
export function resolveAxisNumericRange(
  model: PersistedTableModel,
  style: TableStyle,
  axis: TableStyleAxis,
  id: string,
  key: TableAxisNumericKey,
): TableAxisNumericRange | null {
  return resolveCellsNumericRange(model, style, axisCellRefs(model, axis, id), key);
}

/**
 * Ο κανόνας «μεικτό ⇒ όλα ναι» — **μετακόμισε** στον κοινό σαρωτή, γιατί την ίδια ερώτηση την
 * κάνει πανομοιότυπα και η μορφοποίηση περιοχής. Επανεξάγεται ώστε καμία υπάρχουσα διαδρομή
 * εισαγωγής να μην αλλάξει.
 */
export { nextBooleanFormat } from './table-cell-style-scan';

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

function axisItems(model: PersistedTableModel, axis: TableStyleAxis): readonly AxisItem[] {
  return axis === 'row' ? model.rows : model.columns;
}

/**
 * Τα κελιά ενός άξονα — δηλαδή «ποια κελιά» για τον στόχο **άξονας**, στο σχήμα που καταλαβαίνει
 * ο κοινός σαρωτής.
 *
 * Άξονας που δεν υπάρχει δίνει **κενή** λίστα και όχι σφάλμα: ο σαρωτής θα απαντήσει `false`
 * («δεν έχω τι να πω») και ο καλών το μεταφράζει σε `null` — η ίδια σύμβαση ανοχής σε
 * μπαγιάτικες ταυτότητες που ίσχυε και πριν, απλώς εκφρασμένη μία φορά αντί για δύο.
 */
function axisCellRefs(
  model: PersistedTableModel,
  axis: TableStyleAxis,
  id: string,
): readonly TableCellRef[] {
  const resolved = resolveTableModel(model);
  const rows = axis === 'row' ? [id] : resolved.rows.map((r) => r.id);
  const columns = axis === 'column' ? [id] : resolved.columns.map((c) => c.id);
  // Ο σαρωτής προσπερνά ταυτότητες που δεν υπάρχουν, οπότε ένα `id` εκτός μοντέλου δεν
  // χρειάζεται έλεγχο εδώ: θα δώσει μηδέν επισκέψεις, δηλαδή ακριβώς το ίδιο `false`.
  const refs: TableCellRef[] = [];
  for (const rowId of rows) {
    for (const colId of columns) refs.push({ rowId, colId });
  }
  return refs;
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
