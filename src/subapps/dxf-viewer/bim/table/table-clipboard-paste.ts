/**
 * 🔴 ADR-739 §57 — **Η ΕΠΙΚΟΛΛΗΣΗ ΤΟΥ ΕΣΩΤΕΡΙΚΟΥ ΠΡΟΧΕΙΡΟΥ**: περιεχόμενο, μορφή, ή ό,τι
 * υποσύνολο ζήτησε ο χρήστης. Καθαρή, αμετάβλητη, μηδέν DOM.
 *
 * ## 🔴 ΔΥΟ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ, ΟΧΙ ΜΙΑ ΛΙΣΤΑ ΤΡΟΠΩΝ
 * Ο πειρασμός είναι μια ένωση `'values' | 'formulas' | 'formats' | 'all'`. Είναι λάθος, και το
 * λάθος γίνεται ορατό στο τρίτο κουμπί: το «Επικόλληση» του Excel φέρνει **και** περιεχόμενο
 * **και** μορφή, το «Τιμές» φέρνει περιεχόμενο **χωρίς** μορφή, το «Μορφές» μορφή **χωρίς**
 * περιεχόμενο. Δηλαδή οι δύο άξονες είναι **ορθογώνιοι** και μια επίπεδη ένωση θα τους
 * ισοπέδωνε — με αποτέλεσμα ένα `'all'` που κανείς δεν μπορεί να αποσυνθέσει και ένα
 * `'formats'` που κουβαλά σιωπηλά «καμία επιλογή όψεων».
 *
 * ```
 *   Excel «Επικόλληση»        →  { content: 'formulas', facets: ΟΛΕΣ }
 *   Excel «Τιμές»             →  { content: 'values',   facets: ∅ }
 *   Excel «Τύποι»             →  { content: 'formulas', facets: ∅ }
 *   Excel «Μορφοποίηση»       →  { content: 'none',     facets: ΟΛΕΣ }
 *   🏆 ΝΕΣΤΩΡ «όψεις»         →  { content: 'none',     facets: υποσύνολο }   ← το Excel ΔΕΝ μπορεί
 * ```
 *
 * ## 🔴 Η ΠΕΡΙΟΧΗ ΟΡΙΖΕΤΑΙ ΑΠΟ ΤΟ ΦΟΡΤΙΟ, ΟΧΙ ΑΠΟ ΤΗΝ ΕΠΙΛΟΓΗ — και γι' αυτό δεν υπάρχει ασυμμετρία
 * Η αφετηρία είναι το **ενεργό κελί** και το σχήμα είναι **του προχείρου**, ψαλιδισμένο στα όρια
 * του πίνακα ({@link pastedRegion}). Είναι η υπάρχουσα σύμβαση του `pasteTsvIntoTable` («το
 * ενεργό κελί είναι η **αρχή**, όχι το σχήμα») — και η επέκτασή της στη μορφή είναι που κάνει τις
 * δύο μισές πράξεις να συμφωνούν.
 *
 * ⚠️ Χωρίς αυτόν τον κανόνα η υλοποίηση θα ήταν **ορατά ασυνεπής**: το {@link paintTableFormat}
 * **απλώνει** το μοτίβο σε ολόκληρο τον στόχο (ADR-768, σωστό για πινέλο), ενώ η επικόλληση
 * περιεχομένου **κόβει** (ρητή απόφαση του `table-range-clipboard.ts`). Επικόλληση 2×2 πάνω σε
 * μαρκαρισμένο 4×4 θα έβαφε και τα δεκαέξι κελιά αλλά θα γέμιζε μόνο τα τέσσερα. Περνώντας στον
 * ζωγράφο **την περιοχή του φορτίου** αντί για την επιλογή, το άπλωμα εκφυλίζεται σε ακριβώς ένα
 * αντίγραφο — ίδια μηχανή, καμία παράμετρος λιγότερη, μηδέν ασυμμετρία.
 *
 * ## Η επικόλληση ΤΙΜΩΝ δεν έχει δικό της γραφέα
 * Ξαναπερνά από το {@link pasteTsvIntoTable}, με είσοδο το ίδιο το {@link
 * TableClipboardPayload.text}. Δες την κεφαλίδα του `table-clipboard-payload.ts` για το γιατί
 * αυτό είναι **απόδειξη** και όχι συντόμευση.
 *
 * @module subapps/dxf-viewer/bim/table/table-clipboard-paste
 * @see bim/table/table-clipboard-payload.ts — ΤΙ κρατά το πρόχειρο
 * @see bim/table/table-fill-apply.ts — το ίδιο μοτίβο γραφής (πηγή → στόχος + ολίσθηση τύπων)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §57
 */

import { tableClipboardCellAt, type TableClipboardPayload } from './table-clipboard-payload';
import { paintTableFormat, type TableRunsPaintPolicy } from './table-format-paint';
import { clipboardTextToTableGrid, pasteTsvIntoTable, type TablePasteResult } from './table-range-clipboard';
import { isBlankCell, transferredCell } from './table-range-transfer';
import { tileTableTarget, type TableTiledSlot } from './table-range-tiling';
import { writePersistedCells } from './table-cell-content';
import { commitCellWrites } from './formula/table-formula-engine';
import { offsetTableFormula } from './formula/table-formula-offset';
import { buildMergeIndex, cellKey, indexById, resolveTableModel } from './table-model-helpers';
import { ALL_TABLE_FORMAT_FACETS, type TableFormatFacetSet } from './table-format-payload';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';
import type { TableStyle } from './table-style';
import type { PersistedTableModel, TableCell, TableModel } from '../../types/table';

/**
 * Τι από το **περιεχόμενο** ταξιδεύει.
 *
 * `'values'` γράφει ό,τι **βλέπει** ο χρήστης (ένα `=SUM(A1:A3)` προσγειώνεται ως ο αριθμός
 * του)· `'formulas'` γράφει τον **τύπο**, με τις σχετικές αναφορές του ολισθημένες. Η διαφορά
 * δεν είναι θεωρητική: μέχρι το §57 ο ΝΕΣΤΩΡ έκανε **μόνο** το πρώτο, χωρίς να το λέει πουθενά.
 */
export type TablePasteContent = 'formulas' | 'values' | 'none';

/** Τι ζήτησε ο χρήστης — οι **δύο** ορθογώνιοι άξονες. Δες την κεφαλίδα. */
export interface TablePasteRequest {
  readonly content: TablePasteContent;
  /** Κενό σύνολο ⇒ **καμία** μορφή. Δεν είναι ειδική περίπτωση: ο ζωγράφος απλώς δεν καλείται. */
  readonly facets: TableFormatFacetSet;
}

/**
 * 🔑 **ΤΙ ΣΗΜΑΙΝΕΙ ΣΚΕΤΗ «ΕΠΙΚΟΛΛΗΣΗ»** — ο ΕΝΑΣ ορισμός της προεπιλογής.
 *
 * Τον ζητούν **τέσσερις** καλούντες (`Ctrl+V`, μενού δεξιού κλικ, το κύριο μισό του split
 * κουμπιού, και το πρώτο item του πτυσσόμενού του). Γραμμένος στον καθένα, θα ήταν τέσσερις
 * ευκαιρίες να διαφωνήσουν για το αν η προεπιλογή φέρνει μορφή — και το σύμπτωμα («το Ctrl+V
 * φέρνει τα χρώματα, το κουμπί όχι») δεν δείχνει ποτέ προς την αιτία.
 */
export const FULL_TABLE_PASTE: TablePasteRequest = {
  content: 'formulas',
  facets: ALL_TABLE_FORMAT_FACETS,
};

/**
 * Επικολλά το φορτίο με πάνω-αριστερή γωνία το `anchor`.
 *
 * Επιστρέφει το **ίδιο** μοντέλο by-reference όταν τίποτα δεν άλλαξε — η εγγύηση ταυτότητας που
 * δίνουν ήδη και οι δύο υπο-πράξεις, συνεχισμένη εδώ. Σημαίνει «καμία εντολή, κανένα βήμα undo»
 * για επικόλληση που δεν έφερε τίποτα νέο (ADR-739 §6.6).
 */
export function pasteTableClipboard(
  model: PersistedTableModel,
  style: TableStyle,
  payload: TableClipboardPayload,
  anchor: TableCellRef,
  request: TablePasteRequest,
): TablePasteResult {
  const resolved = resolveTableModel(model);
  const region = pastedRegion(resolved, payload, anchor);
  if (region === null) return emptyResult(model, payload);

  const content = pasteContent(model, resolved, payload, anchor, region, request.content);
  // Η μορφή γράφεται **μετά** το περιεχόμενο και πάνω στο αποτέλεσμά του: ο ζωγράφος αγγίζει
  // μόνο `styleOverride`/`diagonal`/ακμές, οπότε η σειρά δεν αλλάζει τιμές — αλλά η αντίστροφη
  // θα έγραφε πάνω σε κελιά που δεν υπάρχουν ακόμη στον αραιό χάρτη.
  const model2 = request.facets.size === 0
    ? content.model
    : paintTableFormat(
        content.model,
        style,
        { ...payload.brush, facets: request.facets },
        region,
        runsPolicyFor(request.content),
      );

  return content.model === model2 ? content : { ...content, model: model2 };
}

/**
 * 🔴 ADR-753 §29 — **Η ΜΟΡΦΟΠΟΙΗΣΗ ΧΑΡΑΚΤΗΡΩΝ ΕΠΙΒΙΩΝΕΙ ΟΤΑΝ ΗΡΘΕ ΜΑΖΙ ΜΕ ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ.**
 *
 * Η απάντηση **παράγεται** από το `content` και δεν είναι δεύτερη σημαία: η ερώτηση του ζωγράφου
 * («είναι ξένα αυτά τα γράμματα;») έχει ήδη απαντηθεί από το ποιο περιεχόμενο ταξίδεψε.
 *
 * ```
 *   'formulas' →  το κελί-πηγή αναπαράγεται ΟΛΟΚΛΗΡΟ, τα runs γράφτηκαν ήδη  →  'preserve'
 *   'values'   →  ταξίδεψε ΜΟΝΟ κείμενο· καμία μορφοποίηση γραμμάτων δεν ήρθε →  'flatten'
 *   'none'     →  «Επικόλληση Μορφών» πάνω σε ΞΕΝΟ περιεχόμενο                →  'flatten'
 * ```
 *
 * ⚠️ Το `'values'` **δεν** είναι παράλειψη: το «Τιμές» του Excel δίνει ενιαία μορφοποίηση, και
 * τα runs που θα έβρισκε ο ζωγράφος θα ήταν του **παλιού** κειμένου του στόχου — δείκτες σε
 * γράμματα που μόλις αντικαταστάθηκαν.
 */
function runsPolicyFor(content: TablePasteContent): TableRunsPaintPolicy {
  return content === 'formulas' ? 'preserve' : 'flatten';
}

/**
 * Το ορθογώνιο που όντως καταλαμβάνει η επικόλληση: αφετηρία το ενεργό κελί, σχήμα του φορτίου,
 * **ψαλιδισμένο** στα όρια του πίνακα. `null` για μπαγιάτικο ενεργό κελί.
 *
 * Ο πίνακας **δεν μεγαλώνει μόνος του** — ίδιος κανόνας, ίδιο σκεπτικό με το `pasteTsvIntoTable`:
 * σιωπηλή μεταβολή γεωμετρίας οντότητας σχεδίου από πάτημα κουμπιού είναι μη αναστρέψιμη έκπληξη
 * σε στοίβα undo CAD.
 */
function pastedRegion(
  model: TableModel,
  payload: TableClipboardPayload,
  anchor: TableCellRef,
): TableCellRangeBounds | null {
  const firstRow = indexById(model.rows).get(anchor.rowId);
  const firstCol = indexById(model.columns).get(anchor.colId);
  if (firstRow === undefined || firstCol === undefined) return null;

  return {
    firstRow,
    firstCol,
    lastRow: Math.min(firstRow + payload.rows - 1, model.rows.length - 1),
    lastCol: Math.min(firstCol + payload.columns - 1, model.columns.length - 1),
  };
}

/** Ο διακλαδωτής του περιεχομένου — τρεις δρόμοι, κανένας τους δεύτερος γραφέας. */
function pasteContent(
  model: PersistedTableModel,
  resolved: TableModel,
  payload: TableClipboardPayload,
  anchor: TableCellRef,
  region: TableCellRangeBounds,
  content: TablePasteContent,
): TablePasteResult {
  // ⚠️ «Καμία τιμή» **δεν** σημαίνει «τίποτα δεν χώρεσε»: μια επικόλληση μόνο-μορφής καταλαμβάνει
  // κανονικά την περιοχή της. Με μηδενικά εδώ, η αναφορά του §54 θα προειδοποιούσε ψευδώς «δεν
  // χώρεσαν όλα» σε κάθε «Επικόλληση Μορφοποίησης» — μήνυμα που ο χρήστης μαθαίνει να αγνοεί,
  // και μαζί του αγνοεί κι εκείνα που μετράνε.
  if (content === 'none') {
    return { model, ...regionCounts(region, payload), skippedMergedCells: 0 };
  }
  // 🔑 Οι **τιμές** περνούν από τον ΕΞΩΤΕΡΙΚΟ δρόμο, με το δικό μας κείμενο ως είσοδο. Δες την
  // κεφαλίδα του `table-clipboard-payload.ts`: είναι η κατασκευή που κάνει αποδείξιμο ότι το
  // «Επικόλληση Τιμών» δίνει ό,τι ακριβώς θα έδινε το ίδιο αντίγραφο μέσα από το Excel.
  if (content === 'values') {
    return pasteTsvIntoTable(model, anchor, clipboardTextToTableGrid(payload.text));
  }
  return pasteCells(model, resolved, payload, region);
}

/**
 * Η επικόλληση **περιεχομένου με τους τύπους του**.
 *
 * Ίδιο μοτίβο, γραμμή προς γραμμή, με το {@link applyTableFill}: μαζικός γραφέας (ένα πέρασμα,
 * όχι `findIndex` ανά κελί), `transferredCell` ως ο ΕΝΑΣ ορισμός του «τι ταξιδεύει», και
 * `commitCellWrites` που χρεώνεται τον επαναϋπολογισμό ώστε να μην μπορεί να ξεχαστεί (§47.5).
 */
function pasteCells(
  model: PersistedTableModel,
  resolved: TableModel,
  payload: TableClipboardPayload,
  region: TableCellRangeBounds,
): TablePasteResult {
  const slots = tileTableTarget(resolved, region, {
    rows: payload.rows,
    columns: payload.columns,
    originRow: region.firstRow,
    originCol: region.firstCol,
  });
  // **Καλυμμένα** κελιά παραλείπονται, με τον ίδιο λόγο που τα παραλείπει και η επικόλληση TSV:
  // δεν ζωγραφίζονται πουθενά, άρα το κείμενο θα εξαφανιζόταν από την οθόνη ενώ θα υπήρχε στο
  // αρχείο — η χειρότερη έκβαση, γιατί ο χρήστης δεν έχει τρόπο να τη δει.
  const covered = buildMergeIndex(resolved).covered;
  const targets = slots.filter((slot) => !covered.has(cellKey(slot.at.rowId, slot.at.colId)));

  const byTarget = new Map<string, TableTiledSlot>();
  for (const slot of targets) byTarget.set(refKey(slot.at.rowId, slot.at.colId), slot);

  const written = writePersistedCells(model, targets.map((slot) => slot.at), {
    update: (existing, at) => pastedCell(resolved, payload, byTarget.get(refKey(at.rowId, at.colId)), existing),
    create: (at) => {
      const next = pastedCell(resolved, payload, byTarget.get(refKey(at.rowId, at.colId)), undefined);
      // Κενή πηγή σε κελί που δεν υπάρχει: καμία εγγραφή-φάντασμα. Ο αραιός χάρτης σημαίνει ήδη «κενό».
      return next !== null && isBlankCell(next) ? null : next;
    },
  });

  return {
    ...regionCounts(region, payload),
    model: commitCellWrites(written),
    skippedMergedCells: slots.length - targets.length,
  };
}

/**
 * Το τελικό κελί: ό,τι κουβαλά η πηγή, με τον τύπο του **ολισθημένο** κατά τη μετατόπιση
 * πηγής → στόχου.
 *
 * ## 🔴 Η ΜΕΤΑΤΟΠΙΣΗ ΜΕΤΡΙΕΤΑΙ ΑΠΟ ΤΟ `origin` ΤΟΥ ΦΟΡΤΙΟΥ, ΟΧΙ ΑΠΟ ΓΕΙΤΟΝΙΑ
 * Η λαβή συμπλήρωσης παίρνει τη μετατόπιση δωρεάν από το `tileTableRange`, γιατί εκεί η πηγή
 * είναι **γειτονική εξ ορισμού** και ζει στο ίδιο μοντέλο. Το πρόχειρο δεν έχει τέτοια σχέση: η
 * πηγή μπορεί να έχει **διαγραφεί**. Γι' αυτό το φορτίο κουβαλά τους δείκτες της αφετηρίας του —
 * η μόνη πληροφορία που επιβιώνει και η μόνη που χρειάζεται.
 *
 * ⚠️ **Επικόλληση σε ΑΛΛΟΝ πίνακα ⇒ `#REF!`, δηλωμένα.** Οι αναφορές του τύπου δείχνουν σε
 * ταυτότητες κελιών του πίνακα-πηγής· ο μετατοπιστής τις ψάχνει στο **μοντέλο του στόχου**, δεν
 * τις βρίσκει, και γράφει `#REF!` όπως ακριβώς κάνει για αναφορά που πέφτει εκτός πλέγματος.
 * Είναι η τίμια απάντηση: δεν υπάρχει έννοια «αναφορά σε άλλον πίνακα» στο μοντέλο, και ένας
 * τύπος που θα **έμοιαζε** σωστός δείχνοντας στο ομώνυμο κελί του νέου πίνακα θα ήταν αθόρυβα
 * λάθος αριθμός σε παραδοτέο (ADR-720).
 */
function pastedCell(
  target: TableModel,
  payload: TableClipboardPayload,
  slot: TableTiledSlot | undefined,
  existing: TableCell | undefined,
): TableCell | null {
  if (slot === undefined) return null;

  const source = tableClipboardCellAt(payload, slot.patternRow, slot.patternCol);
  const next = transferredCell(source, existing);
  if (next.formula === undefined) return next;

  const formula = offsetTableFormula(target, next.formula, {
    rows: slot.rowIndex - (payload.origin.row + slot.patternRow),
    columns: slot.colIndex - (payload.origin.col + slot.patternCol),
  });
  return formula === next.formula ? next : { ...next, formula };
}

/** Ίδιο **τοπικό** κλειδί με τον μαζικό γραφέα — δες εκεί γιατί δεν περνά από το branded `cellKey()`. */
function refKey(rowId: string, colId: string): string {
  return `${rowId} ${colId}`;
}

/** Τι προσφέρθηκε και τι χώρεσε — τα τέσσερα νούμερα που θέλει ένα τίμιο μήνυμα. */
function regionCounts(
  region: TableCellRangeBounds,
  payload: TableClipboardPayload,
): Pick<TablePasteResult, 'offeredRows' | 'offeredColumns' | 'fittedRows' | 'fittedColumns'> {
  return {
    offeredRows: payload.rows,
    offeredColumns: payload.columns,
    fittedRows: Math.max(region.lastRow - region.firstRow + 1, 0),
    fittedColumns: Math.max(region.lastCol - region.firstCol + 1, 0),
  };
}

/** Τίποτα δεν χώρεσε, τίποτα δεν άλλαξε — ποτέ σιωπηλή επιτυχία. */
function emptyResult(model: PersistedTableModel, payload: TableClipboardPayload): TablePasteResult {
  return {
    model,
    offeredRows: payload.rows,
    offeredColumns: payload.columns,
    fittedRows: 0,
    fittedColumns: 0,
    skippedMergedCells: 0,
  };
}
