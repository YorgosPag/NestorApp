/**
 * ADR-739 Φ.Δ βήμα 3 — **το κελί ως κουτί οθόνης**: από sheet-mm της διάταξης σε px CSS.
 *
 * Καθαρή, χωρίς DOM, χωρίς store. Το μόνο πράγμα που κάνει είναι να μεταφράσει τα νούμερα
 * που **ήδη** παρήγαγε η μηχανή διάταξης ({@link TableCellEditTarget}) στα νούμερα που
 * θέλει ένα `<input>` για να καθίσει **αόρατο** πάνω από το κελί.
 *
 * ## 🔴 Το δύσκολο κομμάτι: η γραμμή βάσης μέσα σε `<input>`
 *
 * Ο καμβάς τοποθετεί τη γραμμή βάσης απόλυτα (`fillText` + `textBaseline='alphabetic'`).
 * Το DOM **δεν** έχει «βάλε τη βάση εδώ». Ένα μονόγραμμο `<input>` **κεντράρει** το κουτί
 * γραμμής μέσα στο content box. Άρα, με μηδενικά περιθώρια, η βάση κάθεται στο
 * `H/2 + (A−D)/2` — που **δεν** είναι εκεί που τη ζωγραφίζει ο καμβάς. Για Arial η
 * διαφορά είναι ≈ 0,15 em: σε γραμματοσειρά 30 px, **4,6 px** αναπήδηση τη στιγμή που
 * μπαίνεις στο κελί. Ορατό, και ακριβώς το είδος σφάλματος που κανένα test κατάστασης
 * δεν πιάνει.
 *
 * Η λύση είναι κλειστού τύπου, όχι μαγικός αριθμός. Με `padding-bottom = 0`:
 *
 *     βάση = padTop + (H − padTop)/2 + (A − D)/2   ⇒   padTop = 2·(στόχος − H/2 − (A−D)/2)
 *
 * και συμμετρικά με `padding-top = 0` όταν ο στόχος είναι **πάνω** από το κέντρο. Ένα από
 * τα δύο σκέλη ισχύει πάντα, γιατί το padding δεν γίνεται αρνητικό.
 *
 * ### Γιατί δηλώνεται ΚΑΙ `line-height` ίσο με το content box
 * Οι μηχανές δεν συμφωνούν αν ένα `<input>` **κεντράρει** το κουτί γραμμής ή **τιμά** το
 * `line-height`. Αν το κουτί γραμμής είναι **ακριβώς όσο** το content box, οι δύο
 * συμπεριφορές γίνονται **αριθμητικά ταυτόσημες** — το half-leading μηδενίζεται και ο
 * παραπάνω τύπος ισχύει και στις δύο. Δεν είναι διακόσμηση: είναι το τι κάνει τον τύπο
 * ανεξάρτητο από τη μηχανή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-frame
 * @see bim/table/table-cell-edit-session.ts — η είσοδος (sheet-mm)
 * @see ui/table-cell-editor/table-cell-text-metrics.ts — από πού έρχονται τα A/D
 */

import type { TextAlign } from '../../bim/structural/detail-sheet/detail-sheet-types';
import type { TableCellEditTarget } from '../../bim/table/table-cell-edit-session';
import { tableCellFont } from '../../rendering/entities/table/stamp-table-layout';
import type { CellFontBandPx } from './table-cell-text-metrics';

/** Ελάχιστο ύψος περιεχομένου (px) ώστε το κουτί γραμμής να μην εκφυλιστεί σε μηδέν. */
const MIN_CONTENT_PX = 1;

/** Ό,τι χρειάζεται το `<input>` για να είναι οπτικά **το ίδιο το κελί**. */
export interface TableCellEditorFrame {
  /** Το ορθογώνιο του κελιού σε px οθόνης — ΠΡΙΝ την περιστροφή. */
  readonly widthPx: number;
  readonly heightPx: number;
  /**
   * Περιστροφή σε **CSS** ακτίνια (θετικά δεξιόστροφα, άξονας y προς τα κάτω).
   *
   * Είναι το **αντίθετο** του `entity.angleRad`: η σκηνή μετρά αριστερόστροφα με y προς τα
   * πάνω. Η αναστροφή y της προβολής γυρίζει τη φορά — ένα ξεχασμένο πρόσημο εδώ γέρνει
   * τον επεξεργαστή προς τη **λάθος** μεριά, κάτι που φαίνεται μόνο σε στραμμένο πίνακα.
   */
  readonly rotationRad: number;
  /** Πλήρες shorthand — ίδιο αλφαριθμητικό με το `ctx.font` του ζωγράφου. */
  readonly font: string;
  readonly paddingTopPx: number;
  readonly paddingRightPx: number;
  readonly paddingBottomPx: number;
  readonly paddingLeftPx: number;
  /** Ίσο με το ύψος του content box — δες την κεφαλίδα. */
  readonly lineHeightPx: number;
  readonly textAlign: TextAlign;
  readonly colorHex: string;
  /**
   * Το **αδιαφανές** φόντο του επεξεργαστή: το γέμισμα του κελιού, ή — σε κελί χωρίς
   * γέμισμα — το φόντο του καμβά.
   *
   * Χρειάζεται να είναι αδιαφανές γιατί το δεσμευμένο κείμενο του κελιού ζει και μέσα στο
   * **cached raster** του καμβά (ADR-040: το κλειδί του cache δεν δέχεται διαδραστική
   * κατάσταση — «this change only ever REMOVES inputs from the key»). Ο ζωγράφος
   * παραλείπει το κελί στο overlay pass· το raster από κάτω το κρατά. Το αδιαφανές κουτί
   * είναι αυτό που το σκεπάζει — και είναι ακριβώς ό,τι κάνει και το Excel.
   */
  readonly backgroundHex: string;
}

/** Οι δύο κατακόρυφες γεμίσεις που φέρνουν τη γραμμή βάσης στη θέση της. */
function verticalPadding(
  heightPx: number,
  baselinePx: number,
  band: CellFontBandPx,
): { readonly topPx: number; readonly bottomPx: number } {
  const centred = heightPx / 2 + (band.ascentPx - band.descentPx) / 2;
  const room = Math.max(0, heightPx - MIN_CONTENT_PX);
  if (baselinePx >= centred) {
    return { topPx: Math.min(2 * (baselinePx - centred), room), bottomPx: 0 };
  }
  const bottomPx = heightPx - 2 * (baselinePx - (band.ascentPx - band.descentPx) / 2);
  return { topPx: 0, bottomPx: Math.min(Math.max(bottomPx, 0), room) };
}

/** Οριζόντιες γεμίσεις = τα περιθώρια του κελιού, περιορισμένα ώστε να μείνει περιεχόμενο. */
function horizontalPadding(widthPx: number, marginPx: number): number {
  return Math.min(Math.max(marginPx, 0), Math.max(0, (widthPx - MIN_CONTENT_PX) / 2));
}

/**
 * Το πλήρες κουτί οθόνης ενός κελιού υπό επεξεργασία.
 *
 * @param pxPerMm px οθόνης ανά sheet-mm — **η ίδια** τιμή που δίνει ο `tablePxPerMm` στον
 *   ζωγράφο. Ζωντανή: ξαναϋπολογίζεται σε κάθε καρέ zoom, ώστε ο επεξεργαστής να ζουμάρει
 *   μαζί με τον καμβά (Excel/Figma), αντί να μένει σταθερός σε px οθόνης (AutoCAD
 *   `MTEXTFIXED`, που είναι η σωστή απάντηση για **ελεύθερο** κείμενο, όχι για κελί).
 * @param angleRad η γωνία του πίνακα στη σκηνή (αριστερόστροφα, y προς τα πάνω).
 * @param resolveBand ascent/descent **για το αλφαριθμητικό που θα ζωγραφιστεί**. Ένεση και
 *   όχι έτοιμη τιμή, ώστε η γραμματοσειρά να συντίθεται εδώ **μία** φορά και ο καλών να μην
 *   χρειάζεται να την ξαναχτίσει για να τη μετρήσει — δύο κατασκευές της ίδιας
 *   γραμματοσειράς είναι δύο ευκαιρίες να αποκλίνουν.
 * @param backgroundHex το φόντο του καμβά, για κελιά χωρίς γέμισμα.
 */
export function computeTableCellEditorFrame(params: {
  readonly target: TableCellEditTarget;
  readonly pxPerMm: number;
  readonly angleRad: number;
  readonly resolveBand: (font: string) => CellFontBandPx;
  readonly backgroundHex: string;
}): TableCellEditorFrame {
  const { target, pxPerMm, angleRad, resolveBand, backgroundHex } = params;
  const { rectMm, style } = target;

  const font = tableCellFont(style.textHeightMm * pxPerMm, style.bold);
  const widthPx = Math.max(rectMm.w * pxPerMm, MIN_CONTENT_PX);
  const heightPx = Math.max(rectMm.h * pxPerMm, MIN_CONTENT_PX);
  const vertical = verticalPadding(heightPx, target.baselineFromTopMm * pxPerMm, resolveBand(font));
  const sidePx = horizontalPadding(widthPx, style.margins.hMm * pxPerMm);

  return {
    widthPx,
    heightPx,
    rotationRad: -angleRad,
    font,
    paddingTopPx: vertical.topPx,
    paddingRightPx: sidePx,
    paddingBottomPx: vertical.bottomPx,
    paddingLeftPx: sidePx,
    lineHeightPx: Math.max(heightPx - vertical.topPx - vertical.bottomPx, MIN_CONTENT_PX),
    textAlign: target.hAlign,
    colorHex: style.textColorHex,
    backgroundHex: style.fillColorHex ?? backgroundHex,
  };
}

/**
 * Πού **ξεκινά** το κείμενο μέσα στο κουτί, σε px από την αριστερή ακμή του κελιού.
 *
 * Εξαρτάται από τη στοίχιση, γι' αυτό δεν είναι απλώς «το αριστερό περιθώριο»: σε
 * δεξιά/κεντρική στοίχιση η αρχή του κειμένου **μετακινείται** με το πλάτος του. Το
 * χρειάζεται μόνο ο υπολογισμός «σε ποιο γράμμα έγινε το κλικ» — και ταιριάζει ένα προς
 * ένα με το `anchorXMm` της διάταξης, από την άλλη μεριά της ίδιας εξίσωσης.
 */
export function cellTextStartPx(frame: TableCellEditorFrame, textWidthPx: number): number {
  if (frame.textAlign === 'right') return frame.widthPx - frame.paddingRightPx - textWidthPx;
  if (frame.textAlign === 'center') return (frame.widthPx - textWidthPx) / 2;
  return frame.paddingLeftPx;
}
