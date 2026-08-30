/**
 * ADR-833 Φάσεις 3+4 — **Η ΛΩΡΙΔΑ ΚΑΡΤΕΛΩΝ ΦΥΛΛΩΝ**, κάτω από τον πίνακα: οι καρτέλες **και**
 * το ⊕ της προσθήκης.
 *
 * Το κάτοπτρο του `stamp-table-indicator.ts` στην κάτω ακμή, και τηρεί **αυτούσιους** τους
 * τρεις κανόνες εκείνου, γιατί είναι το ίδιο πρόβλημα:
 *
 *  1. **Ο ζωγράφος δεν ξέρει πού κάθεται — ρωτά.** Ολόκληρη η γεωμετρία (θέση, κενό, LOD,
 *     παράθυρο υπερχείλισης) ζει στο `table-worksheet-tabs-geometry.ts`, και το **ίδιο**
 *     αντικείμενο που ζωγραφίζεται εδώ είναι εκείνο που πιάνεται από το κλικ. Δεν είναι
 *     σύμβαση: είναι ο **ίδιος πίνακας `TableWorksheetTabSlot[]`**.
 *  2. **Οι καρτέλες γέρνουν με τον πίνακα — και τα ονόματά τους μαζί.** Τα ορθογώνια περνούν
 *     από `traceRectMm`, οι ετικέτες από `stampFrameText` (ADR-739 Φ.Δ βήμα 8). Ένα ίσιο
 *     όνομα μέσα σε γερμένη καρτέλα δραπετεύει από το κουτί του σε αρκετή γωνία.
 *  3. **Όλα τα μεγέθη σε px οθόνης.** Στοιχείο διεπαφής, όχι γεωμετρία σχεδίου.
 *
 * ## 🔴 Η ΛΩΡΙΔΑ ΔΕΝ ΤΥΠΩΝΕΤΑΙ ΠΟΤΕ — ο φύλακας είναι ο καλών
 * Ζωγραφίζεται **μόνο** στη φάση επιλογής (`if (selected)` του `TableRenderer`), δηλαδή
 * **ποτέ** μέσα στο cached raster της σκηνής (ADR-040 κανόνας #3). Είναι ο ίδιος φύλακας που
 * φυλά ήδη τον δρομέα και τα δύο χειριστήρια `⊕`/`⊖`, και έχει **δύο** συνέπειες: η λωρίδα
 * δεν μπαίνει σε εξαγωγή/εκτύπωση (όπως η `TABLEINDICATOR` του AutoCAD), και ένα `Tab` δεν
 * ακυρώνει ολόκληρο το bitmap της σκηνής.
 *
 * ## Η ετικέτα: αποκοπή με «…», ποτέ υπερχείλιση
 * Το ορθογώνιο είναι ο **στόχος**, η ετικέτα **διακόσμηση** — ίδιος διαχωρισμός με το
 * `MIN_TICK_LABEL_PX` του δείκτη (η λωρίδα μένει, το γράμμα φεύγει). Η αποκοπή δεν γράφεται
 * εδώ: τη δίνει το `fitCanvasTextToWidth`, το SSoT του έργου για «χώρεσε ετικέτα σε screen px
 * με αποσιωπητικά» (ADR-736 Φ2) — ένα δεύτερο `while` με `measureText` θα ήταν ακριβώς ο
 * sibling clone του N.18, και μάλιστα η αργή του εκδοχή (O(n) αντί για O(log n)).
 *
 * @module rendering/entities/table/stamp-table-worksheet-tabs
 * @see bim/table/table-worksheet-tabs-geometry.ts — ΠΟΥ κάθεται η κάθε καρτέλα
 * @see bim/table/table-worksheet-name.ts — ΠΩΣ λέγεται (ονομασία SSoT, ζωντανή γλώσσα)
 * @see rendering/entities/table/stamp-table-chrome-rect.ts — οι τρεις κινήσεις βαψίματος
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.3
 */

import { TABLE_INDICATOR } from '../../../config/color-config';
import { TABLE_WORKSHEET_TAB_LABEL_PADDING_PX } from '../../../bim/table/table-worksheet-tabs-geometry';
import type {
  TableWorksheetStrip,
  TableWorksheetTabSlot,
} from '../../../bim/table/table-worksheet-tabs-geometry';
// 🔴 ADR-833 Φάση 4 — **η ΜΙΑ ακτίνα χειριστηρίου του έργου**, ίδια με τα ⊕/⊖ των ζωνών: ένα
// `+` σε αυτόν τον πίνακα έχει ΕΝΑ μέγεθος, ανεξάρτητα από το σχήμα που το περιβάλλει.
import { TABLE_INSERT_CONTROL_RADIUS_PX } from '../../../bim/table/table-insert-control';
import {
  stampTableControlGlyph,
  tableControlGlyphArmPx,
} from './stamp-table-control-glyph';
import { worksheetDisplayName } from '../../../bim/table/table-worksheet-name';
import type { TableRectMm } from '../../../bim/table/table-layout-types';
import type { TableWorksheetId } from '../../../types/table-worksheet';
import {
  fillTableChromeRect,
  strokeTableChromeRect,
  washTableChromeRect,
} from './stamp-table-chrome-rect';
// 🔴 SSoT (ADR-736 Φ2) — «χώρεσε ετικέτα σε screen px, με `…`». Δυαδική αναζήτηση, όχι σάρωση.
import { fitCanvasTextToWidth } from '../shared/canvas-text-fit';
import { stampFrameText, tableCellFont, type StampTableContext } from './stamp-table-layout';

/**
 * Τι είναι φωτισμένο μέσα στη λωρίδα — **μία** τιμή, όχι δύο παράμετροι.
 *
 * Δύο ορίσματα (`hoveredTabId` + `addHovered`) θα ήταν δύο πράγματα που ο καλών πρέπει να
 * θυμάται να κρατά συμφωνημένα, και ο δείκτης φωτίζει **ένα** πράγμα κάθε στιγμή — ακριβώς ο
 * λόγος που το ίδιο το store έχει **ένα** πεδίο `target` και όχι ένα ανά είδος.
 */
export type TableWorksheetStripHover =
  | { readonly kind: 'tab'; readonly id: TableWorksheetId }
  | { readonly kind: 'add' }
  | null;

/**
 * Ζωγραφίζει τη λωρίδα. Κενή λωρίδα ⇒ **τίποτα**, και αυτό δεν είναι φύλακας εδώ: είναι η
 * απάντηση της γεωμετρίας στις τρεις πύλες της (LOD, χωρητικότητα, πλήθος φύλλων). Ο ζωγράφος
 * δεν κρίνει ορατότητα — αν την έκρινε, θα υπήρχε κατάσταση όπου ζωγραφίζεται κάτι που δεν
 * πιάνεται (ή το αντίστροφο), που είναι ψέμα της οθόνης.
 */
export function stampTableWorksheetStrip(
  rc: StampTableContext,
  strip: TableWorksheetStrip,
  hover: TableWorksheetStripHover,
): void {
  for (const slot of strip.tabs) {
    stampWorksheetTab(rc, slot, hover?.kind === 'tab' && hover.id === slot.id);
  }
  if (strip.add) stampWorksheetAddButton(rc, strip.add, hover?.kind === 'add');
}

/**
 * 🔴 **ADR-833 Φάση 4 — ΤΟ ⊕ ΤΗΣ ΠΡΟΣΘΗΚΗΣ ΦΥΛΛΟΥ.**
 *
 * ## Γιατί ορθογώνιο και όχι δίσκος, όπως τα ⊕/⊖ των ζωνών
 * Εκείνα κάθονται στο **κενό** γύρω από τον πίνακα, όπου δεν υπάρχει τίποτα να μοιάσουν· εδώ το
 * κουμπί ζει **μέσα στη λωρίδα**, δίπλα-δίπλα με καρτέλες. Ένας δίσκος θα διάβαζε ως ξένο σώμα
 * — και, χειρότερα, θα υποσχόταν **άλλη κατηγορία** πράξης από τη γειτονιά του. Το Excel, τα
 * Sheets και το Numbers συμφωνούν και τα τρία: το «νέο φύλλο» φοράει το σχήμα της λωρίδας.
 *
 * 🔑 Οι **τρεις κινήσεις βαψίματος είναι οι ίδιες** με της καρτέλας (γέμισμα → πλύσιμο hover →
 * περίγραμμα), από την ίδια πηγή — αλλά **ποτέ ενεργό γέμισμα**: το ⊕ δεν είναι φύλλο, δεν
 * μπορεί να είναι «το τρέχον». Το μπλε είναι δεσμευμένο για την **επιλογή**, και ένα κουμπί που
 * το φοράει θα έλεγε ψέματα για το τι βλέπει ο χρήστης.
 *
 * Το σύμβολο έρχεται από τον **ΕΝΑ** ζωγράφο συμβόλου και με την **ΙΔΙΑ** ακτίνα με τα άλλα δύο
 * χειριστήρια — δες την εισαγωγή.
 */
function stampWorksheetAddButton(
  rc: StampTableContext,
  rectMm: TableRectMm,
  hovered: boolean,
): void {
  fillTableChromeRect(rc, rectMm, false);
  if (hovered) washTableChromeRect(rc, rectMm);
  strokeTableChromeRect(rc, rectMm);
  stampTableControlGlyph(
    rc,
    { u: rectMm.x + rectMm.w / 2, v: rectMm.y + rectMm.h / 2 },
    tableControlGlyphArmPx(TABLE_INSERT_CONTROL_RADIUS_PX),
    'plus',
    { glyphHex: TABLE_INDICATOR.textHex, glyphWidthPx: TABLE_INDICATOR.lineWidthPx },
  );
}

/**
 * Μία καρτέλα: γέμισμα → (πλύσιμο hover) → περίγραμμα → ετικέτα.
 *
 * 🔑 **Η ΙΔΙΑ σειρά, από την ΙΔΙΑ πηγή** με την υποδιαίρεση ζώνης και το κουμπί της γωνίας
 * (`stamp-table-chrome-rect.ts`). Δεν είναι στυλιστική ομοιότητα: η σειρά **είναι** η
 * προδιαγραφή του ADR-739 §30 — το πλύσιμο πάνω από το γέμισμα, κάτω από περίγραμμα και
 * ετικέτα — και μια δεύτερη διατύπωσή της εδώ θα ήταν η ευκαιρία να γραφτεί ανάποδα.
 */
function stampWorksheetTab(
  rc: StampTableContext,
  slot: TableWorksheetTabSlot,
  hovered: boolean,
): void {
  fillTableChromeRect(rc, slot.rectMm, slot.active);
  if (hovered) washTableChromeRect(rc, slot.rectMm);
  strokeTableChromeRect(rc, slot.rectMm);
  stampWorksheetTabLabel(rc, slot);
}

/**
 * Το όνομα, κεντραρισμένο και **γερμένο με τον πίνακα**.
 *
 * ⚠️ Το `ctx.font` τίθεται **πριν** τη μέτρηση, και αυτό είναι απαίτηση του
 * {@link fitCanvasTextToWidth}: μετρά διαβάζοντας την τρέχουσα κατάσταση του context. Μέτρηση
 * με άλλη γραμματοσειρά από τη σχεδίαση είναι η κλασική αιτία ετικέτας που «σχεδόν» χωρά —
 * και εδώ θα ήταν χειρότερη, γιατί η **ενεργή** καρτέλα γράφεται με **έντονα** (Excel parity:
 * το ενεργό φύλλο δηλώνεται και με βάρος, όχι μόνο με χρώμα — η διπλή κωδικοποίηση είναι
 * απαίτηση της πύλης 3.41, «ξέρω ποιο είναι ποιο χωρίς να δω χρώμα»).
 *
 * `null` από τον επιλυτή σημαίνει «δεν χωρά ούτε το `…`» ⇒ **καμία ετικέτα**. Το ορθογώνιο
 * μένει: η λωρίδα πρέπει να φαίνεται συνεχής, και ένα μονο-γράμματο υπόλειμμα δεν λέει τίποτα.
 */
function stampWorksheetTabLabel(rc: StampTableContext, slot: TableWorksheetTabSlot): void {
  const { ctx } = rc;
  ctx.save();
  ctx.font = tableCellFont(TABLE_INDICATOR.fontPx, slot.active);
  const innerPx = slot.rectMm.w * rc.pxPerMm - 2 * TABLE_WORKSHEET_TAB_LABEL_PADDING_PX;
  const label = fitCanvasTextToWidth(ctx, worksheetDisplayName(slot.sheet, slot.index), innerPx);
  if (label === null) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = slot.active ? TABLE_INDICATOR.activeTextHex : TABLE_INDICATOR.textHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Το κέντρο υπολογίζεται στο **πλαίσιο** (mm) και μετά προβάλλεται, ποτέ ως μέσος όρος
  // προβεβλημένων γωνιών: με περιστροφή τα δύο συμπίπτουν, αλλά η πρώτη διαδρομή είναι η ίδια
  // που ακολουθεί όλη η υπόλοιπη ζωγραφική του πίνακα.
  const centre = rc.toScreen(
    slot.rectMm.x + slot.rectMm.w / 2,
    slot.rectMm.y + slot.rectMm.h / 2,
  );
  stampFrameText(rc, centre, label);
  ctx.restore();
}
