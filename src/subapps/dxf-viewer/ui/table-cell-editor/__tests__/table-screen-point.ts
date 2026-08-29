/**
 * ADR-739 Φ.Δ βήμα 9 — **Η ΜΙΑ προβολή «σημείο του πίνακα → pixel οθόνης» των tests.**
 *
 * ## Γιατί υπάρχει (SSoT audit 2026-08-02, N.18)
 * Η αλυσίδα `πλαίσιο → κόσμος → οθόνη` ήταν γραμμένη **τρεις** φορές μέσα στα ίδια δύο
 * αρχεία tests, με τρία διαφορετικά ονόματα:
 *
 *   - `bandScreenPoint`        (`table-header-menu.test.tsx`)      — ζώνη, δύο άξονες
 *   - `columnBandScreenPoint`  (`table-cell-pointer-session-survival.test.tsx`) — ζώνη στήλης
 *   - `cellScreenPoint`        (ίδιο αρχείο) + ένα **inline** αντίγραφο για κελί
 *
 * Το CHECK 3.28 (jscpd) τα χαρακτηρίζει sibling clones **ανεξάρτητα ονόματος**, και σωστά:
 * είναι τρεις ευκαιρίες να ξεχάσει κάποιος ότι ο πίνακας **περιστρέφεται**. Ακριβώς αυτό
 * είχε συμβεί — και τα τρία αντίγραφα καλούνταν μόνο με `angleRad = 0`, οπότε η γωνιακή
 * διαδρομή έμενε **ανέλεγκτη**: ένα λάθος πρόσημο στο `tableWorldToFrame` είναι αόρατο σε
 * `cos 0 = 1, sin 0 = 0` και σφάλλει **γραμμικά με τη γωνία**.
 *
 * 🔴 **ADR-828 Φ4α (2026-08-29) — η αλυσίδα ΔΕΝ ζει πια εδώ.** Μετακόμισε σε παραγωγή,
 * `bim/table/table-frame-screen.ts`, μόλις απέκτησε καταναλωτή **εκτός test**: το `Alt+↓` του
 * κουμπιού συμπλήρωσης οφείλει να ανοίξει το μενού **στη θέση του κουμπιού**, και ένα τέταρτο
 * αντίγραφο θα ήταν ακριβώς το σφάλμα που αυτή η κεφαλίδα περιγράφει. Ό,τι ακολουθεί είναι
 * **καταναλωτές** εκείνης της μίας μηχανής.
 *
 * ## Ένα πρωτόγονο, δύο ερωτήσεις από πάνω του
 * Το {@link tableFrameScreenPoint} είναι η **μόνη** αλυσίδα· το κελί και η ζώνη διαφέρουν
 * μόνο στο **ποιο** `(u, v)` ρωτούν. Η περιστροφή μπαίνει από το `tableFrameToWorld`, το
 * ΙΔΙΟ SSoT που τρέφει τον ζωγράφο και τις λαβές — άρα ένα test δεν μπορεί να «συμφωνήσει»
 * με τον εαυτό του πάνω σε λάθος γεωμετρία.
 *
 * ⚠️ **Δεν είναι σουίτα**: το `testMatch` του `jest.config.js` απαιτεί κατάληξη
 * `.test.ts(x)` μέσα στο `__tests__`, οπότε ένας βοηθός χωρίς αυτήν δεν εκτελείται ποτέ ως
 * suite — ίδιο μοτίβο με το `rendering/entities/table/__tests__/table-paint-recorder.ts`.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/__tests__/table-screen-point
 * @see bim/table/table-entity-geometry.ts — `tableFrameToWorld` (η μία περιστροφή)
 * @see bim/table/table-indicator-geometry.ts — ΠΟΥ κάθεται η ζώνη (κοινό με ζωγράφο + κλικ)
 */

// 🔴 ADR-828 Φ4α — η αλυσίδα **δεν ζει πια εδώ**: μετακόμισε σε παραγωγή
// (`bim/table/table-frame-screen.ts`) τη στιγμή που την απέκτησε δεύτερος, πραγματικός
// καταναλωτής — η διαδρομή πληκτρολογίου του κουμπιού συμπλήρωσης. Αυτό το αρχείο είναι πλέον
// **καταναλωτής**, όχι ιδιοκτήτης· δες την κεφαλίδα εκείνου του module για το γιατί ένα test
// που προβάλλει με δική του μηχανή μπορεί να συμφωνήσει με τον εαυτό του πάνω σε λάθος
// γεωμετρία.
import { tableFrameScreenPoint as projectTableFramePoint } from '../../../bim/table/table-frame-screen';
import {
  computeTableEntityGeometryLive,
  tablePxPerMm,
} from '../../../bim/table/table-entity-geometry';
import {
  tableColumnTickRectMm,
  tableIndicatorBandsMm,
  tableIndicatorCornerRectMm,
  tableRowTickRectMm,
} from '../../../bim/table/table-indicator-geometry';
import { tableColumnTicks, tableRowTicks } from '../../../bim/table/table-cell-reference';
// 🔴 §40 — τα ΙΔΙΑ SSoT που ρωτά ο ζωγράφος και το hit-test του ⊕.
import {
  TABLE_INSERT_CONTROL_RADIUS_PX,
  tableInsertControlOuterPx,
  type TableInsertControlMode,
} from '../../../bim/table/table-insert-control';
import {
  tableAxisBoundaryMm,
  tableColumnBoundaryView,
  tableRowBoundaryView,
} from '../../../bim/table/table-axis-boundary';
// 🔴 ADR-754 §14 — το ΙΔΙΟ τετράγωνο που ζωγραφίζεται και που ρωτούν ο δείκτης και το πάτημα.
import { tableFillHandleRectMm } from '../../../bim/table/table-fill-handle';
// 🔴 ADR-828 Φ4α — το ΙΔΙΟ τετράγωνο του κουμπιού που ζωγραφίζεται και που πιάνεται.
import { tableFillBadgeRectMm } from '../../../bim/table/table-fill-badge';
// 🔴 ADR-739 §36 — το ΙΔΙΟ ορθογώνιο περιοχής που ζωγραφίζεται και που πιάνεται.
import { tableRangeRectMm, type TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { TableRectMm } from '../../../bim/table/table-layout-types';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';

/** Καμία ενεργή υποδιαίρεση: το «πού είναι» δεν εξαρτάται από το «τι είναι μαρκαρισμένο». */
const NO_ACTIVE = new Set<never>();

/** Το κέντρο ενός ορθογωνίου πλαισίου — η **μία** έκφραση, όπως και στο δίχτυ γεωμετρίας. */
function rectCenterMm(rect: TableRectMm): { readonly u: number; readonly v: number } {
  return { u: rect.x + rect.w / 2, v: rect.y + rect.h / 2 };
}

/** Ο μετασχηματισμός + το παράθυρο με τα οποία προβάλλεται το σημείο. */
export interface TableTestView {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/**
 * Η προεπιλεγμένη προβολή των table tests: 1:1, χωρίς μετατόπιση, σε παράθυρο 1200×800.
 *
 * Είναι **προεπιλογή, όχι σταθερά του συστήματος** — ένα test που θέλει άλλο zoom περνά
 * δικό του `view`. Ο λόγος που υπάρχει είναι ότι τα υπάρχοντα call-sites τη χρησιμοποιούν
 * όλα, και τρία ταυτόσημα ζεύγη `VIEWPORT`/`TRANSFORM` είναι το ίδιο πρόβλημα σε μικρότερη
 * κλίμακα.
 */
export const TABLE_TEST_VIEW: TableTestView = {
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
  viewport: { width: 1200, height: 800 },
};

/**
 * 🔴 **Η ΜΙΑ αλυσίδα**: σημείο πλαισίου `(u, v)` σε sheet-mm → μονάδες σκηνής → pixel.
 *
 * Το `tableFrameToWorld` κατέχει **και** την αναστροφή του y **και** την περιστροφή γύρω
 * από την άγκυρα, οπότε ένας στραμμένος πίνακας δεν χρειάζεται τίποτα επιπλέον εδώ. Αυτό
 * είναι και το νόημα: το test προβάλλει με τον **ίδιο** τρόπο που ζωγραφίζει η εφαρμογή,
 * και μετά ζητά από το hit-test να κάνει τον δρόμο ανάποδα.
 */
export function tableFrameScreenPoint(
  entity: TableEntity,
  u: number,
  v: number,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const { mmToWorld } = computeTableEntityGeometryLive(entity);
  return projectTableFramePoint(entity, u, v, mmToWorld, view.transform, view.viewport);
}

/** Το σημείο οθόνης στο **κέντρο ενός κελιού** (δείκτες γραμμής/στήλης του μοντέλου). */
export function tableCellScreenPoint(
  entity: TableEntity,
  rowIndex: number,
  colIndex: number,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const { layout } = computeTableEntityGeometryLive(entity);
  const rowId = entity.model.rows[rowIndex].id;
  const colId = entity.model.columns[colIndex].id;
  const cell = layout.cells.find((c) => c.rowId === rowId && c.colId === colId);
  if (!cell) throw new Error(`Το κελί ${rowIndex}/${colIndex} δεν υπάρχει στη διάταξη`);
  return tableFrameScreenPoint(
    entity,
    cell.rect.x + cell.rect.w / 2,
    cell.rect.y + cell.rect.h / 2,
    view,
  );
}

/**
 * Το σημείο οθόνης στο **κέντρο της ζώνης δείκτη** — το γράμμα `B` ή ο αριθμός `3`.
 *
 * Οι ζώνες ζουν σε **αρνητικές** συντεταγμένες πλαισίου (πάνω/αριστερά από το πλέγμα) και
 * το πάχος τους είναι σε **px οθόνης**, όχι mm χαρτιού — γι' αυτό περνά από το
 * `tableIndicatorBandsMm`, το ίδιο SSoT που καταναλώνουν ο ζωγράφος και το κλικ.
 *
 * ## 🔴 ADR-739 §27.11 — γιατί ζητά το **ορθογώνιο** και δεν το ξαναφτιάχνει
 * Η πρώτη γραφή αυτού του βοηθού υπολόγιζε μόνη της το κέντρο ως `-columnBandMm / 2`. Ήταν
 * σωστό όσο η ζώνη ακουμπούσε το πλέγμα — και **έσπασε την ίδια μέρα** που η ζώνη απέκτησε
 * κενό ώστε να μην ακουμπά τις λαβές: το «μέσο της ζώνης» έδειχνε πλέον **μέσα στο κενό**,
 * και 18 tests έγιναν κόκκινα σε ένα αρχείο που δεν είχε αλλάξει. Δηλαδή ακριβώς το σφάλμα
 * που περιγράφει η κεφαλίδα του — τέταρτο αντίγραφο της ίδιας αριθμητικής, με άλλο όνομα.
 *
 * Τώρα ρωτά το `tableColumnTickRectMm` / `tableRowTickRectMm`: **το κουτί που ζωγραφίζεται**.
 * Ό,τι κι αν αποφασιστεί αύριο για τη θέση της ζώνης, ο βοηθός το μαθαίνει δωρεάν.
 */
export function tableBandScreenPoint(
  entity: TableEntity,
  axis: 'column' | 'row',
  index: number,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const geometry = computeTableEntityGeometryLive(entity);
  const bands = tableIndicatorBandsMm(tablePxPerMm(geometry.mmToWorld, view.transform.scale));
  const { columns, rows } = geometry.layout;

  const rect = axis === 'column'
    ? tableColumnTickRectMm(tableColumnTicks(columns, NO_ACTIVE)[index], bands)
    : tableRowTickRectMm(tableRowTicks(rows, NO_ACTIVE, 0, rows.length)[index], bands);

  const { u, v } = rectCenterMm(rect);
  return tableFrameScreenPoint(entity, u, v, view);
}

/**
 * 🔴 ADR-739 §40 — το σημείο οθόνης **πάνω στον δίσκο** του ⊕ ενός συνόρου, δηλαδή εκεί όπου
 * το χειριστήριο είναι **οπλισμένο** και το πάτημα δρα.
 *
 * ## Γιατί ζει εδώ και όχι στο test που το χρειάστηκε πρώτο
 * Ίδιο επιχείρημα με ολόκληρο το module (δες την κεφαλίδα): είναι τέταρτη έκφραση της
 * αλυσίδας `πλαίσιο → κόσμος → οθόνη`, και μάλιστα η πιο εύθραυστη — η θέση του ⊕ **εξαρτάται
 * από την κατάσταση** (§40: σε λειτουργία πίνακα βγαίνει έξω από τη ζώνη γραμμάτων). Ένα
 * αντίγραφο σε αρχείο test θα ήταν το δεύτερο σημείο που πρέπει να θυμηθεί κάποιος όταν
 * παχύνει η ζώνη — ακριβώς το ελάττωμα του §27.13, τρίτη φορά.
 *
 * Και τα δύο σκέλη ρωτούν **τα ίδια** SSoT με την παραγωγή: το `tableInsertControlOuterPx`
 * για το «πόσο έξω» και το `tableAxisBoundaryMm` για το «ποιο σύνορο» — άρα ένα test δεν
 * μπορεί να στοχεύσει σημείο που ο ζωγράφος δεν βάφει.
 */
export function tableInsertControlScreenPoint(
  entity: TableEntity,
  axis: 'column' | 'row',
  line: number,
  mode: TableInsertControlMode = 'table-mode',
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const geometry = computeTableEntityGeometryLive(entity);
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, view.transform.scale);
  const outer = tableInsertControlOuterPx(mode);
  // Το **κέντρο** του δίσκου: το `outer` μετρά ως την εξωτερική ακμή του, άρα μία ακτίνα πίσω.
  // Οι ζώνες ζουν σε αρνητικά mm (πάνω/αριστερά από το πλέγμα), όπως και στο `tableBandScreenPoint`.
  const acrossMm = -(outer[axis === 'column' ? 'top' : 'left'] - TABLE_INSERT_CONTROL_RADIUS_PX)
    / pxPerMm;
  const boundaryView = axis === 'column'
    ? tableColumnBoundaryView(geometry.layout)
    : tableRowBoundaryView(geometry.layout);
  const alongMm = tableAxisBoundaryMm(boundaryView, line);

  return axis === 'column'
    ? tableFrameScreenPoint(entity, alongMm, acrossMm, view)
    : tableFrameScreenPoint(entity, acrossMm, alongMm, view);
}

/**
 * Το κέντρο του τετραγώνου πάνω-αριστερά, εκεί που ενώνονται οι δύο ζώνες.
 *
 * 🔴 **ADR-739 §43 — ΕΔΩ ΕΓΡΑΦΕ «σκόπιμα νεκρή γωνία».** Δεν είναι πια: είναι το κουμπί
 * «επιλογή όλων» του Excel. Το `tableIndicatorHitAtFrame` εξακολουθεί να επιστρέφει `null`
 * εδώ — αλλά για λόγο **τύπου** (η γωνία δεν είναι υποδιαίρεση άξονα), όχι επειδή λείπει η
 * εντολή· την απαντά το `isTableSelectAllCornerAtFrame`. Ισχύει **σε στραμμένο** πίνακα εξίσου.
 */
/**
 * 🔴 ADR-754 §14 — το σημείο οθόνης **πάνω στη λαβή συμπλήρωσης** μιας περιοχής: η κάτω-δεξιά
 * κορυφή της, όπου κάθεται κεντραρισμένο το τετραγωνάκι.
 *
 * ## Γιατί ρωτά το `tableFillHandleRectMm` και δεν υπολογίζει «κάτω-δεξιά γωνία»
 * Ίδιο επιχείρημα με το {@link tableBandScreenPoint}, όπου η ίδια συντόμευση **έσπασε 18 tests
 * σε αρχείο που δεν είχε αλλάξει** μόλις η ζώνη απέκτησε κενό. Η λαβή είναι **κεντραρισμένη**
 * στην κορυφή (μισή μέσα, μισή έξω) και η ζώνη σύλληψής της είναι **ασύμμετρη** (§13.8: μηδέν
 * προς τα μέσα, 4 px προς τα έξω). Ένα `rect.x + rect.w` εδώ θα ήταν δεύτερη απάντηση στο «πού
 * κάθεται η λαβή» — και θα σημάδευε στο **χείλος** της ζώνης, όπου η στρογγυλοποίηση αποφασίζει
 * αντί για τη λογική.
 *
 * Το **κέντρο** του ζωγραφισμένου τετραγώνου είναι το μόνο σημείο που είναι εγγυημένα μέσα και
 * στις δύο διατυπώσεις, όσο κι αν αλλάξει η οπή.
 */
export function tableFillHandleScreenPoint(
  entity: TableEntity,
  bounds: TableCellRangeBounds,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const geometry = computeTableEntityGeometryLive(entity);
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, view.transform.scale);
  const rect = tableFillHandleRectMm(geometry.layout, bounds, pxPerMm);
  if (!rect) throw new Error('Η περιοχή δεν τέμνει τη διάταξη — δεν υπάρχει λαβή να σημαδευτεί');
  const { u, v } = rectCenterMm(rect);
  return tableFrameScreenPoint(entity, u, v, view);
}

/**
 * 🔴 ADR-828 Φ4α — το σημείο οθόνης στο **κέντρο του κουμπιού «Επιλογές Αυτόματης
 * Συμπλήρωσης»**, κάτω από τη γεμισμένη περιοχή.
 *
 * Ρωτά το `tableFillBadgeRectMm` — **το ίδιο** τετράγωνο που ζωγραφίζεται και που πιάνουν ο
 * δείκτης, το πάτημα και το `Alt+↓`. Ίδιο επιχείρημα με τους τέσσερις βοηθούς από πάνω, και
 * εδώ έχει επιπλέον δόντια: το κουμπί ζει **λίγα pixel** κάτω από τη λαβή, οπότε μια δεύτερη
 * αριθμητική («η γωνία, συν κάτι») θα σημάδευε πότε το ένα και πότε το άλλο ανάλογα με το
 * ζουμ — δηλαδή θα έδινε test που περνά για λάθος λόγο.
 */
export function tableFillBadgeScreenPoint(
  entity: TableEntity,
  filled: TableCellRangeBounds,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const geometry = computeTableEntityGeometryLive(entity);
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, view.transform.scale);
  const rect = tableFillBadgeRectMm(geometry.layout, filled, pxPerMm);
  if (!rect) throw new Error('Η γεμισμένη περιοχή δεν τέμνει τη διάταξη — δεν υπάρχει κουμπί');
  const { u, v } = rectCenterMm(rect);
  return tableFrameScreenPoint(entity, u, v, view);
}

/**
 * 🔴 ADR-739 §36 — το σημείο οθόνης **πάνω στο περίγραμμα** μιας περιοχής (ή ενός κελιού): το
 * **μέσο** της κάτω πλευράς της, ακριβώς πάνω στη γραμμή.
 *
 * ## Γιατί το ΜΕΣΟ της κάτω πλευράς, και όχι μια γωνία
 * Τρεις ανεξάρτητοι λόγοι, και ο καθένας μόνος του θα αρκούσε:
 *  - η **κάτω-δεξιά** γωνία ανήκει στη λαβή συμπλήρωσης (ADR-754 §14.4, η λαβή νικά)·
 *  - η **αριστερή** λωρίδα πλάτους ~`gapMm` ανήκει στη λαβή ύψους γραμμής (`row-resize`,
 *    §31.9) — μετρημένο: σάρωση της κάτω πλευράς δίνει `row-resize` στα πρώτα ~9 px·
 *  - το μέσο είναι το μόνο σημείο που μένει «περίγραμμα» σε **κάθε** κλίμακα, όση κι αν
 *    γίνει η οπή.
 *
 * Ρωτά το `tableRangeRectMm` — **το ίδιο** ορθογώνιο που ζωγραφίζεται και που ρωτούν ο δείκτης
 * και το πάτημα. Ίδιο επιχείρημα με τους τρεις βοηθούς από πάνω: μια δεύτερη αριθμητική εδώ θα
 * σήμαινε test που συμφωνεί με τον εαυτό του πάνω σε λάθος γεωμετρία.
 */
export function tableRangeBorderScreenPoint(
  entity: TableEntity,
  bounds: TableCellRangeBounds,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const { layout } = computeTableEntityGeometryLive(entity);
  const rect = tableRangeRectMm(layout, bounds);
  if (!rect) throw new Error('Η περιοχή δεν τέμνει τη διάταξη — δεν υπάρχει περίγραμμα');
  return tableFrameScreenPoint(entity, rect.x + rect.w / 2, rect.y + rect.h, view);
}

export function tableIndicatorCornerScreenPoint(
  entity: TableEntity,
  view: TableTestView = TABLE_TEST_VIEW,
): Point2D {
  const geometry = computeTableEntityGeometryLive(entity);
  const bands = tableIndicatorBandsMm(tablePxPerMm(geometry.mmToWorld, view.transform.scale));
  // Ίδιος κανόνας με το `tableBandScreenPoint`: το ΖΩΓΡΑΦΙΣΜΕΝΟ κουτί, όχι δεύτερη αριθμητική.
  const { u, v } = rectCenterMm(tableIndicatorCornerRectMm(bands));
  return tableFrameScreenPoint(entity, u, v, view);
}
