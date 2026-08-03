/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **ΤΙ ΘΑ ΓΙΝΕΙ ΑΝ ΑΦΗΣΩ ΕΔΩ ΤΟ ΠΟΝΤΙΚΙ**: η μεταφορά περιοχής
 * ως **σχέδιο**, πριν αγγιχτεί μοντέλο. Καθαρή γεωμετρία — μηδέν React, μηδέν DOM, μηδέν store.
 *
 * ## Γιατί σχέδιο και όχι κατευθείαν νέο μοντέλο
 * Την **ίδια** ερώτηση τη ρωτούν **τρεις** ανεξάρτητοι καταναλωτές, σε **τρεις** διαφορετικές
 * στιγμές:
 *
 * ```
 *   Φάση 3 (η χειρονομία)  →  «είναι νόμιμο εδώ, και πού ακριβώς προσγειώνεται;»  — ΑΝΑ ΚΑΡΕ
 *   Φάση 4 (ο διάλογος)    →  «θα χαθεί κάτι;»                                    — μία φορά
 *   Φάση 3 (το drop)       →  «κάνε το»                                           — μία φορά
 * ```
 *
 * Αν η απάντηση γεννιόταν μόνο μαζί με το νέο μοντέλο, το φάντασμα του προορισμού θα έπρεπε να
 * **χτίζει ολόκληρο μοντέλο ανά καρέ** για να μάθει αν επιτρέπεται — δηλαδή ακριβώς το σχήμα
 * «δουλειά ανάλογη του χρόνου, όχι της αλλαγής» που ο ADR-735 πλήρωσε σε παραγωγή. Και ο
 * διάλογος θα έπρεπε να **επαναλάβει** τη γεωμετρία για να μαντέψει τι θα σβηστεί: δεύτερη
 * απάντηση στην ίδια ερώτηση, δηλαδή η «τέταρτη μηχανή πίνακα» του §15.
 *
 * ## 🔑 Η ΑΝΑΠΑΡΑΣΤΑΣΗ: **ΟΛΙΚΗ ΣΥΝΑΡΤΗΣΗ**, ΟΧΙ ΤΡΕΙΣ ΛΙΣΤΕΣ
 * Ο πειρασμός είναι τρία σύνολα («τι γράφεται», «τι σβήνεται», «τι ολισθαίνει»). Το σχέδιο είναι
 * αντ' αυτού **μία** λίστα από `TableCellFill`: *για κάθε κελί που αγγίζει η πράξη, από πού
 * παίρνει περιεχόμενο — ή `null` αν αδειάζει*. Τρία κέρδη, όλα μετρήσιμα:
 *
 * 1. Η **αντιγραφή**, η **μετακίνηση** και η **εισαγωγή-&-ολίσθηση** γίνονται ο ίδιος
 *    εφαρμοστής — καμία τριπλή ουρά στο `apply`.
 * 2. Το κατηγόρημα «θα χαθούν δεδομένα;» βγαίνει **δωρεάν και σωστά** για τις τρεις: χάνεται
 *    ό,τι είναι **στόχος** χωρίς να είναι **πηγή** κάπου αλλού
 *    ({@link tableRangeTransferOverwrites}). Με τρεις λίστες, η ολίσθηση θα δήλωνε ψευδώς ότι
 *    σβήνει τα κελιά που απλώς **σπρώχνει**.
 * 3. Η απεικόνιση των τύπων («ποια αναφορά ακολουθεί πού») **είναι** αυτή η λίστα, χωρίς δεύτερη
 *    παραγωγή — δες `formula/table-formula-remap.ts`.
 *
 * ## Τι ΔΕΝ ξέρει
 * Δεν γράφει κελιά, δεν ξέρει από ακμές, από επαναϋπολογισμό ή από εντολές undo (όλα αυτά ζουν
 * στο `table-range-transfer.ts`), και δεν ξέρει καμία λέξη σε καμία γλώσσα: οι λόγοι άρνησης
 * είναι **κλειδιά**, τα μηνύματα ζουν στα locale JSON (Φάση 4, N.11).
 *
 * @module subapps/dxf-viewer/bim/table/table-range-transfer-plan
 * @see bim/table/table-range-shift-plan.ts — η ολίσθηση ως μετάθεση θέσεων
 * @see bim/table/table-range-transfer.ts — ο εφαρμοστής
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { CellSpan, PersistedTableModel, TableModel } from '../../types/table';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';
import type {
  TableCellFill,
  TableMergeMove,
  TableRangeLanding,
  TableRangeTransferOutcome,
  TableRangeTransferPlan,
  TableRangeTransferRequest,
} from './table-range-transfer-types';
import { planTableRangeShift, tableRangeShiftDisturbedBand } from './table-range-shift-plan';
import { cellText, getCell, indexById, resolveTableModel } from './table-model-helpers';

/**
 * **Το σχέδιο μιας μεταφοράς περιοχής** — ή ο λόγος που δεν γίνεται.
 *
 * Η περιοχή προσγειώνεται **ακέραιη ή καθόλου** (`'outside-grid'`) αντί να κοπεί. Είναι
 * διαφορετική στάση από την **επικόλληση**, που κόβει ό,τι περισσεύει — και σκόπιμα: εκεί το
 * πλέγμα έρχεται από τον **έξω κόσμο** και ο χρήστης δεν το ελέγχει, ενώ εδώ κρατά το ποντίκι
 * πάνω στον προορισμό και μπορεί να τον μετακινήσει. Μια σιωπηλά μισή μετακίνηση θα ήταν η
 * χειρότερη έκβαση: το φάντασμα υπόσχεται ένα σχήμα και το drop παραδίδει άλλο.
 */
export function planTableRangeTransfer(
  model: PersistedTableModel,
  request: TableRangeTransferRequest,
): TableRangeTransferOutcome {
  const { source, to, intent } = request;
  if (!isInsideGrid(model, source)) return { ok: false, reason: 'stale-range' };

  const dropped = droppedRectOf(model, source, to);
  if (dropped === null) return { ok: false, reason: 'stale-range' };
  if (dropped.firstRow === source.firstRow && dropped.firstCol === source.firstCol) {
    return { ok: false, reason: 'no-movement' };
  }

  const laid = intent.insert
    ? planTableRangeShift(model, request, dropped)
    : planPlain(model, source, dropped, intent.copy);
  if (laid === null) return { ok: false, reason: 'outside-grid' };

  const guard = intent.insert
    ? tableRangeShiftDisturbedBand(model, request, dropped)
    : laid.destination;
  const mergeMoves = mergesTravellingWith(model, source, laid.destination, guard);
  if (mergeMoves === null) return { ok: false, reason: 'merged-target' };

  return { ok: true, plan: { source, ...laid, intent, mergeMoves } };
}

/**
 * 🔴 **ΘΑ ΧΑΘΕΙ ΚΑΤΙ ΑΝ ΤΟ ΑΦΗΣΩ ΕΔΩ;** — το κατηγόρημα που τροφοδοτεί τον διάλογο της Φάσης 4.
 *
 * Ο ορισμός είναι **δομικός**, όχι λίστα περιπτώσεων: χάνεται το περιεχόμενο ενός κελιού που
 * είναι **στόχος** κάποιου γεμίσματος χωρίς να είναι **πηγή** κάποιου άλλου. Από αυτόν τον έναν
 * κανόνα βγαίνουν σωστά και οι τρεις πράξεις:
 *
 * - **Μετακίνηση / αντιγραφή**: τα κελιά του προορισμού αντικαθίστανται και δεν πάνε πουθενά ⇒ ναι.
 * - **Εισαγωγή & ολίσθηση**: τα υπάρχοντα **σπρώχνονται**, άρα είναι και πηγές ⇒ **όχι** — εκτός
 *   από όσα βγαίνουν έξω από το πλέγμα στην ουρά της ολίσθησης, που όντως χάνονται.
 * - **Μετακίνηση**: τα κελιά της πηγής αδειάζουν, αλλά το περιεχόμενό τους μετακόμισε ⇒ όχι.
 *
 * ## Τι μετράει ως «δεδομένα» — Excel parity, ρητά
 * Το μήνυμα του Excel λέει *«There's already data here»*: **περιεχόμενο**, όχι μορφοποίηση. Ένα
 * κελί βαμμένο αλλά κενό **δεν** γεννά ερώτηση — αλλιώς η ερώτηση θα εμφανιζόταν σχεδόν πάντα
 * (οι γραμμές κεφαλίδας είναι βαμμένες) και θα έπαυε να σημαίνει κάτι. Η μορφοποίηση του
 * προορισμού πράγματι αντικαθίσταται· αυτό είναι μέρος της απόφασης «τι ταξιδεύει» και είναι
 * **ορατό** στο φάντασμα της Φάσης 3, όχι κρυφό.
 */
export function tableRangeTransferOverwrites(
  model: PersistedTableModel,
  plan: TableRangeTransferPlan,
): boolean {
  const relocated = new Set<string>();
  for (const fill of plan.fills) {
    if (fill.from !== null) relocated.add(refKey(fill.from));
  }

  const resolved = resolveTableModel(model);
  for (const fill of plan.fills) {
    if (relocated.has(refKey(fill.at))) continue;
    if (hasCellContent(resolved, fill.at)) return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Σκέτη απόθεση — μετακίνηση και αντιγραφή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μετακίνηση και αντιγραφή: **το ίδιο σώμα**, με μία διαφορά — η μετακίνηση αδειάζει ό,τι
 * αφήνει πίσω της.
 *
 * «Πίσω της» σημαίνει «κελί της πηγής που **δεν** το ξανασκεπάζει ο προορισμός»: σε
 * επικαλυπτόμενο σύρσιμο (η περιοχή πάνω στον εαυτό της, μετατοπισμένη κατά ένα κελί) τα κοινά
 * κελιά ξαναγράφονται ούτως ή άλλως, και ένα άδειασμά τους θα ακύρωνε το γράψιμο ή θα εξαρτιόταν
 * από τη σειρά εφαρμογής — δηλαδή θα ήταν σφάλμα που εμφανίζεται μόνο σε μία κατεύθυνση σύρσης.
 */
function planPlain(
  model: PersistedTableModel,
  source: TableCellRangeBounds,
  destination: TableCellRangeBounds,
  copy: boolean,
): TableRangeLanding | null {
  if (!isInsideGrid(model, destination)) return null;

  const fills: TableCellFill[] = [];
  const { rows, columns } = model;
  for (let r = 0; r <= source.lastRow - source.firstRow; r++) {
    for (let c = 0; c <= source.lastCol - source.firstCol; c++) {
      const from = { rowId: rows[source.firstRow + r].id, colId: columns[source.firstCol + c].id };
      fills.push({
        at: { rowId: rows[destination.firstRow + r].id, colId: columns[destination.firstCol + c].id },
        from,
      });
      if (!copy && !containsCell(destination, source.firstRow + r, source.firstCol + c)) {
        fills.push({ at: from, from: null });
      }
    }
  }
  return { destination, fills };
}

// ──────────────────────────────────────────────────────────────────────────────
// Γεωμετρία
// ──────────────────────────────────────────────────────────────────────────────

/** Το ορθογώνιο που **δείχνει** το ποντίκι (αφελής μετατόπιση)· `null` για μπαγιάτικο κελί. */
function droppedRectOf(
  model: PersistedTableModel,
  source: TableCellRangeBounds,
  to: TableCellRef,
): TableCellRangeBounds | null {
  const firstRow = indexById(model.rows).get(to.rowId);
  const firstCol = indexById(model.columns).get(to.colId);
  if (firstRow === undefined || firstCol === undefined) return null;
  return {
    firstRow,
    lastRow: firstRow + (source.lastRow - source.firstRow),
    firstCol,
    lastCol: firstCol + (source.lastCol - source.firstCol),
  };
}

/** Χωράει ολόκληρο το ορθογώνιο μέσα στο πλέγμα; Ο πίνακας **δεν** μεγαλώνει μόνος του. */
function isInsideGrid(model: PersistedTableModel, bounds: TableCellRangeBounds): boolean {
  return (
    bounds.firstRow >= 0 &&
    bounds.firstCol >= 0 &&
    bounds.lastRow < model.rows.length &&
    bounds.lastCol < model.columns.length &&
    bounds.firstRow <= bounds.lastRow &&
    bounds.firstCol <= bounds.lastCol
  );
}

/** Τέμνονται τα δύο ορθογώνια; */
function rectsIntersect(a: TableCellRangeBounds, b: TableCellRangeBounds): boolean {
  return (
    a.firstRow <= b.lastRow && b.firstRow <= a.lastRow && a.firstCol <= b.lastCol && b.firstCol <= a.lastCol
  );
}

/** Περιέχει το `outer` ολόκληρο το `inner`; */
function containsRect(outer: TableCellRangeBounds, inner: TableCellRangeBounds): boolean {
  return (
    inner.firstRow >= outer.firstRow &&
    inner.lastRow <= outer.lastRow &&
    inner.firstCol >= outer.firstCol &&
    inner.lastCol <= outer.lastCol
  );
}

/** Είναι το κελί (σε δείκτες) μέσα στο ορθογώνιο; */
function containsCell(bounds: TableCellRangeBounds, row: number, col: number): boolean {
  return row >= bounds.firstRow && row <= bounds.lastRow && col >= bounds.firstCol && col <= bounds.lastCol;
}

// ──────────────────────────────────────────────────────────────────────────────
// Συγχωνεύσεις — η μία άρνηση που κληρονομούμε από το Excel
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι συγχωνεύσεις που **ταξιδεύουν**, ήδη μετατοπισμένες — ή `null` όταν η πράξη απορρίπτεται.
 *
 * ## Οι δύο κανόνες, και γιατί ο δεύτερος είναι άρνηση
 * 1. Συγχώνευση **ολόκληρη μέσα στην πηγή** ταξιδεύει: η άγκυρα μετατοπίζεται, τα εύρη μένουν.
 *    Η επιλογή είδους `'range'` **κουμπώνει** ήδη σε ολόκληρες συγχωνεύσεις
 *    (`snapToWholeMerges`), οπότε η πηγή είναι εξ ορισμού «καθαρή» — μισή συγχώνευση δεν μπορεί
 *    καν να επιλεγεί.
 * 2. Η **ζώνη που αναταράσσεται** όμως δεν είναι. Συγχώνευση που **επιβιώνει** και την τέμνει
 *    σημαίνει είτε ότι το εισερχόμενο περιεχόμενο θα έπεφτε πάνω σε **καλυμμένα** κελιά — δηλαδή
 *    θα **εξαφανιζόταν από την οθόνη ενώ θα υπήρχε στο αρχείο** (το επιχείρημα που τεκμηριώνει
 *    το `skippedMergedCells` της επικόλλησης) — είτε, στην ολίσθηση, ότι η μετάθεση θα τη
 *    **σχιζε**.
 *
 * Στην επικόλληση προτιμήθηκε η μερική επιτυχία γιατί το πλέγμα ερχόταν από τον έξω κόσμο· εδώ ο
 * χρήστης κρατά το ποντίκι, άρα η **άρνηση με λόγο** είναι η τίμια απάντηση — ακριβώς η στάση
 * του Excel (*«We can't do that to a merged cell»*).
 *
 * «Ταξιδεύει» ορίζεται πάντα ως προς την **πηγή**· η άρνηση πάντα ως προς τη **ζώνη**. Χωρίς
 * αυτή τη διάκριση, το σύρσιμο μιας συγχωνευμένης περιοχής **πάνω στον εαυτό της** (μετατόπιση
 * κατά ένα κελί) θα απορριπτόταν επειδή συγκρούεται με τη συγχώνευση **που η ίδια η πράξη
 * αφαιρεί**.
 */
function mergesTravellingWith(
  model: PersistedTableModel,
  source: TableCellRangeBounds,
  destination: TableCellRangeBounds,
  guard: TableCellRangeBounds,
): readonly TableMergeMove[] | null {
  const rowIndex = indexById(model.rows);
  const colIndex = indexById(model.columns);
  const dRow = destination.firstRow - source.firstRow;
  const dCol = destination.firstCol - source.firstCol;

  const moved: TableMergeMove[] = [];
  for (const span of model.merges) {
    const rect = spanRect(span, rowIndex, colIndex);
    if (rect === null) continue; // ορφανή άγκυρα — ίδια ανοχή με το `buildMergeIndex`
    if (containsRect(source, rect)) {
      const anchorRow = model.rows[rect.firstRow + dRow];
      const anchorCol = model.columns[rect.firstCol + dCol];
      if (anchorRow === undefined || anchorCol === undefined) return null;
      moved.push({ from: span, to: { ...span, anchorRowId: anchorRow.id, anchorColId: anchorCol.id } });
      continue;
    }
    if (rectsIntersect(guard, rect)) return null;
  }
  return moved;
}

/** Το ορθογώνιο μιας συγχώνευσης σε δείκτες· `null` για ορφανή άγκυρα. */
function spanRect(
  span: CellSpan,
  rowIndex: ReadonlyMap<string, number>,
  colIndex: ReadonlyMap<string, number>,
): TableCellRangeBounds | null {
  const firstRow = rowIndex.get(span.anchorRowId);
  const firstCol = colIndex.get(span.anchorColId);
  if (firstRow === undefined || firstCol === undefined) return null;
  return {
    firstRow,
    lastRow: firstRow + Math.max(span.rowSpan, 1) - 1,
    firstCol,
    lastCol: firstCol + Math.max(span.colSpan, 1) - 1,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Κοινά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Κλειδί σύγκρισης ταυτότητας κελιού **τοπικό σε αυτό το αρχείο** — γι' αυτό δεν περνά από το
 * branded `cellKey()`: εκείνο υπάρχει για να μη διαρρέει χειροποίητο string σε καλούντες, και εδώ
 * δεν διαρρέει πουθενά (ίδιο σκεπτικό με το `writePersistedCells`).
 */
function refKey(ref: TableCellRef): string {
  return `${ref.rowId} ${ref.colId}`;
}

/** Έχει το κελί **περιεχόμενο**; Ένας τύπος μετρά πάντα, ακόμη κι όταν δίνει κενό αποτέλεσμα. */
function hasCellContent(model: TableModel, ref: TableCellRef): boolean {
  const cell = getCell(model, ref.rowId, ref.colId);
  if (cell === undefined) return false;
  return cell.kind === 'formula' || cellText(cell) !== '';
}
