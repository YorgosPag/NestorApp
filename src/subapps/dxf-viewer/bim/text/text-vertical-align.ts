/**
 * 🏢 ENTERPRISE — MTEXT `\A#;` (κατακόρυφη στοίχιση μέσα στη γραμμή), SSoT (ADR-737 §11-2).
 *
 * ── Η ΣΗΜΑΣΙΟΛΟΓΙΑ, ΕΠΑΛΗΘΕΥΜΕΝΗ ─────────────────────────────────────────────────────────
 * Από τον κώδικα αναφοράς του ezdxf (`tools/text_layout.py`), που είναι ο μόνος ανοιχτός
 * υλοποιητής με ρητό τύπο:
 *
 *     class CellAlignment(IntEnum): BOTTOM = 0; CENTER = 1; TOP = 2
 *     def vertical_cell_shift(cell, group_height):
 *         dy = 0.0
 *         if cell.valign != CellAlignment.TOP:
 *             dy = cell.total_height - group_height
 *             if cell.valign == CellAlignment.CENTER: dy /= 2.0
 *
 * Δύο πράγματα κλειδώνουν εδώ:
 *   1. Η αναφορά είναι το **ψηλότερο κομμάτι ΤΗΣ ΓΡΑΜΜΗΣ** (`group_height`) — όχι η οντότητα,
 *      όχι η παράγραφος.
 *   2. Όταν όλα τα κομμάτια έχουν το ίδιο ύψος, `dy = 0` για **και τις τρεις** τιμές ⇒ το `\A`
 *      είναι **no-op**. Αυτό ΔΕΝ είναι λεπτομέρεια υλοποίησης· είναι η ίδια η σημασία του
 *      κωδικού, και το `text-layout-vertical-align.test.ts` το καρφώνει με αρνητικό pin.
 *
 * ── ΓΙΑΤΙ ΜΠΑΙΝΕΙ ΚΑΙ Η ΑΓΚΥΡΩΣΗ ΣΤΟΝ ΤΥΠΟ ───────────────────────────────────────────────
 * Ο δικός μας ζωγράφος δίνει σε ΟΛΑ τα spans μιας γραμμής το **ίδιο** y και το ερμηνεύει με
 * `ctx.textBaseline = <αγκύρωση οντότητας>`. Άρα η γραμμή έχει **ήδη** μια σιωπηρή κατακόρυφη
 * στοίχιση: με αγκύρωση `top` τα κοντά runs κάθονται στην ΚΟΡΥΦΗ, με `bottom` στη ΒΑΣΗ. Το `\A`
 * δεν μπορεί λοιπόν να δώσει απόλυτη θέση — δίνει **αλλαγή βάσης**: «από εκεί που σε αφήνει η
 * αγκύρωση, πήγαινε εκεί που ζητά ο κωδικός». Γι' αυτό ο τύπος είναι διαφορά δύο κλασμάτων.
 * Αν κάποιος αφαιρέσει τον όρο της αγκύρωσης, κάθε MTEXT με αγκύρωση M/B θα μετακινηθεί.
 *
 * Καθαρό: μηδέν React / DOM / THREE / Firestore.
 *
 * @module bim/text/text-vertical-align
 */

import type { TextVerticalAnchor } from '../../text-engine/types';

/** MTEXT `\A#;` — `0` = bottom, `1` = center, `2` = top (ίδια αρίθμηση με το AutoCAD/ezdxf). */
export type TextVerticalAlign = 0 | 1 | 2;

/**
 * Πόσο **χαμηλώνει** ένα κοντό κομμάτι μέσα στη γραμμή, ως κλάσμα του περισσεύματος ύψους:
 * `top` δεν πέφτει καθόλου, `center` πέφτει μισό, `bottom` πέφτει όλο.
 */
function dropRatioOfAlign(align: TextVerticalAlign): number {
  if (align === 2) return 0;
  return align === 1 ? 0.5 : 1;
}

/**
 * Το **ίδιο** ερώτημα για τη σιωπηρή στοίχιση που επιβάλλει η αγκύρωση της οντότητας.
 *
 * ⚠️ `'alphabetic'` μετράει ως `'top'` εδώ **μόνο** επειδή είναι αδιάφορο: η τέταρτη αυτή
 * κατάσταση (ADR-635 Φ C.26) εμφανίζεται αποκλειστικά σε μονογραμμικό TEXT, που δεν έχει inline
 * κωδικούς — άρα `align === undefined` και η συνάρτηση από κάτω γυρίζει `0` πριν φτάσει εδώ.
 */
function dropRatioOfAnchor(anchor: TextVerticalAnchor | undefined): number {
  if (anchor === 'middle') return 0.5;
  return anchor === 'bottom' ? 1 : 0;
}

/**
 * Η κατακόρυφη μετατόπιση ενός span μέσα στη γραμμή του, σε μονάδες κόσμου, **θετική προς τα
 * ΠΑΝΩ** (ίδια σύμβαση με το `obliqueShearFromAngle`: το SSoT μιλά y-up και ο κάθε ζωγράφος
 * αρνείται για το δικό του y-down πλαίσιο).
 *
 * Επιστρέφει `0` — δηλαδή **καμία** αλλαγή στη σημερινή εικόνα — σε τρεις περιπτώσεις:
 *   • `align === undefined`: δεν υπήρξε ΠΟΤΕ `\A` σε αυτό το κείμενο. Σκόπιμα ΔΕΝ το θεωρούμε
 *     «0 = bottom»: το `?? 0` είναι σωστό στο **export** (εκεί «απών κωδικός» = προεπιλεγμένη
 *     κατάσταση), αλλά εδώ θα μετακινούσε **κάθε** γραμμή με ανάμεικτα ύψη σε ολόκληρο το σχέδιο,
 *     χωρίς κανένα αρχείο να το έχει ζητήσει. Ρητός κωδικός ⇒ ρητή μετακίνηση.
 *   • Η γραμμή έχει ενιαίο ύψος (`slack <= 0`) — ο κανόνας του ezdxf.
 *   • Η στοίχιση ταυτίζεται με αυτήν που ήδη επιβάλλει η αγκύρωση.
 */
export function spanVerticalOffsetWorld(
  align: TextVerticalAlign | undefined,
  anchor: TextVerticalAnchor | undefined,
  spanHeightWorld: number,
  lineTallestWorld: number,
): number {
  if (align === undefined) return 0;
  const slack = lineTallestWorld - spanHeightWorld;
  if (!(slack > 0)) return 0;
  return slack * (dropRatioOfAnchor(anchor) - dropRatioOfAlign(align));
}
