'use client';

/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 4) — **ΤΙ ΓΙΝΕΤΑΙ ΜΕΤΑ ΤΟ `mouseup`**: ρώτα αν χάνονται δεδομένα, μετά
 * γράψε. Το ένα βήμα που η χειρονομία **δεν** μπορεί να κάνει μόνη της, γιατί δεν είναι πια
 * σύγχρονο.
 *
 * ## 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΑΛΛΕΣ ΤΡΙΑΝΤΑ ΓΡΑΜΜΕΣ ΣΤΟ `onUp`
 * Η σύρση είναι **σύγχρονη από άκρη σε άκρη** και το συμβόλαιο σειράς της (§31.9) το εκμεταλλεύεται:
 * *πρώτα σβήνουν οι ακροατές, μετά γράφεται το μοντέλο*. Ο διάλογος σπάει ακριβώς αυτό — ανάμεσα
 * στο «άσε το ποντίκι» και στο «γράψε» μεσολαβεί **αόριστος χρόνος ανθρώπου**. Δύο ζωές με
 * διαφορετικό ρολόι στο ίδιο αρχείο θα σήμαινε ότι κάθε μελλοντική αλλαγή στη χειρονομία πρέπει
 * να απαντήσει και για την εκκρεμή ερώτηση. Εδώ η χειρονομία **τελείωσε**: ό,τι ζει από δω και
 * πέρα είναι το σχέδιο (σε **τοπική** μεταβλητή κλεισίματος, όχι σε κατάσταση module) και μια
 * υπόσχεση.
 *
 * ## 🔴 ΤΟ ΣΧΕΔΙΟ ΑΝΗΚΕΙ ΣΤΗ ΣΚΗΝΗ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ
 * Όσο ο διάλογος είναι ανοιχτός ο κόσμος **δεν παγώνει**: το `Ctrl+Z` φτάνει στο παράθυρο, ο
 * πίνακας μπορεί να σβηστεί, ο όροφος να αλλάξει. Το σχέδιο κουβαλά **δείκτες** γραμμών/στηλών —
 * σε άλλο μοντέλο σημαίνουν **άλλα κελιά**. Γι' αυτό η γραφή περνά από **φύλακα ταυτότητας**: αν
 * το ζωντανό μοντέλο δεν είναι **το ίδιο by-reference** με εκείνο της στιγμής της απόθεσης, η
 * μεταφορά **εγκαταλείπεται σιωπηλά**. Είναι η ίδια εγγύηση που ήδη προστατεύει το
 * `useLiveTableMutation` (`next === activeTableModel(live)`), εφαρμοσμένη στον **χρόνο** αντί για την τιμή.
 *
 * Το σιωπηλά είναι επιλογή: η εναλλακτική —να γράψει πάνω σε μοντέλο που δεν σχεδίασε— είναι
 * ακριβώς η καταστροφή που αυτή η φάση υπάρχει για να αποτρέψει, ενώ το «δεν έγινε τίποτα» είναι
 * πλήρως ανακτήσιμο: ο χρήστης βλέπει την περιοχή στη θέση της και ξανασέρνει.
 *
 * ⚠️ Ο φύλακας ισχύει **μόνο** στον ασύγχρονο δρόμο, επίτηδες. Στη σιωπηλή απόθεση (κανένα κελί
 * με περιεχόμενο) δεν υπάρχει **παράθυρο χρόνου** να φυλαχτεί, και ένας έλεγχος εκεί θα άλλαζε
 * συμπεριφορά που 828 tests κλειδώνουν, χωρίς να αποτρέπει τίποτα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-range-transfer-drop
 * @see bim/table/table-range-overwrite-confirm-store.ts — η χειραψία της ερώτησης
 * @see bim/table/table-range-transfer-plan.ts — ποιος μετρά τα κελιά που χάνονται
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36.22
 */

import { applyTableRangeTransfer } from '../../bim/table/table-range-transfer';
import { requestTableRangeOverwriteConfirm } from '../../bim/table/table-range-overwrite-confirm-store';
import { tableRangeOverwrittenCells } from '../../bim/table/table-range-transfer-plan';
import {
  clearTableRangeTransferPreview,
  setTableRangeTransferPreview,
  type TableRangeTransferPreview,
} from '../../state/table-range-transfer-store';
import { setTableCellCursor, setTableCellSelection } from '../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TableRangeTransferPlan } from '../../bim/table/table-range-transfer-types';
import type { TableEntity } from '../../types/table-entity';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';
import type { PersistedTableModel } from '../../types/table';

/** Ό,τι χρειάζεται η **γραφή** — καθαρά από τη γεωμετρία της σύρσης. */
export interface TableRangeDropTarget {
  /** Η οντότητα τη στιγμή του πατήματος — η βάση πάνω στην οποία σχεδιάστηκε η μεταφορά. */
  readonly entity: TableEntity;
  /** Η **ΜΙΑ** διαδρομή commit του πίνακα — δες `use-table-model-commit`. */
  readonly commit: (entity: TableEntity, model: PersistedTableModel) => void;
  /**
   * 🔴 Η **ζωντανή** οντότητα τη στιγμή που ρωτιέται, ποτέ στιγμιότυπο (ADR-040: *«event
   * handlers MUST receive getters, not snapshot values»*). Εδώ δεν είναι απλώς σωστή πρακτική —
   * είναι ο μόνος τρόπος να μάθει κανείς αν ο κόσμος άλλαξε **όσο ρωτούσαμε**.
   */
  readonly liveTable: () => TableEntity | null;
}

/**
 * 🔴 §36 ΦΑΣΗ 4 — **Η ΑΠΟΘΕΣΗ, ΟΛΟΚΛΗΡΗ**: μέτρα τι χάνεται · ρώτα αν χάνεται κάτι · γράψε.
 *
 * Δύο δρόμοι, και ο πρώτος είναι ο συχνός:
 * ```
 *   0 κελιά με περιεχόμενο  →  γράψε ΤΩΡΑ, σύγχρονα (καμία αλλαγή από τη Φάση 3)
 *   ≥1                       →  κράτα το φάντασμα · ρώτα · γράψε ΜΟΝΟ αν «Αντικατάσταση»
 * ```
 *
 * ## Γιατί το φάντασμα **μένει** όσο ρωτάμε
 * Η ερώτηση λέει **τι** (πόσα κελιά), το φάντασμα λέει **πού**. Χωρίς αυτό ο χρήστης καλείται να
 * εγκρίνει σβήσιμο κοιτώντας έναν αριθμό, τη στιγμή που η ίδια η οθόνη μπορεί να του το δείξει.
 * Ξαναγράφεται **αυτούσιο** το τελευταίο καρέ (`lastFrame`) και όχι νέο ορθογώνιο: η υπόσχεση που
 * είδε ο χρήστης και η εικόνα που κρατάμε είναι **το ίδιο αντικείμενο** — δεν μπορούν να
 * αποκλίνουν, ακριβώς όπως το `mouseup` εκτελεί το σχέδιο που τροφοδοτούσε το φάντασμα (§36.15).
 *
 * ⚠️ Το φάντασμα δείχνει την **προσγείωση**, όχι πάντα τις απώλειες: στην εισαγωγή & ολίσθηση ό,τι
 * χάνεται είναι η **ουρά** που βγαίνει από το πλέγμα, δηλαδή κελιά **εκτός** του ορθογωνίου. Ο
 * αριθμός στον διάλογο παραμένει σωστός — το ορθογώνιο απλώς δεν τα περικλείει. Δηλωμένο όριο.
 *
 * Το σβήσιμο του φαντάσματος γίνεται σε **ένα** σημείο (η επίλυση της υπόσχεσης), όχι σε τέσσερα
 * (ΟΚ / Άκυρο / `Esc` / κλικ έξω): το `createConfirmStore` επιλύει το Promise σε **κάθε** έξοδο,
 * οπότε τα τέσσερα μονοπάτια της διεπαφής συναντιούνται πριν φτάσουν εδώ. Ένα ξεχασμένο μονοπάτι
 * θα άφηνε φάντασμα χωρίς σύρση — και θα το άφηνε **μόνο** σε αυτό το μονοπάτι.
 */
export function completeTableRangeTransfer(
  target: TableRangeDropTarget,
  plan: TableRangeTransferPlan,
  lastFrame: TableRangeTransferPreview | null,
): void {
  const doomed = tableRangeOverwrittenCells(activeTableModel(target.entity), plan);
  if (doomed === 0) {
    writeTransfer(target, plan);
    return;
  }

  if (lastFrame) setTableRangeTransferPreview(lastFrame);
  const atDrop = target.liveTable();

  void requestTableRangeOverwriteConfirm(doomed).then((action) => {
    clearTableRangeTransferPreview();
    if (action !== 'replace') return;
    const atAnswer = target.liveTable();
    // Δες την κεφαλίδα: το σχέδιο ανήκει στη σκηνή που το γέννησε.
    if (!atDrop || !atAnswer || activeTableModel(atAnswer) !== activeTableModel(atDrop)) return;
    writeTransfer(target, plan);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * **ΕΝΑ** βήμα αναίρεσης, και στους δύο δρόμους.
 *
 * Ο διάλογος δεν προσθέτει δικό του: η ερώτηση δεν γράφει τίποτα, και η απάντηση περνά από την
 * **ίδια** μοναδική διαδρομή commit με τη σιωπηλή απόθεση. Η ατομικότητα δεν εξασφαλίζεται εδώ —
 * βγαίνει από την **καθαρότητα** των πέντε γραφέων του `applyTableRangeTransfer` (§36.7), που
 * αλυσιδώνονται στη μνήμη και παραδίδουν **ένα** τελικό μοντέλο.
 */
function writeTransfer(target: TableRangeDropTarget, plan: TableRangeTransferPlan): void {
  const { entity, commit } = target;
  commit(entity, applyTableRangeTransfer(activeTableModel(entity), plan));
  selectTransferred(entity, plan.destination);
}

/**
 * 🔴 Η επιλογή **ακολουθεί** την περιοχή στη νέα της θέση (Excel/Sheets parity).
 *
 * Χωρίς αυτό, μετά από μια μετακίνηση η επιλογή —και μαζί της η **ζώνη σύλληψης** (§36)— θα
 * έμενε πάνω στα κελιά που μόλις άδειασαν: ο χρήστης θα έβλεπε μαρκαρισμένο κενό και θα
 * μπορούσε να «μεταφέρει» αμέσως μετά το **τίποτα**. Το ενεργό κελί πάει στην πάνω-αριστερή
 * γωνία, όπως ακριβώς μετά από επικόλληση.
 *
 * Η σειρά είναι υποχρεωτική: το `setTableCellCursor` **διαλύει** την επιλογή by design (ένα
 * κλικ ξεκινά καινούρια), οπότε η περιοχή γράφεται **μετά**.
 */
function selectTransferred(entity: TableEntity, destination: TableCellRangeBounds): void {
  const { rows, columns } = activeTableModel(entity);
  // Η μεταφορά **δεν** προσθέτει ούτε αφαιρεί γραμμές/στήλες (§36.5: μετάθεση θέσεων, όχι
  // αλλαγή πλήθους), οπότε οι ταυτότητες του αρχικού μοντέλου ισχύουν ακέραιες στο νέο.
  const firstRow = rows[destination.firstRow];
  const lastRow = rows[destination.lastRow];
  const firstCol = columns[destination.firstCol];
  const lastCol = columns[destination.lastCol];
  if (!firstRow || !lastRow || !firstCol || !lastCol) return;

  setTableCellCursor(entity, tableCursorAt(firstRow.id, firstCol.id), 'nav');
  setTableCellSelection({
    from: { rowId: firstRow.id, colId: firstCol.id },
    to: { rowId: lastRow.id, colId: lastCol.id },
    kind: 'range',
  });
}
