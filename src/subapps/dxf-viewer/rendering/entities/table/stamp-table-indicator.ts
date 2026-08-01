/**
 * ADR-739 Φ.Δ βήμα 7 — **ο δείκτης πίνακα**: γράμματα στηλών στην πάνω πλευρά, αριθμοί
 * γραμμών στην αριστερή, **μόνο** όσο ο πίνακας επεξεργάζεται.
 *
 * Είναι κυριολεκτικά η `TABLEINDICATOR` του AutoCAD — ο in-place επεξεργαστής κελιού του
 * εμφανίζει ακριβώς αυτές τις δύο ζώνες γύρω από τον πίνακα και τις σβήνει μόλις βγεις
 * (και **ποτέ** δεν τυπώνονται). Η τυπογραφία και το φωτισμένο ενεργό κελί ζώνης έρχονται
 * από το Excel.
 *
 * ## 🔴 Ο πίνακας ΔΕΝ μετακινείται — και γι' αυτό οι ζώνες ζουν στον καμβά
 * Ο Giorgio το έθεσε ρητά: «ο πίνακας να μην μετακινείται καθόλου από τη θέση που έχει
 * στον καμβά κατά το edit». Μια ζώνη που **σπρώχνει** (νέα σειρά στη διάταξη της σελίδας)
 * θα κόνταινε τον καμβά και θα μετέθετε ολόκληρο το σχέδιο τη στιγμή του διπλού κλικ —
 * δηλαδή το κελί θα έφευγε κάτω από το ποντίκι. Ζωγραφισμένη **στον καμβά**, σε αρνητικές
 * συντεταγμένες του πλαισίου του πίνακα, η ζώνη δεν έχει καμία σχέση με τη διάταξη: δεν
 * υπάρχει resize, δεν υπάρχει επαναϋπολογισμός προβολής, δεν κουνιέται τίποτα.
 *
 * ## Γιατί οι ζώνες γέρνουν με τον πίνακα, ενώ τα γράμματα μένουν ίσια
 * Τα ορθογώνια περνούν από το `toScreen` — άρα ακολουθούν την περιστροφή, όπως τα κελιά.
 * Τα **γράμματα** όμως ζωγραφίζονται οριζόντια, ακριβώς όπως ήδη κάνει το
 * {@link stampTableText} για το κείμενο των κελιών (`stampRun`: καμία `ctx.rotate`). Δεν
 * είναι δύο αποφάσεις — είναι **μία**, τηρημένη: ο πίνακας γέρνει, τα γράμματα διαβάζονται.
 * Ό,τι κι αν αποφασιστεί κάποτε για την περιστροφή κειμένου, θα αποφασιστεί σε **ένα**
 * σημείο και θα ισχύσει και για τα δύο.
 *
 * ## Όλα τα μεγέθη σε px οθόνης
 * Δες {@link TABLE_INDICATOR}: στοιχείο διεπαφής, όχι γεωμετρία σχεδίου. Η μετατροπή σε
 * sheet-mm γίνεται **μία φορά** ανά κλήση (`px / pxPerMm`), ώστε τα ορθογώνια να μπορούν να
 * περάσουν από το ίδιο `toScreen` με όλα τα υπόλοιπα και να γείρουν σωστά.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-indicator
 * @see bim/table/table-cell-reference.ts — ΠΩΣ λέγεται η κάθε υποδιαίρεση (ονομασία SSoT)
 * @see rendering/entities/table/stamp-table-layout.ts — ο αδελφός που ζωγραφίζει τον πίνακα
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §25
 */

import type { TableIndicatorTick } from '../../../bim/table/table-cell-reference';
import type { TableRectMm } from '../../../bim/table/table-layout-types';
import { TABLE_INDICATOR } from '../../../config/color-config';
import { tableCellFont, type StampTableContext } from './stamp-table-layout';

/**
 * Κάτω από αυτό το πλάτος **στην οθόνη**, η ετικέτα μιας υποδιαίρεσης παραλείπεται: ένα
 * `AA` σε στήλη 3 px είναι μουτζούρα πάνω στους γείτονές του. Το ορθογώνιο μένει — η ζώνη
 * πρέπει να φαίνεται συνεχής, αλλιώς μοιάζει με σφάλμα ζωγραφικής.
 */
const MIN_TICK_LABEL_PX = 10;

/**
 * Κάτω από αυτό το μέγεθος του **πίνακα** στην οθόνη, ο δείκτης δεν ζωγραφίζεται καθόλου.
 *
 * Οι ζώνες έχουν σταθερό πάχος σε px· σε έντονο zoom-out θα ήταν **πλατύτερες από τον ίδιο
 * τον πίνακα**, δηλαδή ένα γκρίζο πλαίσιο γύρω από μια κουκκίδα. Ίδια λογική LOD με το
 * `MIN_CELL_TEXT_SCREEN_PX` του κειμένου κελιού.
 */
const MIN_TABLE_SCREEN_PX = 48;

/** Ό,τι χρειάζεται μια κλήση — ονομασμένες υποδιαιρέσεις + το μέγεθος του πίνακα. */
export interface TableIndicatorBands {
  readonly columns: readonly TableIndicatorTick[];
  /** Μόνο οι **ορατές** γραμμές (ADR-735) — οι αριθμοί τους μένουν οι απόλυτοι. */
  readonly rows: readonly TableIndicatorTick[];
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Ζωγραφίζει και τις δύο ζώνες. Ο καλών το επιτρέπει **μόνο** όταν υπάρχει δρομέας, δηλαδή
 * στη φάση επιλογής — ίδιος κανόνας με τον δρομέα κελιού (ADR-040 #3: ποτέ μέσα στο cached
 * raster, αλλιώς κάθε `Tab` θα ακύρωνε ολόκληρο το bitmap της σκηνής).
 */
export function stampTableIndicator(rc: StampTableContext, bands: TableIndicatorBands): void {
  const { pxPerMm } = rc;
  if (bands.widthMm * pxPerMm < MIN_TABLE_SCREEN_PX) return;
  if (bands.heightMm * pxPerMm < MIN_TABLE_SCREEN_PX) return;

  const columnBandMm = TABLE_INDICATOR.columnBandPx / pxPerMm;
  const rowBandMm = TABLE_INDICATOR.rowBandPx / pxPerMm;

  // Η γωνία πρώτη: το κενό τετράγωνο πάνω-αριστερά που ενώνει τις δύο ζώνες. Χωρίς αυτό
  // φαίνεται μια τρύπα ακριβώς εκεί που το μάτι περιμένει τη γωνία του πλέγματος (το Excel
  // βάζει το γκρίζο τρίγωνο «επιλογή όλων»· εδώ δεν υπάρχει τέτοια εντολή, άρα μένει κενό).
  fillTick(rc, { x: -rowBandMm, y: -columnBandMm, w: rowBandMm, h: columnBandMm }, false);

  for (const tick of bands.columns) {
    stampTick(rc, tick, { x: tick.startMm, y: -columnBandMm, w: tick.sizeMm, h: columnBandMm });
  }
  for (const tick of bands.rows) {
    stampTick(rc, tick, { x: -rowBandMm, y: tick.startMm, w: rowBandMm, h: tick.sizeMm });
  }
}

/** Μία υποδιαίρεση: γέμισμα → περίγραμμα → ετικέτα. Ίδια σειρά και για τις δύο ζώνες. */
function stampTick(rc: StampTableContext, tick: TableIndicatorTick, rect: TableRectMm): void {
  fillTick(rc, rect, tick.active);
  strokeTick(rc, rect);
  stampLabel(rc, tick, rect);
}

/** Οι τέσσερις γωνίες ενός ορθογωνίου πλαισίου, ήδη σε px οθόνης. */
function cornersOf(rc: StampTableContext, rect: TableRectMm): readonly { x: number; y: number }[] {
  const { x, y, w, h } = rect;
  return [
    rc.toScreen(x, y),
    rc.toScreen(x + w, y),
    rc.toScreen(x + w, y + h),
    rc.toScreen(x, y + h),
  ];
}

/** Χαράζει τη διαδρομή του ορθογωνίου. Τέσσερις γωνίες, γιατί ο πίνακας περιστρέφεται. */
function tracePath(rc: StampTableContext, rect: TableRectMm): void {
  const corners = cornersOf(rc, rect);
  rc.ctx.beginPath();
  rc.ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) rc.ctx.lineTo(corners[i].x, corners[i].y);
  rc.ctx.closePath();
}

function fillTick(rc: StampTableContext, rect: TableRectMm, active: boolean): void {
  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = active ? TABLE_INDICATOR.activeFillHex : TABLE_INDICATOR.fillHex;
  tracePath(rc, rect);
  ctx.fill();
  ctx.restore();
}

function strokeTick(rc: StampTableContext, rect: TableRectMm): void {
  const { ctx } = rc;
  ctx.save();
  ctx.strokeStyle = TABLE_INDICATOR.lineHex;
  ctx.lineWidth = TABLE_INDICATOR.lineWidthPx;
  // Ρητά συμπαγής: το `stampTableBorders` μπορεί να έχει αφήσει διακεκομμένο μοτίβο πάνω
  // στο ίδιο context — το `save/restore` προστατεύει τη ΔΙΚΗ μας κλήση, όχι την επόμενη.
  ctx.setLineDash([]);
  tracePath(rc, rect);
  ctx.stroke();
  ctx.restore();
}

/**
 * Η ετικέτα, κεντραρισμένη στο ορθογώνιο και **οριζόντια στην οθόνη** — δες την κεφαλίδα.
 *
 * Το κέντρο υπολογίζεται στο πλαίσιο (mm) και μετά προβάλλεται, ποτέ ως μέσος όρος
 * προβεβλημένων γωνιών: με περιστροφή τα δύο συμπίπτουν, αλλά η πρώτη διαδρομή είναι η ίδια
 * που ακολουθεί όλη η υπόλοιπη ζωγραφική του πίνακα.
 */
function stampLabel(rc: StampTableContext, tick: TableIndicatorTick, rect: TableRectMm): void {
  if (rect.w * rc.pxPerMm < MIN_TICK_LABEL_PX) return;
  const { ctx } = rc;
  const center = rc.toScreen(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.save();
  ctx.fillStyle = tick.active ? TABLE_INDICATOR.activeTextHex : TABLE_INDICATOR.textHex;
  // Η ΙΔΙΑ συνάρτηση γραμματοσειράς με το κείμενο κελιού (N.18): μία μηχανή, ένα
  // αλφαριθμητικό `font` που δέχονται και ο καμβάς και το CSS.
  ctx.font = tableCellFont(TABLE_INDICATOR.fontPx, tick.active);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tick.label, center.x, center.y);
  ctx.restore();
}
