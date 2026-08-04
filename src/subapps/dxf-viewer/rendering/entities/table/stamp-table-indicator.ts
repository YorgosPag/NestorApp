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
 * ## Οι ζώνες γέρνουν με τον πίνακα — και τα γράμματά τους μαζί (ADR-739 Φ.Δ βήμα 8)
 * Τα ορθογώνια περνούν από το `toScreen` — άρα ακολουθούν την περιστροφή, όπως τα κελιά.
 * Τα **γράμματα** ζωγραφίζονταν οριζόντια, ακριβώς όπως έκανε τότε και το κείμενο των
 * κελιών. Αυτό το αρχείο το δήλωνε ρητά ως «μία απόφαση, τηρημένη», και πρόσθετε: «ό,τι κι
 * αν αποφασιστεί κάποτε για την περιστροφή κειμένου, θα αποφασιστεί σε **ένα** σημείο και
 * θα ισχύσει και για τα δύο».
 *
 * 🔴 **Αυτό ακριβώς έγινε.** Το βήμα 8 μέτρησε ότι ο ζωγράφος ήταν ο **μόνος** από τέσσερις
 * μηχανές που δεν έγερνε το κείμενο (DXF: `rot = 20,05°`· PDF: το ίδιο· επεξεργαστής κελιού:
 * `rotate(-0.35rad)`), και το ένα σημείο είναι το `stampFrameText`. Και οι δύο ετικέτες —
 * κελιού και ζώνης — περνούν από εκεί. Το επιχείρημα «η ζώνη είναι διεπαφή, ας μένει ίσια»
 * εξετάστηκε και απορρίφθηκε: ένα ίσιο γράμμα μέσα σε **γερμένο** κουτί δραπετεύει από το
 * κουτί του σε αρκετή γωνία. Το σκεπτικό ολόκληρο ζει στο `stampFrameText`.
 *
 * ## 🔴 ADR-739 §27.11 — οι ζώνες ΔΕΝ ακουμπούν τις λαβές (κενό, όχι z-order)
 * Οι λαβές του πίνακα κάθονται πάνω στην ακμή `v = 0` — την **ίδια** ακμή όπου τελείωνε η
 * πάνω ζώνη. Ζωγραφικά η σειρά ήταν ήδη σωστή (`renderWithPhases`: η γεωμετρία στο βήμα 4,
 * οι λαβές στο βήμα 6 ⇒ **πάντα** από πάνω· δες `BaseEntityRenderer`), άρα το πρόβλημα
 * **δεν** ήταν επικάλυψη ζωγραφικής: ήταν ότι το ίδιο pixel απαντούσε σε δύο ερωτήσεις.
 * Η λύση ζει ολόκληρη στη **γεωμετρία** (`TABLE_INDICATOR_GRIP_CLEARANCE_PX`) και
 * αυτός ο ζωγράφος δεν χρειάστηκε ούτε μία γραμμή — ακριβώς επειδή δεν ξέρει πού κάθεται:
 * ρωτά. Αυτό είναι το κέρδος του βήματος 9, εισπραγμένο.
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
// ADR-739 Φ.Δ βήμα 9 — ΠΟΥ κάθεται η κάθε ζώνη: το ξέρει πλέον **ένα** module, γιατί το
// ρωτά και το κλικ. Δες την κεφαλίδα εκείνου για το τι κοστίζει η δεύτερη απάντηση.
import {
  isTableIndicatorVisible,
  tableColumnTickRectMm,
  tableIndicatorBandsMm,
  tableIndicatorCornerRectMm,
  tableRowTickRectMm,
  type TableIndicatorBandsMm,
} from '../../../bim/table/table-indicator-geometry';
// 🔴 ADR-739 §43 — το σχήμα του κουμπιού «επιλογή όλων». Ο ζωγράφος **ρωτά**, δεν το ξέρει:
// την ίδια γεωμετρία καταναλώνει και το hit-test, άρα το μελάνι δεν μπορεί να αποκλίνει από
// τον στόχο που πατιέται.
import { tableSelectAllTriangleMm } from '../../../bim/table/table-select-all-corner';
import type { TableRectMm } from '../../../bim/table/table-layout-types';
import { TABLE_INDICATOR } from '../../../config/color-config';
import {
  stampFrameText,
  tableCellFont,
  traceRectMm,
  type StampTableContext,
} from './stamp-table-layout';

/**
 * Κάτω από αυτό το πλάτος **στην οθόνη**, η ετικέτα μιας υποδιαίρεσης παραλείπεται: ένα
 * `AA` σε στήλη 3 px είναι μουτζούρα πάνω στους γείτονές του. Το ορθογώνιο μένει — η ζώνη
 * πρέπει να φαίνεται συνεχής, αλλιώς μοιάζει με σφάλμα ζωγραφικής.
 */
const MIN_TICK_LABEL_PX = 10;

/**
 * 🔴 ADR-739 §43 — **οι δύο καταστάσεις του κουμπιού «επιλογή όλων»**.
 *
 * Ίδιο ακριβώς ζεύγος με το {@link TableIndicatorTick} (`active` + `hovered`), και **αυτό
 * είναι η προδιαγραφή**, όχι σύμπτωση: η γωνία είναι μια υποδιαίρεση της οποίας η ετικέτα
 * τυχαίνει να είναι τρίγωνο αντί για γράμμα. Ό,τι κανόνας ισχύει για το `B`, ισχύει και εδώ —
 * το ίδιο γέμισμα, το ίδιο πλύσιμο, το ίδιο μελάνι.
 *
 * Δεν κουβαλά ταυτότητα: η γωνία είναι **μία** ανά πίνακα.
 */
export interface TableSelectAllCornerState {
  /** Καλύπτει η επιλογή ολόκληρο το πλέγμα; **Παράγωγο** — ποτέ σημαία σε store. */
  readonly active: boolean;
  /** Στέκεται το χέρι από πάνω; Ίδιο κανάλι hover με τα γράμματα (§30). */
  readonly hovered: boolean;
}

/** Ό,τι χρειάζεται μια κλήση — ονομασμένες υποδιαιρέσεις + το μέγεθος του πίνακα. */
export interface TableIndicatorBands {
  readonly columns: readonly TableIndicatorTick[];
  /** Μόνο οι **ορατές** γραμμές (ADR-735) — οι αριθμοί τους μένουν οι απόλυτοι. */
  readonly rows: readonly TableIndicatorTick[];
  readonly widthMm: number;
  readonly heightMm: number;
  /** §43 — το τετραγωνάκι της συμβολής, με τις δύο καταστάσεις του. */
  readonly corner: TableSelectAllCornerState;
}

/**
 * Ζωγραφίζει και τις δύο ζώνες. Ο καλών το επιτρέπει **μόνο** όταν υπάρχει δρομέας, δηλαδή
 * στη φάση επιλογής — ίδιος κανόνας με τον δρομέα κελιού (ADR-040 #3: ποτέ μέσα στο cached
 * raster, αλλιώς κάθε `Tab` θα ακύρωνε ολόκληρο το bitmap της σκηνής).
 */
export function stampTableIndicator(rc: StampTableContext, bands: TableIndicatorBands): void {
  const { pxPerMm } = rc;
  if (!isTableIndicatorVisible(bands.widthMm, bands.heightMm, pxPerMm)) return;

  const bandsMm = tableIndicatorBandsMm(pxPerMm);

  // Η γωνία πρώτη: το τετράγωνο πάνω-αριστερά που ενώνει τις δύο ζώνες.
  stampSelectAllCorner(rc, bandsMm, bands.corner);

  for (const tick of bands.columns) {
    stampTick(rc, tick, tableColumnTickRectMm(tick, bandsMm));
  }
  for (const tick of bands.rows) {
    stampTick(rc, tick, tableRowTickRectMm(tick, bandsMm));
  }
}

/**
 * Μία υποδιαίρεση: γέμισμα → (πλύσιμο hover) → περίγραμμα → ετικέτα. Ίδια σειρά και για τις
 * δύο ζώνες.
 *
 * 🔴 ADR-739 §30 — **η σειρά του πλυσίματος είναι η προδιαγραφή.** Μπαίνει **πάνω** από το
 * γέμισμα (αλλιώς δεν θα φαινόταν καθόλου) και **κάτω** από το περίγραμμα και την ετικέτα:
 * οι διαχωριστικές γραμμές πρέπει να μένουν συνεχείς κατά μήκος της λωρίδας — μια λωρίδα που
 * σπάει οπτικά στο σημείο του δείκτη διαβάζεται ως σφάλμα ζωγραφικής — και το γράμμα δεν
 * επιτρέπεται να θολώσει τη στιγμή ακριβώς που ο χρήστης το στοχεύει.
 */
function stampTick(rc: StampTableContext, tick: TableIndicatorTick, rect: TableRectMm): void {
  fillTick(rc, rect, tick.active);
  if (tick.hovered) washTick(rc, rect);
  strokeTick(rc, rect);
  stampLabel(rc, tick, rect);
}

/**
 * 🔴 ADR-739 §43 — **ΤΟ ΚΟΥΜΠΙ «ΕΠΙΛΟΓΗ ΟΛΩΝ»**: γέμισμα → (πλύσιμο hover) → περίγραμμα →
 * τρίγωνο.
 *
 * 🔑 **Οι τρεις πρώτες κλήσεις είναι ΟΙ ΙΔΙΕΣ με του {@link stampTick}**, με την ίδια σειρά και
 * για τους ίδιους λόγους (§30). Αυτό δεν είναι εξοικονόμηση γραμμών — είναι η μετάφραση της
 * μέτρησης: στο Excel το κουτί της γωνίας βάφεται **σαν κεφαλίδα** όταν όλα είναι επιλεγμένα
 * (στιγμιότυπο 04/08: ίδιο ανοιχτό πράσινο `#D5EFD6` με τα γράμματα, τρίγωνο στο accent). Ο
 * Νέστωρ έχει άλλη παλέτα — και γι' αυτό ακριβώς δεν αντιγράφουμε τα hex του: αντιγράφουμε τον
 * **κανόνα** «η γωνία φοράει ό,τι φοράει μια ενεργή υποδιαίρεση» (§41.7), και τα χρώματα
 * βγαίνουν μόνα τους από το {@link TABLE_INDICATOR}.
 *
 * ## ⚠️ Το περίγραμμα είναι ΝΕΟ, και είναι απόφαση
 * Μέχρι το §43 η γωνία ζωγραφιζόταν με σκέτο `fillTick(..., false)` — χωρίς `strokeTick`. Ήταν
 * σωστό όσο ήταν **διακοσμητικό γέμισμα**: ένα κενό τετράγωνο δεν χρειάζεται να δηλώσει όρια.
 * Από τη στιγμή που έγινε **κουμπί** χρειάζεται: το τετράγωνο κάθεται μόνο του, με κενό
 * `gapMm` και από τις δύο ζώνες (δες `tableIndicatorCornerRectMm`), και χωρίς περίγραμμα το
 * μάτι δεν διαβάζει πού τελειώνει ο στόχος που πρέπει να πατήσει.
 */
function stampSelectAllCorner(
  rc: StampTableContext,
  bandsMm: TableIndicatorBandsMm,
  corner: TableSelectAllCornerState,
): void {
  const rect = tableIndicatorCornerRectMm(bandsMm);
  fillTick(rc, rect, corner.active);
  if (corner.hovered) washTick(rc, rect);
  strokeTick(rc, rect);
  stampSelectAllTriangle(rc, bandsMm, corner.active);
}

/**
 * Το τρίγωνο ◢, με το **ίδιο μελάνι που θα είχε ένα γράμμα** στην ίδια κατάσταση.
 *
 * Οι τρεις κορυφές γεννιούνται στο πλαίσιο (mm) και προβάλλονται μία-μία με το `toScreen` —
 * ποτέ ως μετασχηματισμός του καμβά. Ίδια αρχή με το {@link traceRectMm}: ο πίνακας
 * **περιστρέφεται**, και ένα τρίγωνο ζωγραφισμένο σε συντεταγμένες οθόνης θα έμενε ίσιο μέσα σε
 * γερμένο κουτί — δηλαδή θα δραπέτευε από το κουτί του σε αρκετή γωνία, ακριβώς το ελάττωμα
 * που το βήμα 8 έκλεισε για τις ετικέτες.
 */
function stampSelectAllTriangle(
  rc: StampTableContext,
  bandsMm: TableIndicatorBandsMm,
  active: boolean,
): void {
  const [a, b, c] = tableSelectAllTriangleMm(bandsMm);
  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = active ? TABLE_INDICATOR.activeTextHex : TABLE_INDICATOR.textHex;
  ctx.beginPath();
  for (const [index, point] of [a, b, c].entries()) {
    const screen = rc.toScreen(point.u, point.v);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ⚠️ ADR-739 Φ.Δ βήμα 8 — εδώ ζούσε **δεύτερη** διαδρομή τεσσάρων γωνιών (`cornersOf` +
// `tracePath`), ταυτόσημη με εκείνη του αδελφού ζωγράφου. Το CHECK 3.28 (jscpd, N.18) την
// έπιασε ως sibling clone — σωστά: δύο αντίγραφα σημαίνουν δύο ευκαιρίες να ξεχάσει
// κάποιος ότι ο πίνακας **περιστρέφεται**. Μία διαδρομή, δύο ζωγράφοι.

function fillTick(rc: StampTableContext, rect: TableRectMm, active: boolean): void {
  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = active ? TABLE_INDICATOR.activeFillHex : TABLE_INDICATOR.fillHex;
  traceRectMm(rc, rect);
  ctx.fill();
  ctx.restore();
}

/**
 * ADR-739 §30 — το ημιδιαφανές στρώμα του hover, **πάνω σε ό,τι κι αν** έχει ήδη ζωγραφιστεί.
 *
 * Δεν ξέρει — και δεν επιτρέπεται να ξέρει — αν από κάτω είναι το ουδέτερο γκρι ή το ενεργό
 * μπλε. Αυτή ακριβώς η άγνοια είναι που κάνει **έναν** κανόνα να απαντά και στις δύο
 * καταστάσεις· δες το σκεπτικό στο {@link TABLE_INDICATOR.hoverWashRgba}.
 */
function washTick(rc: StampTableContext, rect: TableRectMm): void {
  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = TABLE_INDICATOR.hoverWashRgba;
  traceRectMm(rc, rect);
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
  traceRectMm(rc, rect);
  ctx.stroke();
  ctx.restore();
}

/**
 * Η ετικέτα, κεντραρισμένη στο ορθογώνιο και **γερμένη με τον πίνακα** — δες την κεφαλίδα.
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
  // ADR-739 Φ.Δ βήμα 8 — ο ΙΔΙΟΣ σταμπαδόρος με το κείμενο των κελιών. Δες την κεφαλίδα:
  // ό,τι αποφασιστεί για τη στροφή κειμένου αποφασίζεται σε **ένα** σημείο και ισχύει και
  // για τα δύο — αυτό ακριβώς είναι που έγινε εδώ.
  stampFrameText(rc, center, tick.label);
  ctx.restore();
}
