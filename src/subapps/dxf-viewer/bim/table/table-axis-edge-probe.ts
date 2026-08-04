/**
 * 🔴 ADR-739 §31.9 — **ΕΙΜΑΙ ΠΑΝΩ ΣΕ ΕΣΩΤΕΡΙΚΟ ΟΡΙΟ;** Η γεωμετρία του διαχωριστικού, σε
 * αδιάφορο άξονα. Καθαρή αριθμητική — μηδέν DOM, μηδέν store, μηδέν React.
 *
 * ## ⛏️ 2026-08-04 (N.7.1, 503→όριο 500) — ΓΙΑΤΙ ΒΓΗΚΕ ΑΠΟ ΤΗ ΓΕΩΜΕΤΡΙΑ ΤΩΝ ΖΩΝΩΝ
 * Δεύτερη εξαγωγή από το `table-indicator-geometry.ts` με **την ίδια τομή** που έβγαλε τους
 * ρόλους δείκτη: εκεί μένει «**πού** κάθεται η ζώνη», εδώ έρχεται «**πού τελειώνει η μία
 * υποδιαίρεση και αρχίζει η επόμενη**». Δεν είναι η ίδια ερώτηση — και το αποδεικνύει ο
 * καταναλωτής: η ζώνη ρωτιέται για να **βαφτεί**, το όριο ρωτιέται για να **συρθεί**.
 *
 * 🔑 Η εξάρτηση είναι **μονόδρομη**: η γεωμετρία των ζωνών καλεί αυτό εδώ (για να παραιτηθεί
 * όταν το pixel ανήκει στο όριο), αυτό εδώ δεν μαθαίνει ποτέ τι είναι ζώνη — παίρνει τα δύο
 * πάχη ως **ορίσματα**. Το `import type` του {@link TableIndicatorBandsMm} σβήνεται στη
 * μεταγλώττιση, άρα δεν υπάρχει κύκλος τη στιγμή της εκτέλεσης.
 *
 * @module subapps/dxf-viewer/bim/table/table-axis-edge-probe
 * @see bim/table/table-indicator-geometry.ts — ΠΟΥ κάθονται οι ζώνες (και ποιος καλεί αυτό εδώ)
 * @see bim/table/table-indicator-cursor-role.ts — ΤΙ οφείλεται πάνω στο όριο (`col-resize`)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §31.8, §31.9
 */

import type { TableFramePoint } from '../../types/table-entity';
import type { TableLayout } from './table-layout-types';
import type { TableIndicatorBandsMm } from './table-indicator-geometry';

/**
 * 🔴 ADR-739 §31.9 — **ΤΟ ΔΙΑΧΩΡΙΣΤΙΚΟ ΜΕΣΑ ΣΤΗ ΛΩΡΙΔΑ**: ποιο εσωτερικό όριο στήλης είναι
 * κάτω από τον δείκτη· `null` παντού αλλού.
 *
 * Κατακόρυφη λωρίδα ανοχής γύρω από κάθε εσωτερικό όριο, που εκτείνεται από την **κορυφή της
 * ζώνης γραμμάτων** ως λίγο **μέσα στο πλέγμα** — δηλαδή ακριβώς η περιοχή που το μάτι
 * διαβάζει ως «η γραμμή που χωρίζει το A από το B».
 *
 * ## 🔴 Γιατί ΔΕΝ έμεινε στη λαβή (§31.8, μετρημένο στην οθόνη ΔΥΟ φορές)
 * Η πρώτη εκδοχή έδινε `col-resize` **μόνο** πάνω στη λαβή (`v ≈ 0`), με το επιχείρημα «μέσα
 * στη λωρίδα το πάτημα επιλέγει στήλη, άρα θα ήταν ψέμα». Το επιχείρημα ήταν σωστό και το
 * αποτέλεσμα **ανεύρετο**: ο ιδιοκτήτης δεν το βρήκε ούτε ψάχνοντας, δύο φορές. Η λύση δεν
 * ήταν να μη δείξουμε δείκτη — ήταν **να πάψει να είναι ψέμα**: το `tableIndicatorHitAtFrame`
 * παραιτείται εδώ (η ζώνη δεν διεκδικεί πια αυτά τα pixel) και τη σύρση την αναλαμβάνει ο
 * ίδιος ο πίνακας. **Ένα pixel, μία ερώτηση** — η ίδια αρχή που γέννησε το κενό του §27.11.
 *
 * ⚠️ Η ανοχή είναι **το ίδιο** `gapMm`, δηλαδή η `gripAperturePx` του §27.16 Ε4. Όχι νέος
 * αριθμός: η οπή σύλληψης του έργου είναι **μία**, και όποιος τη μεγαλώσει τη μεγαλώνει παντού.
 */
export function tableColumnEdgeAtFrame(
  layout: TableLayout,
  frame: TableFramePoint,
  bands: TableIndicatorBandsMm,
): number | null {
  return axisEdgeAtFrame(
    layout.columns.map((column) => column.xMm),
    frame.u,
    frame.v,
    bands.gapMm,
    bands.columnBandMm,
  );
}

/**
 * 🔴 **Το κάτοπτρο για τις ΓΡΑΜΜΕΣ** (Giorgio 2026-08-04): ποιο εσωτερικό όριο γραμμής είναι
 * κάτω από τον δείκτη, με τον ρόλο του `u` και του `v` αντεστραμμένο.
 *
 * Υπάρχει επειδή υπάρχει πλέον **λαβή** ύψους γραμμής (`table-row-edge`). Μέχρι τότε ένα
 * τέτοιο hit-test θα ήταν ακριβώς αυτό που το §31 απαγορεύει: δείκτης που υπόσχεται
 * χειρονομία η οποία δεν εκτελείται. Τώρα η χειρονομία υπάρχει, άρα ο δείκτης λέει αλήθεια.
 */
export function tableRowEdgeAtFrame(
  layout: TableLayout,
  frame: TableFramePoint,
  bands: TableIndicatorBandsMm,
): number | null {
  return axisEdgeAtFrame(
    layout.rows.map((row) => row.yMm),
    frame.v,
    frame.u,
    bands.gapMm,
    bands.rowBandMm,
  );
}

/**
 * Η **μία** γεωμετρία «είμαι πάνω σε εσωτερικό όριο;», σε αδιάφορο άξονα.
 *
 * `along` = η συντεταγμένη **κατά μήκος** του άξονα των ορίων· `across` = η κάθετη, που
 * περιορίζεται στη ζώνη. Δύο αντίγραφα (ένα ανά άξονα) θα ήταν sibling clone με δύο ανοχές
 * που αποκλίνουν σιωπηλά — ακριβώς το σχήμα που ο N.18 απαγορεύει.
 *
 * Το εύρος κατά την `across`: από την κορυφή της ζώνης ως μία οπή **μέσα** στο πλέγμα. Το
 * εσωτερικό άκρο κρατά πιαστή και την **ορατή λαβή** στο μηδέν, ώστε ο δείκτης να μη σβήνει
 * τη στιγμή που το χέρι φτάνει πάνω της.
 */
function axisEdgeAtFrame(
  starts: readonly number[],
  along: number,
  across: number,
  gapMm: number,
  bandMm: number,
): number | null {
  if (across < -(gapMm + bandMm) || across > gapMm) return null;
  for (let i = 1; i < starts.length; i++) {
    if (Math.abs(along - starts[i]) <= gapMm) return i;
  }
  return null;
}
