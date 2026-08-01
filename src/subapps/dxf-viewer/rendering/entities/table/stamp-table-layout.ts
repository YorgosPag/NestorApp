/**
 * ADR-739 Φάση Γ — **ο καμβάς-backend του `TableLayout`** (SRP split, αδελφός του
 * `stamp-opening-info-tag-primitives.ts`).
 *
 * Παίρνει έτοιμη γεωμετρία σε **sheet-mm πλαισίου** και τη στοιβάζει στον καμβά μέσω της
 * κλειστότητας `toScreen(u, v)` που κατέχει ο καλών (περιστροφή + κλίμακα + αναστροφή y).
 * **Κανένας υπολογισμός συντεταγμένων εδώ**, καμία ανάγνωση store — ώστε ο ζωγράφος να
 * μην μπορεί να αποκλίνει από το hit-test και τις λαβές, που διαβάζουν την ίδια διάταξη.
 *
 * ## Το LOD δεν είναι διακόσμηση
 * Κάτω από {@link MIN_CELL_TEXT_SCREEN_PX} τα γράμματα είναι δυσανάγνωστα μουτζούρα και
 * κοστίζουν όσο και τα ευανάγνωστα — ένας πίνακας 500 γραμμών σε zoom-out θα ζητούσε 4.000
 * `fillText` για μηδέν πληροφορία. Το πλέγμα μένει, το κείμενο φεύγει (§6, «zoom < LOD_TEXT
 * → μόνο πλέγμα + γεμίσματα»).
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-layout
 * @see bim/table/table-layout-types.ts — τα σχήματα που δέχεται
 * @see rendering/entities/TableRenderer.ts — ο καλών
 */

import type { Point2D } from '../../types/Types';
import type {
  TableBorderSegment,
  TableCellLayout,
  TableRectMm,
  TableTextRun,
} from '../../../bim/table/table-layout-types';
import { buildUIFont } from '../../../config/text-rendering-config';
import { TABLE_CELL_CURSOR } from '../../../config/color-config';

/** Κάτω από αυτό το ύψος κεφαλαίου στην οθόνη, το κείμενο κελιού δεν ζωγραφίζεται. */
export const MIN_CELL_TEXT_SCREEN_PX = 5;

/** Ελάχιστο πάχος γραμμής στην οθόνη — hairline αντί για αόρατη γραμμή. */
const MIN_BORDER_SCREEN_PX = 0.5;

export interface StampTableContext {
  readonly ctx: CanvasRenderingContext2D;
  /** Πλαίσιο → οθόνη: (u, v) σε sheet-mm → px. Κατέχει περιστροφή + κλίμακα + αναστροφή y. */
  readonly toScreen: (u: number, v: number) => Point2D;
  /** Px οθόνης ανά **sheet-mm** — για ύψη γραμματοσειράς και πάχη μολυβιού. */
  readonly pxPerMm: number;
  /**
   * Το χρώμα της τρέχουσας φάσης (hover / επιλογή). Όταν υπάρχει, **παρακάμπτει** τα
   * χρώματα του στυλ ώστε ολόκληρος ο πίνακας να φωτίζεται ομοιόμορφα — αλλιώς ένας
   * πίνακας με έγχρωμα κελιά θα φαινόταν μισο-επιλεγμένος.
   *
   * ⚠️ **Βάφει τη σιλουέτα, ΠΟΤΕ το κείμενο** — δες {@link stampRun}.
   */
  readonly phaseColor?: string;
}

// ── Γεμίσματα ────────────────────────────────────────────────────────────────

/** Τα γεμίσματα κελιών ΠΡΩΤΑ — κάθε άλλη σειρά θα τα ζωγράφιζε πάνω από το πλέγμα. */
export function stampTableFills(rc: StampTableContext, cells: readonly TableCellLayout[]): void {
  const { ctx } = rc;
  for (const cell of cells) {
    const fill = cell.style.fillColorHex;
    if (!fill) continue;
    const { x, y, w, h } = cell.rect;
    ctx.save();
    ctx.fillStyle = rc.phaseColor ?? fill;
    ctx.beginPath();
    const p0 = rc.toScreen(x, y);
    const p1 = rc.toScreen(x + w, y);
    const p2 = rc.toScreen(x + w, y + h);
    const p3 = rc.toScreen(x, y + h);
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Πλέγμα ───────────────────────────────────────────────────────────────────

/** Τα τμήματα περιγράμματος, το καθένα με το δικό του μολύβι (χρώμα/πάχος/διακεκομμένη). */
export function stampTableBorders(
  rc: StampTableContext,
  segments: readonly TableBorderSegment[],
): void {
  const { ctx } = rc;
  for (const segment of segments) {
    if (!segment.spec.visible) continue;
    const a = rc.toScreen(segment.a.x, segment.a.y);
    const b = rc.toScreen(segment.b.x, segment.b.y);
    ctx.save();
    ctx.strokeStyle = rc.phaseColor ?? segment.spec.colorHex;
    ctx.lineWidth = Math.max(segment.spec.widthMm * rc.pxPerMm, MIN_BORDER_SCREEN_PX);
    if (segment.spec.dashMm) {
      ctx.setLineDash(segment.spec.dashMm.map((d) => d * rc.pxPerMm));
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Δρομέας κελιού ───────────────────────────────────────────────────────────

/**
 * ADR-739 Φ.Δ βήμα 2 — το ορθογώνιο του **τρέχοντος κελιού** (Excel cell cursor).
 *
 * ⚠️ **Ζωγραφίζεται ΠΑΝΤΑ τελευταίο και ΠΟΤΕ μέσα στο cached raster.** Ο καλών το
 * επιτρέπει μόνο στη φάση επιλογής/hover, δηλαδή στο overlay pass του
 * `dxf-canvas-interactive-overlays` — ADR-040 κανόνας #3. Αν έμπαινε στο bitmap cache,
 * κάθε `Tab` θα ακύρωνε ολόκληρο το raster της σκηνής.
 *
 * Οι τέσσερις γωνίες περνούν από το `toScreen` (και όχι ένα `strokeRect` πάνω σε δύο
 * σημεία): ο πίνακας μπορεί να είναι **περιστραμμένος**, και ένα ορθογώνιο σε άξονες
 * οθόνης θα κρεμόταν λοξά πάνω από το κελί. Ίδιος δρόμος με τα γεμίσματα.
 *
 * Δεν παίρνει `phaseColor`: ο δρομέας είναι δείκτης **διεπαφής**, όχι κατάσταση της
 * οντότητας — μια hovered επιλογή δεν αλλάζει ποιο κελί δέχεται την πληκτρολόγηση.
 */
export function stampTableCellCursor(rc: StampTableContext, rectMm: TableRectMm): void {
  const { ctx } = rc;
  const { x, y, w, h } = rectMm;
  ctx.save();
  ctx.strokeStyle = TABLE_CELL_CURSOR.colorHex;
  ctx.lineWidth = TABLE_CELL_CURSOR.lineWidthPx;
  ctx.setLineDash([]);
  ctx.beginPath();
  const corners = [
    rc.toScreen(x, y),
    rc.toScreen(x + w, y),
    rc.toScreen(x + w, y + h),
    rc.toScreen(x, y + h),
  ];
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// ── Κείμενο ──────────────────────────────────────────────────────────────────

/**
 * 🔴 ADR-739 Φ.Δ βήμα 3 — **Η ΜΙΑ γραμματοσειρά του κειμένου κελιού**, ως αλφαριθμητικό
 * που δέχονται **και** το `ctx.font` του καμβά **και** το CSS `font` shorthand του DOM.
 *
 * Ο in-cell επεξεργαστής είναι ένα `<input>` πάνω ακριβώς από το κελί. Αν χρησιμοποιούσε
 * *δική του* γραμματοσειρά, το κείμενο θα **αναπηδούσε** τη στιγμή του διπλού κλικ και ο
 * κέρσορας θα έπεφτε σε άλλο γράμμα από αυτό που δείχνει ο χρήστης — γιατί ο υπολογισμός
 * πλάτους θα γινόταν σε δύο διαφορετικές γραμματοσειρές. Με **κοινό** αλφαριθμητικό, οι
 * δύο μετρήσεις είναι κυριολεκτικά η **ίδια** μέτρηση της ίδιας μηχανής του browser.
 *
 * ⚠️ Το `'arial'` είναι σκόπιμα καρφωμένο και **δεν** διαβάζει το `TableCellStyle.fontFamily`:
 * αυτό το πεδίο τροφοδοτεί σήμερα μόνο τον **μετρητή διάταξης** (`measureTextAdvanceWorld`,
 * opentype). Ο καμβάς πάντα ζωγράφιζε Arial. Η ενοποίηση των δύο είναι ξεχωριστό χρέος —
 * μέχρι τότε ο επεξεργαστής οφείλει να ακολουθεί ό,τι **ζωγραφίζεται**, όχι ό,τι μετριέται.
 */
export function tableCellFont(fontPx: number, bold: boolean): string {
  return buildUIFont(fontPx, 'arial', bold ? 'bold' : 'normal');
}

/** Ταυτότητα κελιού — το κλειδί με το οποίο ο καλών ζητά παράλειψη ζωγραφικής. */
export interface TableCellRef {
  readonly rowId: string;
  readonly colId: string;
}

/**
 * Τα κείμενα των κελιών. Το `run.position.y` είναι η **γραμμή βάσης** (σύμβαση
 * `TableTextRun` / `TextPrimitive`), γι' αυτό `textBaseline = 'alphabetic'` — η
 * προεπιλογή. Ρητό `'middle'` εδώ θα μετατόπιζε κάθε γραμμή κατά μισό ύψος κεφαλαίου:
 * ακριβώς το σφάλμα του 1,5mm που η Φ.Β πλήρωσε επειδή μπέρδεψε τη γραμμή
 * περιεχομένου με την ακμή.
 *
 * `skip` (ADR-739 Φ.Δ βήμα 3) = το κελί που έχει **ανοιχτή συνεδρία γραφής**: εκεί το
 * κείμενο το κατέχει το `<input>` του επεξεργαστή. Χωρίς αυτό, το δεσμευμένο κείμενο και
 * το πρόχειρο ζωγραφίζονται **ταυτόχρονα**, το ένα πάνω στο άλλο — το «διπλό κείμενο» που
 * φαινόταν στο στιγμιότυπο του Giorgio (2026-08-01). Στο Excel το κελί που επεξεργάζεσαι
 * δείχνει **μόνο** το πεδίο εισαγωγής.
 *
 * Επιστρέφει `false` όταν το LOD έκοψε το κείμενο — ο καλών το χρειάζεται για tests.
 */
export function stampTableText(
  rc: StampTableContext,
  cells: readonly TableCellLayout[],
  skip?: TableCellRef | null,
): boolean {
  const { ctx } = rc;
  let drewAny = false;
  for (const cell of cells) {
    const run = cell.text;
    if (!run) continue;
    if (skip && cell.rowId === skip.rowId && cell.colId === skip.colId) continue;
    const fontPx = run.heightMm * rc.pxPerMm;
    if (fontPx < MIN_CELL_TEXT_SCREEN_PX) continue;
    stampRun(ctx, rc, run, fontPx);
    drewAny = true;
  }
  return drewAny;
}

/**
 * ⚠️ **Το κείμενο ΔΕΝ δέχεται ποτέ το `phaseColor` — μετρημένο ελάττωμα, όχι προτίμηση.**
 *
 * Το χρώμα φάσης βάφει τη **σιλουέτα** (γεμίσματα + πλέγμα). Αν έβαφε και τα γράμματα, ένα
 * κελί **με γέμισμα** θα έπαιρνε το ίδιο χρώμα δύο φορές — φόντο και μελάνι — και το κείμενο
 * θα εξαφανιζόταν σε μονόχρωμο πλακάκι. Ακριβώς αυτό συνέβαινε: στο hover η **γραμμή
 * κεφαλίδων** (το μόνο μέρος με `fillColorHex`) έχανε τα «Α/Α · Περιγραφή · Ποσότητα», ενώ
 * οι σειρές δεδομένων — χωρίς γέμισμα, άρα με το σκούρο φόντο του καμβά από πίσω — κρατούσαν
 * τα γράμματά τους. Η ασυμμετρία ήταν το αποτύπωμα: **όποιο κελί έχει γέμισμα, χάνει το
 * κείμενο** (επαληθεύτηκε στην οθόνη, 2026-07-31, ADR-739 §19.8).
 *
 * Το κείμενο κρατά το `run.colorHex` του, οπότε η αντίθεση που σχεδίασε ο συγγραφέας του
 * στυλ επιβιώνει σε **κάθε** φάση. Ίδια αρχή με το AutoCAD: το highlight αλλάζει τη
 * σιλουέτα της οντότητας, δεν την κάνει δυσανάγνωστη.
 */
function stampRun(
  ctx: CanvasRenderingContext2D,
  rc: StampTableContext,
  run: TableTextRun,
  fontPx: number,
): void {
  const anchor = rc.toScreen(run.position.x, run.position.y);
  ctx.save();
  ctx.fillStyle = run.colorHex;
  ctx.font = tableCellFont(fontPx, run.bold);
  ctx.textAlign = run.hAlign;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(run.text, anchor.x, anchor.y);
  ctx.restore();
}
