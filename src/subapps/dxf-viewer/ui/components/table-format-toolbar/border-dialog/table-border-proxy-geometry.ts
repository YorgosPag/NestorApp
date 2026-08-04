/**
 * ADR-750 Φ6 — **η γεωμετρία του proxy preview**: πού ζωγραφίζεται κάθε θέση, και ποια θέση
 * εννοεί ένα κλικ μέσα στη ζώνη.
 *
 * Καθαρές συναρτήσεις: μηδέν React, μηδέν DOM, μηδέν i18n — εκτελέσιμες σε test χωρίς render.
 *
 * ## 🔑 ΜΙΑ γεωμετρία, δύο χρήσεις — και γι' αυτό δεν μπορεί να ψευτίσει
 * Το ίδιο {@link tableBorderProxyLine} απαντά **και** «πού τραβάω τη γραμμή» **και** «πόσο
 * μακριά έπεσε το κλικ από αυτήν». Δύο ανεξάρτητοι υπολογισμοί (ένας στο SVG, ένας στον
 * χειριστή) θα ήταν το κλασικό ζευγάρι που αποκλίνει σιωπηλά: ο χρήστης θα έβλεπε τη μεσαία
 * γραμμή στο κέντρο και θα την πετύχαινε δύο εικονοστοιχεία πιο πάνω.
 *
 * ## 🔴 Γιατί «η ΠΛΗΣΙΕΣΤΕΡΗ γραμμή» και όχι εννιά ορθογώνιες ζώνες
 * Ο πειρασμός είναι ένα πλέγμα 3×3 («πάνω-αριστερά ⇒ …»). Θα ήταν **δεύτερη** περιγραφή του
 * widget, άσχετη με το τι φαίνεται: οι διαγώνιοι διασχίζουν και τα εννιά κουτάκια, οπότε καμία
 * ανάθεση κουτιού σε θέση δεν θα ήταν σωστή για αυτές. Η ερώτηση που κάνει πραγματικά ο
 * χρήστης είναι «πάτησα **πάνω** σε αυτή τη γραμμή» — και η απάντηση είναι απόσταση σημείου
 * από ευθεία, δηλαδή ακριβώς η γραμμή που ήδη ζωγραφίζεται.
 *
 * Δώρο του ίδιου κανόνα: όταν μια θέση **δεν είναι διαθέσιμη** (η μεσαία σε ένα κελί), απλώς
 * λείπει από τους υποψηφίους — και το κλικ πάει στην επόμενη πλησιέστερη, αντί να μη κάνει
 * τίποτα σε μια αόρατη ζώνη.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/border-dialog/table-border-proxy-geometry
 * @see bim/table/table-border-dialog-positions.ts — ποιες θέσεις υπάρχουν και ποιες έχουν νόημα
 */

import {
  TABLE_BORDER_DIALOG_POSITIONS,
  type TableBorderDialogPositionId,
} from '../../../../bim/table/table-border-dialog-positions';

/**
 * Το σύστημα συντεταγμένων της ζώνης, σε μονάδες `viewBox`.
 *
 * Οι αριθμοί είναι **αναλογία**, όχι εικονοστοιχεία: το SVG τεντώνεται στο CSS και ο λόγος
 * 100:72 είναι το ίδιο πλατύ-κοντό κουτί που δείχνει το Excel. Ζουν εδώ (και όχι στο CSS)
 * επειδή ο χειριστής κλικ τους χρειάζεται αριθμητικά.
 */
export const TABLE_BORDER_PROXY_BOX = { width: 100, height: 72 } as const;

/** Ένα σημείο μέσα στη ζώνη, σε μονάδες `viewBox`. */
export interface TableBorderProxyPoint {
  readonly x: number;
  readonly y: number;
}

/** Το ευθύγραμμο τμήμα μιας θέσης, σε μονάδες `viewBox`. */
export interface TableBorderProxySegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const { width: W, height: H } = TABLE_BORDER_PROXY_BOX;

/**
 * Πού ζωγραφίζεται κάθε θέση.
 *
 * Χάρτης και όχι `switch`: είναι **δεδομένα** (όπως η σειρά των 13 εντολών), και ο εξαντλητικός
 * `Record` κάνει τον μεταγλωττιστή να μιλήσει την ημέρα που θα προστεθεί ένατη θέση.
 */
const PROXY_SEGMENTS: Readonly<Record<TableBorderDialogPositionId, TableBorderProxySegment>> = {
  top: { x1: 0, y1: 0, x2: W, y2: 0 },
  bottom: { x1: 0, y1: H, x2: W, y2: H },
  left: { x1: 0, y1: 0, x2: 0, y2: H },
  right: { x1: W, y1: 0, x2: W, y2: H },
  insideH: { x1: 0, y1: H / 2, x2: W, y2: H / 2 },
  insideV: { x1: W / 2, y1: 0, x2: W / 2, y2: H },
  'diagonal:down': { x1: 0, y1: 0, x2: W, y2: H },
  'diagonal:up': { x1: 0, y1: H, x2: W, y2: 0 },
};

/** Το τμήμα μιας θέσης — η **μία** πηγή και για το SVG και για το hit-test. */
export function tableBorderProxyLine(
  id: TableBorderDialogPositionId,
): TableBorderProxySegment {
  return PROXY_SEGMENTS[id];
}

/** Το μήκος του τμήματος — το χρειάζεται η κλίμακα της διακεκομμένης, ώστε να μη «σπάει». */
export function tableBorderProxyLineLength(id: TableBorderDialogPositionId): number {
  const { x1, y1, x2, y2 } = tableBorderProxyLine(id);
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Ποια θέση εννοεί ένα κλικ στο σημείο `point`; — η **πλησιέστερη** από τις `candidates`.
 *
 * `candidates` είναι πάντα οι **διαθέσιμες** θέσεις (ο καλών ρωτά το
 * `isTableBorderDialogPositionAvailable`): μια μη διαθέσιμη δεν επιτρέπεται να κερδίσει το
 * κλικ και μετά να μην κάνει τίποτα — είναι ακριβώς το «κουμπί που φαίνεται ενεργό» που
 * απαγορεύει η Α19.
 *
 * Ισοπαλία ⇒ νικά η **πρώτη κατά σειρά μητρώου**, δηλαδή ντετερμινιστικά: στο ακριβές κέντρο
 * του κουτιού και οι τέσσερις μεσαίες/διαγώνιες απέχουν μηδέν, και μια απάντηση που εξαρτιόταν
 * από τη σειρά απαρίθμησης αντικειμένου θα άλλαζε χωρίς να αλλάξει τίποτα.
 *
 * `null` μόνο όταν δεν υπάρχει **καμία** υποψήφια.
 */
export function nearestTableBorderDialogPosition(
  point: TableBorderProxyPoint,
  candidates: readonly TableBorderDialogPositionId[],
): TableBorderDialogPositionId | null {
  let best: TableBorderDialogPositionId | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  // Η σειρά του μητρώου, φιλτραρισμένη — ώστε η ισοπαλία να λύνεται από τα **δεδομένα**.
  for (const id of TABLE_BORDER_DIALOG_POSITIONS) {
    if (!candidates.includes(id)) continue;
    const distance = distanceToLine(point, tableBorderProxyLine(id));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

/**
 * Απόσταση σημείου από την **ευθεία** του τμήματος (όχι από το τμήμα).
 *
 * Είναι το σωστό ερώτημα εδώ επειδή κάθε τμήμα διασχίζει ολόκληρο το κουτί: δεν υπάρχει σημείο
 * της ζώνης «έξω από το μήκος» καμιάς γραμμής, οπότε η προβολή στα άκρα δεν έχει τι να λύσει.
 */
function distanceToLine(point: TableBorderProxyPoint, line: TableBorderProxySegment): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - line.x1, point.y - line.y1);
  return Math.abs(dy * (point.x - line.x1) - dx * (point.y - line.y1)) / length;
}
