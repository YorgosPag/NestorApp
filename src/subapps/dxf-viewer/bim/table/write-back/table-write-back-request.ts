/**
 * 🔴 ADR-769 Δ1 — **ΤΟ ΑΙΤΗΜΑ ΣΥΝΑΡΜΟΛΟΓΕΙΤΑΙ ΕΔΩ**: από «κελί + κείμενο» σε «τι ζητά ο πίνακας».
 *
 * Ο {@link planTableWriteBack} είναι **κριτής**, όχι συλλέκτης: δέχεται έτοιμο αίτημα και το
 * κρίνει. Κάποιος πρέπει να μαζέψει τα τέσσερα κομμάτια — τη **δομική** απόφαση της στήλης, τη
 * **βάση σύγκρισης** της γραμμής, τι λέει **η πηγή τώρα**, και τον **τύπο τιμής** για τις
 * μονάδες. Αυτό είναι εδώ, και είναι **καθαρό**: το context δεδομένων έρχεται ως όρισμα
 * (`readTableSourceContext`, η ΜΙΑ γέφυρα), όχι διαβασμένο από store.
 *
 * ## 🔑 Γιατί το `rowBasis` είναι οι **ΥΠΟΛΟΙΠΕΣ** στήλες
 * Είναι το «content last read» του optimistic concurrency control (§3.4). Ο χρήστης κοίταξε τη
 * γραμμή, αναγνώρισε **από τα άλλα κελιά** ότι είναι «η γραμμή του ΣΤ3», και μετά έγραψε. Η
 * στήλη που γράφεται εξαιρείται εξ ορισμού: εκεί η διαφορά είναι ο **σκοπός** της πράξης, όχι
 * ένδειξη ότι η πηγή κουνήθηκε.
 *
 * ## 🔴 Το `undefined` γραμμής πηγής **δεν** ισοπεδώνεται
 * Γραμμή που η πηγή δεν καλύπτει (ο πίνακας έχει 30 γραμμές, η αποτύπωση 12) δίνει
 * `liveRow: undefined` ⇒ `source-unavailable`. Ένα `{}` θα σήμαινε «η πηγή απάντησε και η
 * γραμμή είναι κενή», δηλαδή θα περνούσε τον CAS με ψεύτικη συμφωνία και θα έγραφε σε σημείο
 * που **δεν υπάρχει**. Ίδια διάκριση με το `TableSourceContext` του ADR-767 §11.2.
 *
 * @module subapps/dxf-viewer/bim/table/write-back/table-write-back-request
 * @see bim/table/write-back/table-write-back-plan.ts — ο κριτής (οι 6 φρουροί)
 * @see docs/centralized-systems/reference/adrs/ADR-769-table-live-write-back.md §4 Δ1, Δ3
 */

import { boundSourceRowIndex } from '../binding/table-binding-cells';
import { findPersistedCell } from '../table-cell-content';
import { resolveTableCellWriteRoute } from './table-cell-write-route';
import { resolveTableSource, tableSourceColumn } from '../binding/table-source-resolver';
import { planTableWriteBack } from './table-write-back-plan';
import type { TableSourceContext } from '../binding/table-source-resolver';
import type {
  TableColumnWriteBack,
  TableWriteBackBasis,
  TableWriteBackPlan,
} from './table-write-back-plan';
import type { ScheduleCellValue } from '../../schedule/types';
import type {
  PersistedTableModel,
  TableBinding,
  TableColumnId,
  TableRowId,
} from '../../../types/table';

export interface TableWriteBackAsk {
  readonly model: PersistedTableModel;
  readonly binding: TableBinding;
  /** Ό,τι έχει ήδη διαβάσει ο καλών από τη σκηνή — η ΜΙΑ γέφυρα, ποτέ store εδώ. */
  readonly context: TableSourceContext;
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  /** Ό,τι πληκτρολόγησε ο χρήστης, σε μονάδες **ΟΘΟΝΗΣ**. */
  readonly nextDisplayValue: ScheduleCellValue;
}

/**
 * Το αίτημα του πίνακα, **κριμένο** — μαζί με τον δείκτη της γραμμής-στόχου στην πηγή.
 *
 * Ο δείκτης ταξιδεύει δίπλα στο πλάνο και όχι μέσα του επειδή είναι **εντοπισμός**, όχι
 * απόφαση: ο κριτής δεν χρειάζεται να ξέρει πού κάθεται η γραμμή για να πει αν η γραφή
 * επιτρέπεται, και ο εκτελεστής δεν επιτρέπεται να τον ξαναϋπολογίσει.
 */
export interface TableWriteBackRequest {
  readonly sourceRowIndex: number;
  readonly plan: TableWriteBackPlan;
}

/**
 * 🔴 **Ό,τι πληκτρολόγησε ο άνθρωπος, ως τιμή κελιού** — η γέφυρα από `<input>` σε δεδομένα.
 *
 * Τρεις καταστάσεις και καμία τέταρτη:
 *   - **κενό** (ή μόνο κενά) ⇒ `null`. ⚠️ **ΠΟΤΕ `0`**: το `Number('')` είναι `0` στη
 *     JavaScript, και ένα κατασκευασμένο μηδενικό σε πίνακα συντεταγμένων που **υπογράφεται**
 *     είναι δηλωμένη μέτρηση που κανείς δεν πήρε (ADR-720). Ο έλεγχος του κενού **προηγείται**
 *     της μετατροπής ακριβώς γι' αυτό.
 *   - **αριθμητικό** ⇒ αριθμός, σε μονάδες **οθόνης**.
 *   - **οτιδήποτε άλλο** ⇒ το κείμενο αυτούσιο· ο κριτής θα το απορρίψει ρητά
 *     (`invalid-value`) αν η στήλη είναι αριθμητική, αντί να μαντέψει `NaN`.
 */
export function tableCellInputValue(text: string): ScheduleCellValue {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

/**
 * Τι ζητά ο πίνακας για αυτό το κελί — ή `null` όταν **δεν ζητά τίποτα**.
 *
 * 🔴 `null` σημαίνει «αυτό το κελί γράφεται **στο μοντέλο**», δηλαδή ο καλών συνεχίζει τον
 * κανονικό του δρόμο (`buildTableCellEditCommand`). Δεν σημαίνει «απέτυχε»: κάθε άρνηση
 * επιστρέφεται ως **πλάνο με λόγο**, ποτέ ως απουσία.
 */
export function askTableWriteBack(ask: TableWriteBackAsk): TableWriteBackRequest | null {
  const { model, binding, rowId, colId } = ask;
  const route = resolveTableCellWriteRoute(model, binding, rowId, colId);
  if (route.kind === 'model') return null;

  const sourceRowIndex = boundSourceRowIndex(model, rowId);
  const sourceKey = route.kind === 'owner' ? route.sourceKey : '';
  const column: TableColumnWriteBack =
    route.kind === 'owner'
      ? { kind: 'writable', field: route.field }
      : { kind: 'unwritable', reason: route.reason ?? 'no-owner' };

  return {
    sourceRowIndex,
    plan: planTableWriteBack({
      column,
      sourceKey,
      valueType: tableSourceColumn(binding.sourceRef.kind, sourceKey)?.valueType ?? 'text',
      cell: findPersistedCell(model, rowId, colId),
      nextDisplayValue: ask.nextDisplayValue,
      rowBasis: rowBasisFor(model, rowId, colId),
      liveRow: liveRowFor(ask, sourceRowIndex),
    }),
  };
}

/**
 * Η **βάση σύγκρισης** της γραμμής: τι έλεγε η πηγή για τις **υπόλοιπες** δεμένες στήλες την
 * τελευταία φορά που αυτό το κελί επιλύθηκε.
 *
 * Κελί χωρίς `bound` παραλείπεται αντί να δώσει `null` ως βάση: «δεν έχω βάση» δεν είναι «η
 * βάση ήταν κενή», και μια ψεύτικη βάση θα κήρυσσε `source-moved` σε κάθε γραμμή που έχει έστω
 * ένα ελεύθερο κελί μέσα σε δεμένη στήλη.
 */
function rowBasisFor(
  model: PersistedTableModel,
  rowId: TableRowId,
  writtenColId: TableColumnId,
): readonly TableWriteBackBasis[] {
  const basis: TableWriteBackBasis[] = [];
  for (const column of model.columns) {
    if (column.id === writtenColId || column.sourceKey === undefined) continue;
    const bound = findPersistedCell(model, rowId, column.id)?.bound;
    if (bound === undefined) continue;
    basis.push({ sourceKey: column.sourceKey, sourceValue: bound.sourceValue });
  }
  return basis;
}

/**
 * Τι λέει **η πηγή τώρα** για τη γραμμή-στόχο — `undefined` σε κάθε περίπτωση όπου κανείς δεν
 * μπόρεσε να ρωτήσει: πηγή που δεν επιλύεται, γραμμή που δεν είναι δεδομένο, γραμμή που η πηγή
 * δεν καλύπτει. Και οι τρεις είναι το ίδιο για τον φρουρό, και είναι **άρνηση**, όχι σιωπή.
 */
function liveRowFor(
  ask: TableWriteBackAsk,
  sourceRowIndex: number,
): Readonly<Record<string, ScheduleCellValue>> | undefined {
  if (sourceRowIndex < 0) return undefined;
  const resolution = resolveTableSource(ask.binding.sourceRef, ask.context);
  if (resolution.status !== 'resolved') return undefined;
  return resolution.table.rows[sourceRowIndex]?.cells;
}
