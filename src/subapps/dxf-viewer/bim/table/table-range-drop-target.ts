/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **ΤΙ ΖΗΤΑΕΙ ΤΟ ΧΕΡΙ ΤΗ ΣΤΙΓΜΗ ΑΥΤΗ**: από σημείο πλαισίου σε
 * {@link TableRangeTransferRequest}. Καθαρή γεωμετρία — μηδέν DOM, μηδέν store, μηδέν React.
 *
 * Χωρίζεται από τη χειρονομία επίτηδες. Η χειρονομία απαντά «*όσο το κουμπί είναι κάτω, πού
 * βρίσκομαι τώρα;*»· εδώ απαντάται «*αυτό το σημείο, τι μεταφορά περιγράφει;*». Η δεύτερη είναι
 * **ολόκληρη δοκιμάσιμη χωρίς DOM** — και είναι εκείνη που κρύβει τις αποφάσεις.
 *
 * ## 🔴 1. Η ΣΧΕΤΙΚΗ ΘΕΣΗ ΣΥΛΛΗΨΗΣ ΔΙΑΤΗΡΕΙΤΑΙ — και υπολογίζεται **μία** φορά
 * Το ποντίκι δείχνει **σημείο**· η περιοχή προσγειώνεται σε **κελί**. Οι δύο υποψήφιοι κανόνες
 * είναι «*το κελί κάτω από τον δείκτη γίνεται η πάνω-αριστερή γωνία*» και «*διατηρείται η θέση
 * σύλληψης*». Ο πρώτος είναι απλούστερος και **λάθος**: πιάνοντας μια περιοχή 5×3 από τη μέση
 * της κάτω πλευράς, το σχήμα θα **πηδούσε** ώστε η γωνία του να βρεθεί κάτω από το χέρι — μια
 * μετατόπιση όσο ολόκληρη η περιοχή, τη στιγμή ακριβώς που ο χρήστης ζητά ακρίβεια.
 *
 * Excel, Sheets, Figma κρατούν όλα το σχήμα **κάτω από το δάχτυλο**. Το `to` του
 * {@link TableRangeTransferRequest} είναι όμως **ρητά** η πάνω-αριστερή γωνία, οπότε η
 * μετατόπιση σύλληψης ({@link TableRangeGrab}) υπολογίζεται στον **καλούντα**, μία φορά, στην
 * αρχή της σύρσης — και εδώ απλώς αφαιρείται. Καμία κατάσταση ανά καρέ.
 *
 * ## 🔴 2. ΜΕ `Shift` ΤΟ ΣΗΜΕΙΟ ΑΠΟΘΕΣΗΣ ΕΙΝΑΙ **ΣΥΝΟΡΟ**, ΟΧΙ ΚΕΛΙ
 * Ο άξονας που ολισθαίνει παίρνει τη θέση του από τη {@link tableRangeInsertBoundaryAtFrame}
 * (το σύνορο όπου κρέμεται το ποντίκι, όπως η γραμμή-Ι του Excel)· ο άξονας που **μένει**
 * παίρνει τη θέση του από τη μετατόπιση σύλληψης, ακριβώς όπως χωρίς `Shift`. Δύο ερωτήσεις,
 * δύο πηγές — και γι' αυτό η κατεύθυνση **δεν** ζει μέσα στο `TableRangeDragIntent` (δες την
 * κεφαλίδα του `table-range-axis-view`).
 *
 * ## ⚠️ ΤΟ ΚΕΛΙ ΚΑΤΩ ΑΠΟ ΤΟΝ ΔΕΙΚΤΗ ΤΟ ΑΠΑΝΤΑ Ο ΕΝΑΣ ΥΠΑΡΧΩΝ ΔΡΟΜΟΣ
 * `tableCellAtFrame` — ο ίδιος που χρησιμοποιεί το κλικ και το hit-test. Συνέπεια που αξίζει να
 * γραφτεί: πάνω από **συγχώνευση** εκείνος επιστρέφει την **άγκυρα** (τα καλυμμένα κελιά δεν
 * υπάρχουν στη διάταξη), άρα η απόθεση κουμπώνει στη γωνία της συγχώνευσης. Είναι η **ίδια**
 * σύμβαση που ήδη εφαρμόζει η επιλογή είδους `'range'` (`snapToWholeMerges`, §27.15) — και το
 * να ρωτηθεί δεύτερη γεωμετρία εδώ θα ήταν ακριβώς η απόκλιση που το §4.3 απαγορεύει.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-drop-target
 * @see bim/table/table-range-transfer-plan.ts — ποιος κρίνει αν αυτό που ζητήθηκε γίνεται
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import { tableCellAtFrame } from './table-entity-geometry';
import { indexById } from './table-model-helpers';
import { tableRangeInsertBoundaryAtFrame } from './table-range-insert-boundary';
import type { PersistedTableModel } from '../../types/table';
import type { TableFramePoint } from '../../types/table-entity';
import type { TableCellRangeBounds } from './table-cell-range';
import type { TableLayout } from './table-layout-types';
import type { TableRangeDragIntent } from './table-range-move-zone';
import type {
  TableRangeTransferRefusal,
  TableRangeTransferRequest,
} from './table-range-transfer-types';

/**
 * Πόσο **μέσα** στην περιοχή έπεσε το πάτημα, σε κελιά από την πάνω-αριστερή γωνία της.
 *
 * Πάντα μη αρνητικό και μέσα στα όρια της πηγής: ο παραγωγός του (`tableRangeGrabAtWorld`)
 * **περιορίζει** το σημείο μέσα στο ορθογώνιο πριν ρωτήσει, γιατί η ζώνη σύλληψης εκτείνεται
 * και **έξω** από το περίγραμμα (§36) — χωρίς τον περιορισμό, πιάσιμο από την πάνω πλευρά θα
 * έδινε γειτονικό κελί, δηλαδή μετατόπιση κατά ένα κελί σε **κάθε** επόμενη κίνηση.
 */
export interface TableRangeGrab {
  readonly dRow: number;
  readonly dCol: number;
}

/** Τι ζητά το χέρι — ή γιατί δεν εκφράζεται. Ίδιο σχήμα με το `TableRangeTransferOutcome`. */
export type TableRangeDropOutcome =
  | { readonly ok: true; readonly request: TableRangeTransferRequest }
  | { readonly ok: false; readonly reason: TableRangeTransferRefusal };

/** Ό,τι χρειάζεται η ερώτηση — και τίποτα που να μη διαβάζεται. */
export interface TableRangeDropParams {
  readonly model: PersistedTableModel;
  readonly layout: TableLayout;
  /** Πού βρίσκεται το χέρι **τώρα**, σε sheet-mm του πλαισίου. */
  readonly frame: TableFramePoint;
  readonly source: TableCellRangeBounds;
  readonly grab: TableRangeGrab;
  readonly intent: TableRangeDragIntent;
}

/**
 * 🔴 §36 ΦΑΣΗ 3 — **ΤΟ ΑΙΤΗΜΑ ΠΟΥ ΠΕΡΙΓΡΑΦΕΙ ΑΥΤΟ ΤΟ ΣΗΜΕΙΟ**, ή ο λόγος που δεν περιγράφει.
 *
 * `'outside-grid'` σε δύο περιπτώσεις, και οι δύο γνήσιες:
 *  - το χέρι βγήκε **έξω** από το πλέγμα (ο πίνακας δεν μεγαλώνει μόνος του, §36)·
 *  - με `Shift`, το σύνορο είναι το **τελευταίο** — θέση που το λεξιλόγιο της Φάσης 2 δεν
 *    μπορεί να εκφράσει, γιατί το `to` είναι **κελί** και μετά την τελευταία γραμμή δεν
 *    υπάρχει κελί. Δηλωμένο όριο (§36.10), όχι σιωπηλή λάθος τοποθέτηση: η εναλλακτική θα
 *    ήταν να «διορθωθεί» σε ένα σύνορο πιο πάνω, δηλαδή να παραδοθεί άλλη θέση από αυτήν που
 *    δείχνει η γραμμή-Ι.
 */
export function tableRangeDropRequest(params: TableRangeDropParams): TableRangeDropOutcome {
  const { model, layout, frame, source, grab, intent } = params;

  const hit = tableCellAtFrame(layout, frame);
  if (!hit) return { ok: false, reason: 'outside-grid' };
  const row = indexById(model.rows).get(hit.rowId);
  const col = indexById(model.columns).get(hit.colId);
  // Μπαγιάτικη διάταξη ως προς το μοντέλο (undo στη μέση της σύρσης) — δεν μαντεύουμε.
  if (row === undefined || col === undefined) return { ok: false, reason: 'stale-range' };

  const boundary = intent.insert ? tableRangeInsertBoundaryAtFrame(layout, frame) : null;
  const anchor = boundary
    ? insertAnchor(boundary.axis, boundary.line, row - grab.dRow, col - grab.dCol)
    : { row: row - grab.dRow, col: col - grab.dCol };

  const toRow = model.rows[anchor.row];
  const toCol = model.columns[anchor.col];
  if (!toRow || !toCol) return { ok: false, reason: 'outside-grid' };

  return {
    ok: true,
    request: {
      source,
      to: { rowId: toRow.id, colId: toCol.id },
      intent,
      // Χωρίς `Shift` η κατεύθυνση είναι **αδιάφορη** (το τεκμηριώνει το ίδιο το πεδίο), αλλά
      // ο τύπος την απαιτεί: μια «ουδέτερη» τρίτη τιμή θα υποχρέωνε κάθε καταναλωτή να τη
      // χειριστεί, για κατάσταση που κανείς δεν διαβάζει.
      shiftAxis: boundary?.axis ?? 'down',
    },
  };
}

/**
 * Η γωνία απόθεσης όταν παίζει το `Shift`: ο άξονας που **ολισθαίνει** παίρνει τη θέση του
 * συνόρου, ο άξονας που **μένει** κρατά τη μετατόπιση σύλληψης.
 */
function insertAnchor(
  axis: 'down' | 'right',
  line: number,
  grabbedRow: number,
  grabbedCol: number,
): { readonly row: number; readonly col: number } {
  return axis === 'down' ? { row: line, col: grabbedCol } : { row: grabbedRow, col: line };
}
