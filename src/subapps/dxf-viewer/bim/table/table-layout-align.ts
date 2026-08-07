/**
 * ADR-739 Φάση Α — **στοίχιση**: πού πέφτει η άγκυρα του κειμένου μέσα σε ένα κελί.
 *
 * Η καθαρή γεωμετρία της 9-θέσης στοίχισης, χωρίς καμία γνώση του μοντέλου: παίρνει
 * ορθογώνιο + στοίχιση + στυλ και δίνει συντεταγμένες. Το `table-layout-place.ts` τη
 * χρησιμοποιεί για να τοποθετήσει κείμενο· ο in-cell επεξεργαστής για να **μη μετακινηθεί**
 * το κείμενο τη στιγμή που ανοίγει.
 *
 * ## Γιατί ξεχωριστό αρχείο (§58 Γ2, 2026-08-07)
 * Η αναδίπλωση έφερε δύο ακόμη συναρτήσεις στην ενότητα ({@link multilineBaselineYMm},
 * {@link fittingLineCount}) και το `table-layout-place.ts` πέρασε τις **500 γραμμές**
 * (N.7.1). **Εξαγωγή, όχι κόψιμο**: μεταφέρθηκε ολόκληρη η ενότητα «Στοίχιση» μαζί με την
 * τεκμηρίωσή της. Η τομή δεν είναι αυθαίρετη — εδώ ζει **μόνο** αριθμητική θέσης, ενώ το
 * `place` ξέρει από συγχωνεύσεις, τμήματα, συνδέσμους και διαγωνίους.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-align
 * @see bim/table/table-layout-place.ts — ο κύριος καταναλωτής
 * @see bim/text/text-lines.ts — το SSoT της κατανομής πολλαπλών γραμμών
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ScheduleColumnAlign } from '../schedule/types';
import type { TextAlign } from '../structural/detail-sheet/detail-sheet-types';
import type { TableCellAlign } from '../../types/table';
import { CHARACTER_METRICS } from '../../config/text-rendering-config';
import { resolveMultilineExtents, type TextRow } from '../text/text-lines';
import type { TableCellStyle, TableStyleOverrides } from './table-style';
import type { TableRectMm } from './table-layout-types';

/** Η οριζόντια συνιστώσα της 9-θέσης στοίχισης κελιού. */
export const H_BY_CELL_ALIGN: Readonly<Record<TableCellAlign, TextAlign>> = {
  TL: 'left', ML: 'left', BL: 'left',
  TC: 'center', MC: 'center', BC: 'center',
  TR: 'right', MR: 'right', BR: 'right',
};

/** Η οριζόντια στοίχιση όπως τη δηλώνει η **στήλη** (εκεί ζει και το `valueType`). */
export const H_BY_COLUMN_ALIGN: Readonly<Record<ScheduleColumnAlign, TextAlign>> = {
  left: 'left',
  center: 'center',
  right: 'right',
};

/**
 * 🔴 ADR-739 §59 Δ2 — **Η ΟΡΙΖΟΝΤΙΑ ΣΤΟΙΧΙΣΗ ΕΝΟΣ ΚΕΛΙΟΥ**, με τα τέσσερα επίπεδα σε ρητή σειρά.
 *
 * ```
 *   1. παράκαμψη κελιού    ┐
 *   2. παράκαμψη γραμμής   ├─ ρητές· 9 θέσεις, από τις οποίες κρατιέται η ΟΡΙΖΟΝΤΙΑ συνιστώσα
 *   3. παράκαμψη στήλης    ┘
 *   4. TableColumn.align   ← ΣΗΜΑΣΙΟΛΟΓΙΚΗ βάση (οι αριθμοί δεξιά επειδή είναι αριθμοί)
 * ```
 *
 * ## 🔴 Γιατί ΕΞΗΧΘΗ — και γιατί δεν αρκούσε το `cellStyle.align`
 * Μέχρι το §59 ο κανόνας ζούσε **inline** μέσα στο `placeCells`, σωστά όσο τον ρωτούσε **ένα**
 * σημείο. Η εσοχή τον έκανε ερώτηση και της **μέτρησης**: το `hug` πλάτος μιας στήλης οφείλει
 * να ξέρει αν η εσοχή ισχύει (δεν ισχύει σε κεντραρισμένο κελί, ECMA-376), δηλαδή οφείλει να
 * ξέρει τη στοίχιση **πριν** τρέξει η τοποθέτηση. Δεύτερη γραφή του κανόνα εκεί θα ήταν sibling
 * clone (N.18) — και, το σοβαρό, δύο απαντήσεις στο «πού κάθεται αυτό το κείμενο», που θα
 * απέκλιναν ακριβώς στο επίπεδο 4 (τη μόνη περίπτωση που κανείς δεν δοκιμάζει).
 *
 * ⚠️ **ΔΕΝ ισοδυναμεί με `H_BY_CELL_ALIGN[cellStyle.align]`**, και η διαφορά είναι ο λόγος που
 * το επίπεδο 4 υπάρχει: το επιλυμένο `cellStyle.align` πέφτει στην **κλάση γραμμής** όταν καμία
 * παράκαμψη δεν μιλά — δηλαδή θα έθαβε τη σημασιολογική `TableColumn.align` κάτω από το default
 * του στυλ. Γι' αυτό η συνάρτηση δέχεται τις **ωμές παρακάμψεις** και όχι το επιλυμένο στυλ.
 */
export function resolveCellHAlign(
  overrides: TableStyleOverrides,
  columnAlign: ScheduleColumnAlign,
): TextAlign {
  const explicit = overrides.cell?.align ?? overrides.row?.align ?? overrides.column?.align;
  return explicit ? H_BY_CELL_ALIGN[explicit] : H_BY_COLUMN_ALIGN[columnAlign];
}

/** Κατακόρυφη ζώνη της 9-θέσης στοίχισης. */
export function verticalBand(align: TableCellAlign): 'top' | 'middle' | 'bottom' {
  const first = align.charAt(0);
  if (first === 'T') return 'top';
  if (first === 'B') return 'bottom';
  return 'middle';
}

/** Το x του σημείου αγκύρωσης, σύμφωνα με την οριζόντια στοίχιση και τα περιθώρια. */
export function anchorXMm(rect: TableRectMm, hAlign: TextAlign, marginHMm: number): number {
  if (hAlign === 'left') return rect.x + marginHMm;
  if (hAlign === 'right') return rect.x + rect.w - marginHMm;
  return rect.x + rect.w / 2;
}

/**
 * 🔴 ADR-739 §59 Δ1+Δ2 — **Η ΤΕΛΙΚΗ ΘΕΣΗ μιας οπτικής γραμμής κειμένου**: στοίχιση, περιθώρια,
 * **εσοχή**, κατανομή πολλαπλών γραμμών **και στροφή**, σε μία έκφραση.
 *
 * ## Γιατί ΜΙΑ συνάρτηση και όχι τρεις προσθέσεις στον καλούντα
 * Οι τρεις μετατοπίσεις **δεν είναι ανεξάρτητες**: η εσοχή τρέχει κατά μήκος της γραμμής
 * βάσης, η απόσταση γραμμών **κάθετα** σε αυτήν, και η γραμμή βάσης είναι γερμένη. Ένας
 * καλών που τις πρόσθετε ξεχωριστά στο `x` και στο `y` θα άπλωνε τις γραμμές **οριζόντια** κάτω
 * από γερμένο κείμενο και θα έσπρωχνε την εσοχή **πλάγια** ως προς τα γράμματά της — το ίδιο
 * ακριβώς σχήμα ελαττώματος που η Φ.Ε έκλεισε για την υπογράμμιση (§28.10.3) και το ADR-753
 * για τα τμήματα (`offsetAnchor`).
 *
 * ```
 *   διεύθυνση γραμμής βάσης :  (  cosθ, −sinθ )      ← θ>0 γέρνει ΠΡΟΣ ΤΑ ΠΑΝΩ (y-κάτω πλαίσιο)
 *   κάθετη, «προς τα κάτω»  :  (  sinθ,  cosθ )
 *
 *   θέση = άγκυρα + εσοχή·(διεύθυνση) + απόστασηΓραμμής·(κάθετη)
 * ```
 *
 * 🔑 **Με `θ = 0` εκφυλίζεται σε `{ x + εσοχή, y + απόσταση }`** — δηλαδή **ακριβώς** στην
 * αριθμητική που είχε το `placeLine` πριν από αυτή τη φάση, και σε αυτήν που έχει το §58 για
 * πολλαπλές γραμμές. Κανένας κλάδος-εξαίρεση, καμία μετακίνηση σε κανέναν υπάρχοντα πίνακα.
 *
 * ⚠️ **Η εσοχή έχει ΠΡΟΣΗΜΟ, όχι μόνο μέτρο**: σπρώχνει **προς τα μέσα**, άρα σε δεξιά
 * στοίχιση κινείται **αντίθετα** στη γραμμή βάσης. Ένα σκέτο `+` και στις δύο περιπτώσεις
 * μεταγλωττίζεται μια χαρά και βγάζει το δεξιά στοιχισμένο κείμενο **έξω** από το κελί — ορατό
 * μόνο σε στήλες ποσών, δηλαδή σε κάθε πίνακα ποσοτήτων. Το κέντρο δεν παίρνει ποτέ εσοχή, και
 * ο κανόνας δεν ξαναγράφεται εδώ: το `tableIndentOffsetMm` επιστρέφει ήδη `0` εκεί.
 */
export function cellTextPositionMm(input: {
  readonly rect: TableRectMm;
  readonly hAlign: TextAlign;
  readonly align: TableCellAlign;
  /** Το **ζωγραφισμένο** στυλ (μετά τη σμίκρυνση) — η γραμμή βάσης ορίζεται ως προς αυτό. */
  readonly style: TableCellStyle;
  readonly indentMm: number;
  readonly rotationDeg: number;
  readonly lineCount: number;
  readonly index: number;
}): Point2D {
  const { rect, hAlign, align, style, indentMm, rotationDeg, lineCount, index } = input;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const along = hAlign === 'right' ? -indentMm : indentMm;
  const perp = multilineBaselineDeltaMm(align, style, lineCount, index);
  return {
    x: anchorXMm(rect, hAlign, style.margins.hMm) + along * cos + perp * sin,
    y: cellBaselineYMm(rect, align, style) - along * sin + perp * cos,
  };
}

/**
 * Το y της **γραμμής βάσης**.
 *
 * `top` δίνει `rect.y + margin + textHeight`, δηλαδή ακριβώς τη σύμβαση που ήδη
 * χρησιμοποιεί ο ADR-622 (`rowTop + TEXT_MM`) — το κείμενο κρέμεται από την κορυφή της
 * γραμμής. `middle` κεντράρει το κεφαλαίο γράμμα γύρω από τον άξονα του κελιού.
 *
 * 🔴 **Εξαγόμενη** (ADR-739 Φ.Δ βήμα 3): ο in-cell επεξεργαστής πρέπει να τοποθετήσει τη
 * γραμμή βάσης του `<input>` **ακριβώς** εκεί που τη ζωγραφίζει ο καμβάς. Μια δεύτερη
 * διατύπωση του κανόνα θα σήμαινε ότι το κείμενο **αναπηδά** τη στιγμή που μπαίνεις στο
 * κελί — δηλαδή το ίδιο ελάττωμα που λύνει το βήμα, σε πιο ύπουλη μορφή.
 */
export function cellBaselineYMm(
  rect: TableRectMm,
  align: TableCellAlign,
  style: TableCellStyle,
): number {
  const band = verticalBand(align);
  if (band === 'top') return rect.y + style.margins.vMm + style.textHeightMm;
  if (band === 'bottom') return rect.y + rect.h - style.margins.vMm;
  return rect.y + rect.h / 2 + style.textHeightMm / 2;
}

/**
 * 🔴 ADR-739 §58 Γ2 — η γραμμή βάσης της **i-οστής** οπτικής γραμμής ενός κελιού.
 *
 * Με `lineCount === 1` επιστρέφει **ακριβώς** το {@link cellBaselineYMm}: το `topAdd` είναι
 * μηδέν και το `index` επίσης, οπότε δεν υπάρχει κλάδος-εξαίρεση για τη συνηθισμένη
 * περίπτωση — κάθε πίνακας που υπάρχει σήμερα περνά από τον **ίδιο** τύπο και βγάζει την
 * ίδια θέση.
 *
 * Το `resolveMultilineExtents` είναι το SSoT της κατανομής (AutoCAD/Revit: **T** μεγαλώνει
 * κάτω, **B** πάνω, **M** συμμετρικά) και το `LINE_HEIGHT_RATIO` το SSoT του βήματος
 * (DXF MTEXT κωδ. 44, «3-on-5» = 5/3). Κανένα από τα δύο δεν ξαναγράφεται εδώ.
 */
export function multilineBaselineYMm(
  rect: TableRectMm,
  align: TableCellAlign,
  style: TableCellStyle,
  lineCount: number,
  index: number,
): number {
  return cellBaselineYMm(rect, align, style)
    + multilineBaselineDeltaMm(align, style, lineCount, index);
}

/**
 * 🔴 ADR-739 §59 Δ1 — η **απόσταση** της i-οστής γραμμής από τη γραμμή βάσης της μονής, σε mm
 * **κάθετα στη γραμμή βάσης**. Μηδέν για μονογραμμικό κελί.
 *
 * ## Γιατί εξήχθη από το {@link multilineBaselineYMm}
 * Μέχρι το §59 η κατανομή ήταν πάντα κατακόρυφη, οπότε «απόσταση» και «y» ήταν το ίδιο νούμερο.
 * Με στροφή δεν είναι: η απόσταση πρέπει να **περιστραφεί** πριν προστεθεί, αλλιώς οι γραμμές
 * ενός γερμένου κελιού απλώνονται κατακόρυφα ενώ τα γράμματά τους τρέχουν πλάγια — και το
 * αποτέλεσμα δεν είναι «λίγο λάθος», είναι γραμμές που **τέμνονται μεταξύ τους**.
 *
 * Εξαγωγή, όχι διπλότυπο: το {@link multilineBaselineYMm} μένει και **την καλεί**, ώστε ο
 * κατακόρυφος δρόμος (in-cell επεξεργαστής) να μην αποκτήσει δεύτερη διατύπωση του κανόνα.
 */
export function multilineBaselineDeltaMm(
  align: TableCellAlign,
  style: TableCellStyle,
  lineCount: number,
  index: number,
): number {
  if (lineCount <= 1) return 0;

  const stepMm = style.textHeightMm * CHARACTER_METRICS.LINE_HEIGHT_RATIO;
  const { topAdd } = resolveMultilineExtents(
    VERTICAL_BAND_TO_ROW[verticalBand(align)],
    lineCount,
    CHARACTER_METRICS.LINE_HEIGHT_RATIO,
  );
  return index * stepMm - topAdd * style.textHeightMm;
}

/**
 * Η ζώνη της 9-θέσης στοίχισης στο λεξιλόγιο του `text-lines.ts`.
 *
 * Δύο ονόματα για την ίδια τριάδα υπάρχουν ήδη στο έργο (`'top'|'middle'|'bottom'` εδώ,
 * `'T'|'M'|'B'` στο MTEXT). Ο χάρτης είναι **ρητός** αντί για `charAt(0).toUpperCase()`: μια
 * σιωπηρή μετατροπή θα έδινε `'T'` και για τα δύο αν κάποιος μετονόμαζε τη ζώνη σε `'tall'`,
 * και το σύμπτωμα θα ήταν κείμενο στοιχισμένο πάνω σε κελί που ζητούσε κάτω.
 */
const VERTICAL_BAND_TO_ROW: Readonly<Record<'top' | 'middle' | 'bottom', TextRow>> = {
  top: 'T',
  middle: 'M',
  bottom: 'B',
};

/**
 * 🔴 ADR-739 §58 Γ2 — πόσες οπτικές γραμμές **χωρούν** στο ορθογώνιο του κελιού.
 *
 * Αντιστροφή του `wrappedCellHeightMm` της μέτρησης, με τον **ίδιο** τύπο διαβασμένο
 * ανάποδα — άρα σε γραμμή με **αυτόματο** ύψος το αποτέλεσμα είναι ακριβώς όσες γραμμές
 * ζήτησε το περιεχόμενο, και το φράγμα δεν κόβει τίποτα. Δεσμεύει μόνο όταν ο χρήστης έχει
 * **καρφώσει** ύψος μικρότερο απ' όσο χρειάζεται το κείμενο.
 *
 * Ποτέ κάτω από `1`: ένα κελί που δεν χωρά ούτε μία γραμμή πρέπει να δείξει **κάτι**
 * (περικομμένο, με «…»), όχι να αδειάσει σιωπηλά.
 */
export function fittingLineCount(
  rect: TableRectMm,
  style: TableCellStyle,
  /**
   * 🔴 §59 Δ1 — η γωνία του κειμένου. Το «πάχος» του μπλοκ μεγαλώνει **κάθετα στη γραμμή
   * βάσης**, άρα σε γερμένο κελί δεν το περιορίζει (μόνο) το ύψος.
   *
   * ```
   *     0°  →  διαθέσιμο πάχος = ωφέλιμο ΥΨΟΣ    (ακριβές· η σημερινή έκφραση)
   *   ±90°  →  διαθέσιμο πάχος = ωφέλιμο ΠΛΑΤΟΣ  (ακριβές)
   *   αλλού →  η προβολή του ορθογωνίου στον άξονα του πάχους — **άνω φράγμα**
   * ```
   * Στις ενδιάμεσες γωνίες η προβολή είναι **γενναιόδωρη**, και αυτή είναι η σωστή φορά
   * σφάλματος: το `maxLines` είναι **φράγμα περικοπής**, οπότε το να είναι χαλαρό σημαίνει «μην
   * κόψεις κείμενο που ίσως χωρά» — και η πραγματική περικοπή παραμένει ορατή μέσω του
   * `clipped`. Ένα σφιχτό φράγμα θα έσβηνε γραμμές που ζωγραφίζονται μια χαρά.
   */
  rotationDeg = 0,
): number {
  const stepMm = style.textHeightMm * CHARACTER_METRICS.LINE_HEIGHT_RATIO;
  if (!(stepMm > 0)) return 1;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const extentMm = (rect.h - style.margins.vMm * 2) * cos + (rect.w - style.margins.hMm * 2) * sin;
  const usableMm = extentMm - style.textHeightMm;
  // 🔴 Η ανοχή ΔΕΝ είναι καλλωπισμός — είναι η προϋπόθεση ώστε μέτρηση και τοποθέτηση να
  // συμφωνούν. Η μέτρηση έφτιαξε τη γραμμή **ακριβώς** για `n` γραμμές, οπότε το πηλίκο εδώ
  // είναι θεωρητικά `n − 1`· σε IEEE-754 βγαίνει `n − 1 − ε` και το `floor` επιστρέφει
  // `n − 2`. Το σύμπτωμα ήταν ότι κελί με **αυτόματο** ύψος έχανε την τελευταία του γραμμή
  // και έβαζε «…» — δηλαδή περικοπή σε κελί που είχε φτιαχτεί για να μην περικόπτεται.
  const EPSILON = 1e-9;
  return Math.max(Math.floor(usableMm / stepMm + EPSILON) + 1, 1);
}
