/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **ΤΟ ΦΑΝΤΑΣΜΑ ΠΡΟΟΡΙΣΜΟΥ**: πού θα προσγειωθεί η περιοχή, ζωντανά,
 * όσο σέρνεις — και **η γραμμή-Ι** του `Shift`.
 *
 * ## 🔴 ΓΙΑΤΙ ΟΡΘΟΓΩΝΙΟ ΚΑΙ ΟΧΙ ΗΜΙΔΙΑΦΑΝΕΣ ΑΝΤΙΓΡΑΦΟ ΤΟΥ ΠΕΡΙΕΧΟΜΕΝΟΥ — **μετρημένο**
 * Το ερώτημα τέθηκε ρητά: Excel και Sheets δείχνουν **μόνο** διάστικτο περίγραμμα, ενώ ένα CAD
 * (Revit, C4D, AutoCAD) δείχνει ημιδιαφανές αντίγραφο του πραγματικού σχήματος. Η μέτρηση, όχι
 * η αίσθηση, έκρινε:
 *
 * ```
 *   ορθογώνιο            →  1 fill + 1 stroke                       = O(1)  ανά καρέ
 *   αντίγραφο περιεχομένου →  1 fill + 1 κείμενο ΑΝΑ ΚΕΛΙ           = O(εμβαδόν) ανά καρέ
 * ```
 *
 * Μια επιλογή «ολόκληρη στήλη» σε πίνακα 500 γραμμών κοστίζει **500 στάμπες κειμένου ανά
 * καρέ** — και το χειρότερο δεν είναι ο αριθμός: ο πραγματικός πίνακας ζωγραφίζεται **μόνο**
 * στο ορατό παράθυρο (`visibleRowRange`, ADR-735), άρα ένα αντίγραφο θα χρειαζόταν **δικό του**
 * παράθυρο ορατότητας πάνω σε **δεύτερη** γεωμετρία. Το §4.3 του σχεδίου το απαγορεύει
 * ονομαστικά: «καμία δεύτερη γεωμετρία».
 *
 * ⚠️ Και το επιχείρημα δεν είναι μόνο κόστος. Το AutoCAD κρατά ολόκληρη μεταβλητή συστήματος
 * (`DRAGMODE`, τιμές 0/1/2, προεπιλογή «Auto») **επειδή** η προεπισκόπηση γεωμετρίας μπορεί να
 * γίνει απαγορευτική — δηλαδή ο μεγάλος παίκτης έδωσε στον χρήστη διακόπτη αντί για απάντηση.
 * Εμείς δίνουμε απάντηση που **δεν χρειάζεται διακόπτη**.
 *
 * ## 🔑 ΚΑΙ ΛΕΕΙ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠΟ ΤΟΥ EXCEL, ΜΕ ΤΟ ΙΔΙΟ ΚΟΣΤΟΣ
 * Το διάστικτο ορθογώνιο του Excel ακολουθεί το ποντίκι και **δεν ξέρει τίποτα**: δεν λέει αν η
 * απόθεση επιτρέπεται, ούτε πού πραγματικά προσγειώνεται όταν η ολίσθηση κλείνει την τρύπα. Το
 * δικό μας ζωγραφίζει το **`plan.destination`** (§36.5) και **αλλάζει χρώμα** στην άρνηση. Δύο
 * πληροφορίες που ο χρήστης του Excel μαθαίνει **μετά** το drop, με το ίδιο O(1).
 *
 * ## Γιατί ΠΑΝΩ από το κείμενο, ενώ η επιλογή μπαίνει από κάτω
 * Δεν είναι ασυνέπεια — είναι **άλλη ερώτηση**. Η επιλογή απαντά «*τι μάρκαρα*» και δεν
 * επιτρέπεται να κρύψει αυτό που μαρκάρεις (Φ.Δ βήμα 8). Το φάντασμα απαντά «*πού θα πάει*»,
 * και δεν επιτρέπεται να **κρυφτεί** από τα δεδομένα του προορισμού. Γι' αυτό το γέμισμά του
 * είναι αχνότερο (0.10 έναντι 0.18): μπαίνει από πάνω **χωρίς** να σβήνει το κείμενο που ο
 * χρήστης πρέπει να δει για να κρίνει αν θέλει να το αντικαταστήσει.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-range-ghost
 * @see state/table-range-transfer-store.ts — από πού έρχεται η απάντηση (getter, ADR-040)
 * @see bim/table/table-range-insert-boundary.ts — η γεωμετρία της γραμμής-Ι
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import { TABLE_RANGE_GHOST } from '../../../config/color-config';
import { strokeRectMm, traceRectMm, type StampTableContext } from './stamp-table-layout';
import { tableRangeRectMm } from '../../../bim/table/table-cell-range';
import { tableRangeInsertCaretMm } from '../../../bim/table/table-range-insert-boundary';
import type { TableLayout, TableRectMm } from '../../../bim/table/table-layout-types';
import type { TableRangeTransferPreview } from '../../../state/table-range-transfer-store';

/**
 * 🔴 §36 ΦΑΣΗ 3 — το φάντασμα ολόκληρο: γέμισμα + διακεκομμένο περίγραμμα + γραμμή-Ι.
 *
 * Σιωπά όταν δεν υπάρχει **σχεδιάσιμη** θέση (το χέρι βγήκε από το πλέγμα): ένα ορθογώνιο
 * καρφωμένο στην άκρη θα υποσχόταν προσγείωση που δεν υπάρχει. Η άρνηση εξακολουθεί να
 * φαίνεται — από τον **δείκτη** του ΟΣ, που δεν χρειάζεται γεωμετρία για να μιλήσει.
 */
export function stampTableRangeGhost(
  rc: StampTableContext,
  layout: TableLayout,
  preview: TableRangeTransferPreview,
): void {
  if (!preview.destination) return;
  const rectMm = tableRangeRectMm(layout, preview.destination);
  if (!rectMm) return;

  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = preview.refused ? TABLE_RANGE_GHOST.refusedFillRgba : TABLE_RANGE_GHOST.fillRgba;
  traceRectMm(rc, rectMm);
  ctx.fill();
  ctx.restore();

  strokeRectMm(
    rc,
    rectMm,
    preview.refused ? TABLE_RANGE_GHOST.refusedOutlineHex : TABLE_RANGE_GHOST.outlineHex,
    TABLE_RANGE_GHOST.outlineWidthPx,
    TABLE_RANGE_GHOST.outlineDashPx,
  );

  // Η γραμμή-Ι έχει νόημα **μόνο** όταν η απόθεση θα εισαγάγει· και όχι όταν το σχέδιο αρνείται,
  // γιατί τότε δεν υπάρχει σύνορο που «ανοίγει» — θα ήταν υπόσχεση μέσα σε άρνηση.
  if (preview.insertAxis && !preview.refused) {
    stampInsertCaret(rc, tableRangeInsertCaretMm(rectMm, preview.insertAxis));
  }
}

/**
 * Η **παχιά γκρι γραμμή-Ι** του Excel, πάνω στην εισερχόμενη ακμή της προσγείωσης.
 *
 * Χαράζεται ως **ευθύγραμμο τμήμα** και όχι μέσω του {@link strokeRectMm}: το εκφυλισμένο
 * ορθογώνιο (μηδενικό ύψος ή πλάτος) θα περνούσε από `closePath()`, δηλαδή θα χάραζε τη
 * διαδρομή **δύο φορές** — και σε ένα ημιδιαφανές μελάνι αυτό φαίνεται ως διπλή πυκνότητα.
 * Δύο σημεία, δύο κλήσεις `toScreen`: ο πίνακας μπορεί να είναι περιστραμμένος, άρα το τμήμα
 * **δεν** είναι οριζόντιο στην οθόνη.
 *
 * `lineCap: 'square'` — οι άκρες προεξέχουν κατά μισό πάχος, ώστε η μπάρα να «κουμπώνει» στις
 * γωνίες της περιοχής αντί να σταματά ένα pixel πριν, όπως ακριβώς δείχνει το Excel.
 */
function stampInsertCaret(rc: StampTableContext, caretMm: TableRectMm): void {
  const { ctx } = rc;
  const from = rc.toScreen(caretMm.x, caretMm.y);
  const to = rc.toScreen(caretMm.x + caretMm.w, caretMm.y + caretMm.h);

  ctx.save();
  ctx.strokeStyle = TABLE_RANGE_GHOST.insertCaretHex;
  ctx.lineWidth = TABLE_RANGE_GHOST.insertCaretWidthPx;
  ctx.lineCap = 'square';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}
