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

/**
 * Το x του σημείου αγκύρωσης, σύμφωνα με την οριζόντια στοίχιση, τα περιθώρια **και την εσοχή**.
 *
 * 🔴 ADR-739 §59 Δ2 — η εσοχή σπρώχνει **προς τα μέσα**, δηλαδή σε **αντίθετες** κατευθύνσεις
 * στα δύο άκρα: δεξιά στοίχιση με εσοχή απομακρύνεται από τη **δεξιά** ακμή. Ένα σκέτο `+`
 * και στις δύο περιπτώσεις θα έβγαζε το δεξιά στοιχισμένο κείμενο **έξω** από το κελί, και το
 * σύμπτωμα θα φαινόταν μόνο σε στήλες ποσών — δηλαδή σε κάθε πίνακα ποσοτήτων.
 *
 * Το κέντρο δεν δέχεται ποτέ εσοχή· ο κανόνας δεν γράφεται εδώ, τον έχει ήδη απαντήσει το
 * {@link tableIndentOffsetMm} επιστρέφοντας `0` (δες εκεί για το γιατί).
 */
export function anchorXMm(
  rect: TableRectMm,
  hAlign: TextAlign,
  marginHMm: number,
  indentMm: number,
): number {
  if (hAlign === 'left') return rect.x + marginHMm + indentMm;
  if (hAlign === 'right') return rect.x + rect.w - marginHMm - indentMm;
  return rect.x + rect.w / 2;
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
  const single = cellBaselineYMm(rect, align, style);
  if (lineCount <= 1) return single;

  const stepMm = style.textHeightMm * CHARACTER_METRICS.LINE_HEIGHT_RATIO;
  const { topAdd } = resolveMultilineExtents(
    VERTICAL_BAND_TO_ROW[verticalBand(align)],
    lineCount,
    CHARACTER_METRICS.LINE_HEIGHT_RATIO,
  );
  return single - topAdd * style.textHeightMm + index * stepMm;
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
export function fittingLineCount(rect: TableRectMm, style: TableCellStyle): number {
  const stepMm = style.textHeightMm * CHARACTER_METRICS.LINE_HEIGHT_RATIO;
  if (!(stepMm > 0)) return 1;
  const usableMm = rect.h - style.margins.vMm * 2 - style.textHeightMm;
  // 🔴 Η ανοχή ΔΕΝ είναι καλλωπισμός — είναι η προϋπόθεση ώστε μέτρηση και τοποθέτηση να
  // συμφωνούν. Η μέτρηση έφτιαξε τη γραμμή **ακριβώς** για `n` γραμμές, οπότε το πηλίκο εδώ
  // είναι θεωρητικά `n − 1`· σε IEEE-754 βγαίνει `n − 1 − ε` και το `floor` επιστρέφει
  // `n − 2`. Το σύμπτωμα ήταν ότι κελί με **αυτόματο** ύψος έχανε την τελευταία του γραμμή
  // και έβαζε «…» — δηλαδή περικοπή σε κελί που είχε φτιαχτεί για να μην περικόπτεται.
  const EPSILON = 1e-9;
  return Math.max(Math.floor(usableMm / stepMm + EPSILON) + 1, 1);
}
