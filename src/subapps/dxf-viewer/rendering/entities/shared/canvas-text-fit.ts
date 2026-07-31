/**
 * SSoT — **να χωρέσει μια ετικέτα σε δοσμένο πλάτος οθόνης, με αποσιωπητικά** (ADR-736 Φ2).
 *
 * Screen-px, UI font, **μία γραμμή**, κόψιμο με `…`. Είναι το ιδίωμα «ellipsis» που κάθε
 * σοβαρό εργαλείο εφαρμόζει σε ονόματα αρχείων μέσα σε περιορισμένο πλαίσιο (Figma layer
 * list, Revit *Manage Links*, AutoCAD External References palette): **ποτέ υπερχείλιση,
 * ποτέ αναδίπλωση** — ένα όνομα που ξεχειλίζει σκεπάζει το ίδιο το σχέδιο.
 *
 * ⚠️ **Δεν είναι το `fittingPrefixLength` του `bim/text/text-layout.ts` και δεν το
 * αντικαθιστά.** Εκείνο απαντά **άλλη ερώτηση**: αναδίπλωση παραγράφου MTEXT σε **μονάδες
 * σχεδίου**, με μετρικές **SHX γραμματοσειράς CAD**, προτιμώντας όρια λέξεων. Εδώ: **μία**
 * ετικέτα, **screen px**, μετρικές **UI γραμματοσειράς** του `ctx`, με αποσιωπητικά. Ίδια
 * λέξη («fit»), δύο διαφορετικά προβλήματα — η ενοποίησή τους θα ήταν ισοπέδωση, όχι SSoT.
 *
 * Δανείζεται όμως τη **δυαδική αναζήτηση** εκείνου: αφελής σάρωση χαρακτήρα-χαρακτήρα κάνει
 * O(n) `measureText` ανά ετικέτα ανά frame — και το `measureText` είναι από τις ακριβότερες
 * κλήσεις του Canvas2D API (ADR-040: τίποτα O(n) δεν μπαίνει σε hot path χωρίς λόγο).
 */

/** Ο χαρακτήρας αποκοπής. Ένα glyph (U+2026), όχι τρεις τελείες — μετριέται σωστά παντού. */
const ELLIPSIS = '…';

/**
 * Το μεγαλύτερο πρόθεμα του `text` (συν `…` αν χρειάστηκε κόψιμο) που χωρά σε `maxWidthPx`,
 * ή `null` όταν **τίποτα** δεν χωρά — ούτε καν τα σκέτα αποσιωπητικά. `null` σημαίνει «μην
 * ζωγραφίσεις ετικέτα», που είναι σωστότερο από ένα ακατανόητο μονο-γράμματο υπόλειμμα.
 *
 * ⚠️ Ο καλών **πρέπει** να έχει θέσει ήδη το `ctx.font` που θα χρησιμοποιήσει για τη σχεδίαση:
 * η μέτρηση διαβάζει την τρέχουσα κατάσταση του context. Μέτρηση με άλλη γραμματοσειρά από τη
 * σχεδίαση είναι η κλασική αιτία ετικέτας που «σχεδόν» χωρά.
 */
export function fitCanvasTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
): string | null {
  if (!text || maxWidthPx <= 0) return null;
  if (ctx.measureText(text).width <= maxWidthPx) return text;
  if (ctx.measureText(ELLIPSIS).width > maxWidthPx) return null;

  // Δυαδική αναζήτηση στο μήκος του προθέματος: O(log n) μετρήσεις αντί για O(n).
  // Αναλλοίωτο: `lo` = μήκος που ΧΩΡΑΕΙ (το 0 χωρά πάντα, ελέγχθηκε παραπάνω), `hi` = άνω φράγμα.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + ELLIPSIS).width <= maxWidthPx) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ELLIPSIS;
}

/**
 * Το ίδιο, αλλά για **διαδρομή**: όταν δεν χωρά, πέφτει η **ΜΕΣΗ** — όχι το τέλος (ADR-736 §2.Β).
 *
 * ## Γιατί άλλη πλευρά κοπής, και γιατί ΕΔΩ και όχι σε δεύτερο helper
 *
 * Σε ένα *όνομα* η αρχή είναι το πληροφοριακό μέρος, οπότε κόβεις το τέλος. Σε μια *διαδρομή*
 * είναι πληροφοριακά **και τα δύο άκρα** και άχρηστη η μέση: `Z:\Jobs\` απαντά «σε ποιον
 * υπολογιστή ζούσε» και `1.jpg` απαντά «ποιο αρχείο» — ενώ τα ενδιάμεσα επίπεδα φακέλων είναι
 * ακριβώς ό,τι μπορεί να θυσιαστεί. Κόψιμο από το τέλος θα άφηνε `Z:\Jobs\OT\ΕΥΟΣ…` (ποιο
 * αρχείο;)· κόψιμο από την αρχή θα άφηνε `…\2026 ΠΑΓΩΝΗΣ\1.jpg` (ποιανού δίσκος;).
 *
 * Είναι η **πρακτική του κλάδου** για διαδρομές: macOS Finder, VS Code breadcrumbs, και το
 * native `PathCompactPathEx` των Windows κάνουν όλα μεσαία αποκοπή. Ο AutoCAD δείχνει την
 * πλήρη διαδρομή **χωρίς LOD** — σε zoom-out γίνεται δυσανάγνωστη μουτζούρα· εδώ υποβαθμίζουμε
 * ελεγχόμενα αντί να λερώσουμε το σχέδιο.
 *
 * Ζει στο **ίδιο** αρχείο με το {@link fitCanvasTextToWidth} επίτηδες: ίδια ερώτηση («χώρεσε
 * κείμενο σε screen px με `…`»), ίδιες μετρικές, ίδια δυαδική αναζήτηση. Χωριστό module θα ήταν
 * ακριβώς το sibling clone που απαγορεύει ο N.18 — μία γειτονιά, δύο πολιτικές κοπής.
 */
export function fitCanvasPathToWidth(
  ctx: CanvasRenderingContext2D,
  path: string,
  maxWidthPx: number,
): string | null {
  if (!path || maxWidthPx <= 0) return null;
  if (ctx.measureText(path).width <= maxWidthPx) return path;

  // Το ουραίο τμήμα («…\φάκελος\όνομα») είναι **αδιαπραγμάτευτο**: χωρίς αυτό ο χρήστης δεν
  // ξέρει καν ποιο αρχείο λείπει, οπότε η ετικέτα δεν έχει λόγο ύπαρξης. Αν δεν χωρά ούτε
  // αυτό, γυρνάμε `null` και ο καλών πέφτει στη βαθμίδα «μόνο όνομα».
  const tail = trailingSegments(path, 2);
  if (ctx.measureText(ELLIPSIS + tail).width > maxWidthPx) return null;

  // Πόσο πρόθεμα χωράει ΜΑΖΙ με το σταθερό ουραίο. Ίδια δυαδική αναζήτηση, ίδιο αναλλοίωτο.
  const head = path.slice(0, path.length - tail.length);
  let lo = 0;
  let hi = head.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(head.slice(0, mid) + ELLIPSIS + tail).width <= maxWidthPx) lo = mid;
    else hi = mid - 1;
  }
  return head.slice(0, lo) + ELLIPSIS + tail;
}

/**
 * Τα τελευταία `count` τμήματα της διαδρομής **μαζί με τον διαχωριστή που τα εισάγει**
 * (`\2026 ΠΑΓΩΝΗΣ\1.jpg`). Δέχεται και τους δύο διαχωριστές: το DXF κουβαλά διαδρομές
 * Windows, αλλά ένα αρχείο μπορεί να έχει γραφτεί από οποιοδήποτε σύστημα.
 */
function trailingSegments(path: string, count: number): string {
  let cut = path.length;
  for (let i = 0; i < count; i++) {
    const next = Math.max(path.lastIndexOf('\\', cut - 1), path.lastIndexOf('/', cut - 1));
    if (next <= 0) return path.slice(cut === path.length ? 0 : cut);
    cut = next;
  }
  return path.slice(cut);
}
