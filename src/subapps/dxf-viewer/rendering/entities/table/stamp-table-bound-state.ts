/**
 * 🔴 ADR-767 Δ4 — **Ο ΔΕΙΚΤΗΣ ΔΕΣΜΟΥ ΣΤΟΝ ΚΑΜΒΑ**: η μόνη οθόνη, ποτέ το χαρτί.
 *
 * ```
 *   ┌───────────┬───────────┬───────────┬───────────┐
 *   │ ▔▔▔▔▔▔▔▔▔ │ ▔▔▔▔▔▔▔▔▔ │ ▔▔▔▔▔▔▔▔▔ │           │ ← λωρίδες: ΔΕΜΕΝΕΣ ΣΤΗΛΕΣ (Δ8)
 *   │ Κ1        │ 412350.12 │ 4203118.4 │ γωνία     │
 *   │ Κ3        │ 412370.05 │◤4203095.1 │           │ ← ◤ κεχριμπάρι: ΠΑΡΑΚΑΜΨΗ
 *   │ Κ4        │ 412381.44 │◤4203088.9 │           │ ← ◤ κόκκινο: ΣΥΓΚΡΟΥΣΗ
 *   └───────────┴───────────┴───────────┴───────────┘
 * ```
 *
 * ## 🔴🔴 Ο ΦΡΟΥΡΟΣ ΤΟΥ ΧΑΡΤΙΟΥ — η γραμμή που κάνει ολόκληρο το αρχείο νόμιμο
 * Το Δ4 απαγορεύει ρητά αυτά τα σημάδια στο παραδοτέο, και το υπάρχον test της εξαγωγής
 * φυλάει τη διαδρομή `decomposeTable` → primitives. **Υπάρχει όμως δεύτερη πόρτα**: το
 * `print/capture/capture-2d.ts` ρασταροποιεί το PDF **μέσα από τους ίδιους renderers**. Χωρίς
 * τον φρουρό, ο δείκτης θα τυπωνόταν αυτούσιος και το test της εξαγωγής θα έμενε **πράσινο**.
 *
 * Ο φρουρός είναι το `getPrintColorPolicy()` και **όχι** νέα σημαία: η ερώτηση «είμαι πάνω σε
 * χαρτί;» έχει ήδη ιδιοκτήτη, τον οποίο ρωτά και το μελάνι του πίνακα (`table-ink.ts`). Δύο
 * απαντήσεις θα σήμαιναν ένα σημείο όπου το μελάνι και ο δείκτης διαφωνούν για το αν
 * τυπώνονται.
 *
 * ⚠️ **Το `skipInteractive` ΔΕΝ κάνει τη δουλειά.** Το καταναλώνει ο `DxfRenderer` για να
 * μηδενίσει επιλογή/hover/λαβές και **δεν φτάνει** εδώ· και το περνά **και** το bitmap cache,
 * που είναι οθόνη — άρα θα έσβηνε τον δείκτη ακριβώς εκεί που πρέπει να φαίνεται.
 *
 * ## Γιατί ζωγραφίζεται στο **normal pass** (και γιατί αυτό είναι σωστό)
 * Οι λωρίδες και τα σημάδια είναι **παράγωγα του μοντέλου** (`column.sourceKey`, `cell.bound`),
 * άρα ταξιδεύουν με το κλειδί του bitmap cache και μπορούν να ψηθούν στο raster χωρίς να
 * παλιώσουν — σε αντίθεση με τον δρομέα ή τα μυρμήγκια (ADR-040 κανόνας #3), που αλλάζουν
 * χωρίς να αλλάξει το μοντέλο. Ο δείκτης δεσμού πρέπει να φαίνεται **πάντα**, όχι μόνο σε
 * επιλεγμένο πίνακα: είναι ιδιότητα του σχεδίου, όχι της τρέχουσας χειρονομίας.
 *
 * 🔑 Η **μόνη** εξαίρεση είναι το «μπαγιάτικος», που ζει σε store (paint-time) — γι' αυτό το
 * `useDxfCanvasCacheInvalidation` ακυρώνει το raster στη συνδρομή του, με το **ίδιο**
 * συμβόλαιο που ήδη χρησιμοποιούν το LayerStore και το LWDISPLAY.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-bound-state
 * @see bim/table/binding/table-bound-marks.ts — ΤΙ σημαδεύεται (η κρίση, χωρίς καμβά)
 * @see config/color-config.ts — `TABLE_BOUND_STATE`: γιατί τρία χρώματα και όχι τέσσερα
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import { TABLE_BOUND_STATE } from '../../../config/color-config';
import { getPrintColorPolicy } from '../../../config/print-color-policy';
import { hexToRgba } from '../../../config/color-math';
import { traceRectMm, type StampTableContext } from './stamp-table-layout';
import type {
  BoundColumnStrip,
  BoundExceptionMark,
} from '../../../bim/table/binding/table-bound-marks';

/** Ό,τι χρειάζεται μια κλήση — **ήδη κριμένο**, ο ζωγράφος δεν αποφασίζει τίποτα. */
export interface TableBoundStateMarks {
  /** Οι δεμένες στήλες (Δ8) — μία λωρίδα η καθεμία, στην πάνω ακμή. */
  readonly strips: readonly BoundColumnStrip[];
  /** Μόνο τα **ορατά** κελιά που αποκλίνουν (ADR-735). */
  readonly marks: readonly BoundExceptionMark[];
  /**
   * Είπε ο **τελευταίος ρητός έλεγχος** ότι ο πίνακας δεν συμφωνεί με την πηγή του;
   *
   * `false` καλύπτει **και** το «ενημερωμένος» **και** το «κανείς δεν κοίταξε» — και αυτό
   * είναι σκόπιμο *εδώ*: ο ζωγράφος δεν ισχυρίζεται «όλα καλά», απλώς δεν ισχυρίζεται
   * τίποτα. Η διάκριση των δύο ζει στο store, όπου έχει καταναλωτή που τη χρειάζεται.
   */
  readonly stale: boolean;
}

export function stampTableBoundState(rc: StampTableContext, input: TableBoundStateMarks): void {
  // 🔴 Ο ΦΡΟΥΡΟΣ ΤΟΥ ΧΑΡΤΙΟΥ — δες την κεφαλίδα. Πρώτη γραμμή επίτηδες: ό,τι μπει από πάνω
  // του αύριο είναι ήδη προστατευμένο, χωρίς να χρειαστεί να το θυμηθεί ο επόμενος.
  if (getPrintColorPolicy() !== null) return;
  if (input.strips.length === 0 && input.marks.length === 0) return;

  stampColumnStrips(rc, input.strips, input.stale);
  stampExceptionMarks(rc, input.marks);
}

/**
 * Η λωρίδα κάθε δεμένης στήλης, στην **πάνω ακμή** του πίνακα.
 *
 * Το πάχος είναι σταθερό σε **px οθόνης** και μετατρέπεται σε sheet-mm μία φορά ανά κλήση —
 * ίδια σύμβαση με κάθε άλλον δείκτη του πίνακα (ζώνες, δρομέας, μυρμήγκια), ώστε τα
 * ορθογώνια να περνούν από το **ίδιο** `toScreen` και να γέρνουν σωστά με τον πίνακα.
 *
 * ⚠️ Ημιδιαφανές γέμισμα: η λωρίδα κάθεται πάνω στην περίμετρο και δεν επιτρέπεται να
 * διαβαστεί ως **γραμμή του σχεδίου**.
 */
function stampColumnStrips(
  rc: StampTableContext,
  strips: readonly BoundColumnStrip[],
  stale: boolean,
): void {
  if (strips.length === 0) return;
  const { ctx } = rc;
  const thicknessMm = TABLE_BOUND_STATE.columnThicknessPx / rc.pxPerMm;
  const hex = stale ? TABLE_BOUND_STATE.staleHex : TABLE_BOUND_STATE.columnHex;

  ctx.save();
  ctx.fillStyle = hexToRgba(hex, TABLE_BOUND_STATE.columnAlpha);
  for (const strip of strips) {
    // Ο μπαγιάτικος δεσμός ζωγραφίζεται **σπασμένος**: το ίδιο σχήμα, κομμένο. Δεύτερο
    // σχήμα θα ήταν δεύτερο λεξιλόγιο για την ίδια οικογένεια πληροφορίας.
    if (stale) stampDashedStrip(rc, strip, thicknessMm);
    else {
      traceRectMm(rc, { x: strip.xMm, y: 0, w: strip.widthMm, h: thicknessMm });
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Η ίδια λωρίδα, **κομμένη** — μία διαδρομή με πολλά υπο-ορθογώνια.
 *
 * Γεμίσματα και όχι `setLineDash` πάνω σε γραμμή, ώστε το πάχος να μένει το ίδιο νούμερο με
 * την αδιάσπαστη εκδοχή: μια γραμμή με `lineWidth` θα κεντραριζόταν στη διαδρομή και θα
 * ξεχείλιζε μισό πάχος **έξω** από τον πίνακα.
 */
function stampDashedStrip(
  rc: StampTableContext,
  strip: BoundColumnStrip,
  thicknessMm: number,
): void {
  const [onPx, offPx] = TABLE_BOUND_STATE.staleDashPx;
  const onMm = onPx / rc.pxPerMm;
  const periodMm = (onPx + offPx) / rc.pxPerMm;
  // Δηλώνεται στον καμβά ώστε το test της απομόνωσης να μπορεί να διακρίνει τις δύο
  // εκδοχές από τις κλήσεις, χωρίς να διαβάζει pixel.
  rc.ctx.setLineDash(TABLE_BOUND_STATE.staleDashPx as number[]);
  rc.ctx.beginPath();
  for (let x = strip.xMm; x < strip.xMm + strip.widthMm; x += periodMm) {
    const w = Math.min(onMm, strip.xMm + strip.widthMm - x);
    appendRect(rc, { x, y: 0, w, h: thicknessMm });
  }
  rc.ctx.fill();
}

/**
 * Το τριγωνάκι της εξαίρεσης, στην **πάνω-αριστερή** γωνία του κελιού.
 *
 * Θέση δανεισμένη από τον δείκτη σφάλματος του Excel/Sheets — και η μόνη γωνία κελιού που
 * δεν διεκδικείται ήδη (η λαβή συμπλήρωσης κάθεται κάτω-δεξιά, ADR-754 Γ4).
 *
 * Το μέγεθος είναι σε **px οθόνης**: ένα σημάδι που μεγαλώνει με το zoom θα σκέπαζε το κελί
 * του σε μεγάλη κλίμακα και θα εξαφανιζόταν σε μικρή — δηλαδή θα ήταν χρήσιμο σε ακριβώς μία
 * κλίμακα.
 */
function stampExceptionMarks(rc: StampTableContext, marks: readonly BoundExceptionMark[]): void {
  if (marks.length === 0) return;
  const { ctx } = rc;
  const sizeMm = TABLE_BOUND_STATE.markSizePx / rc.pxPerMm;

  ctx.save();
  for (const mark of marks) {
    // Το σημάδι **δεν** ξεπερνά ποτέ το κελί του: σε πολύ στενό ή χαμηλό κελί συρρικνώνεται
    // αντί να ξεχειλίσει στον γείτονα, όπου θα φαινόταν ότι αφορά **εκείνον**.
    const side = Math.min(sizeMm, mark.rect.w, mark.rect.h);
    ctx.fillStyle =
      mark.state === 'conflict' ? TABLE_BOUND_STATE.conflictHex : TABLE_BOUND_STATE.overriddenHex;
    ctx.beginPath();
    lineTo(rc, mark.rect.x, mark.rect.y, true);
    lineTo(rc, mark.rect.x + side, mark.rect.y, false);
    lineTo(rc, mark.rect.x, mark.rect.y + side, false);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Οι τέσσερις γωνίες ενός ορθογωνίου **μέσα** σε τρέχουσα διαδρομή (χωρίς `beginPath`). */
function appendRect(
  rc: StampTableContext,
  rect: { x: number; y: number; w: number; h: number },
): void {
  lineTo(rc, rect.x, rect.y, true);
  lineTo(rc, rect.x + rect.w, rect.y, false);
  lineTo(rc, rect.x + rect.w, rect.y + rect.h, false);
  lineTo(rc, rect.x, rect.y + rect.h, false);
  rc.ctx.closePath();
}

/** Ένα σημείο πλαισίου → οθόνη. Κάθε γωνία περνά από το **ίδιο** `toScreen` (περιστροφή). */
function lineTo(rc: StampTableContext, u: number, v: number, move: boolean): void {
  const p = rc.toScreen(u, v);
  if (move) rc.ctx.moveTo(p.x, p.y);
  else rc.ctx.lineTo(p.x, p.y);
}
