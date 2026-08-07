/**
 * ADR-650 M7 — τα ΔΕΔΟΜΕΝΑ των παραδοτέων: σημεία / οικόπεδο / όγκοι / ανοχές ως πίνακες.
 *
 * Παράγουν {@link ExportableTable} — το ίδιο σχήμα που ήδη καταναλώνουν οι τρεις exporters
 * (CSV / xlsx / PDF) του `bim/schedule`. Έτσι ο «φάκελος» ΔΕΝ αποκτά δεύτερη μηχανή πινάκων:
 * ένα σχήμα, δύο παραγωγοί (BIM schedules + τοπογραφικά παραδοτέα), τρεις καταναλωτές.
 *
 * ΜΟΝΑΔΕΣ: όλα τα raw μεγέθη μπαίνουν στα cells σε **canonical mm / mm² / mm³** (ADR-462) και ο
 * `valueType` της στήλης κάνει τη μετατροπή στην παρουσίαση (`dimension-mm-to-m` → 3 δεκαδικά,
 * `area-m2`, `volume-m3`). Δηλαδή η μετατροπή γίνεται ΜΙΑ φορά, στο άκρο — ποτέ inline εδώ.
 * Εξαίρεση: ο πίνακας ανοχών, όπου οι τιμές έχουν ήδη κριθεί σε μονάδες παρουσίασης (m²/m) από
 * τον νομικό κανόνα — εκεί ο `valueType` είναι `number`/`area-m2` πάνω σε ήδη-μετρικές τιμές.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type {
  ExportableTable,
  ExportableTableRow,
  ScheduleColumnDef,
} from '../../../bim/schedule/types';
import type { TableColumnWriteBack } from '../../../bim/table/write-back/table-write-back-plan';
import { areaMm2ToM2, lengthMmToM, volumeMm3ToM3 } from '../../../utils/scene-units';
import { polygonArea, polygonPerimeter } from '../../../bim/geometry/shared/polygon-utils';
import type { TinSampler } from '../tin-sampler';
import type { CutFillResult, TopoPoint } from '../topo-types';
import type { ToleranceCheck } from './greek-survey-rules';

const KEY = 'topography.deliverables.col';

/**
 * ⚠️ **Γενικό στο `K` επίτηδες** (ADR-769 Δ2): κρατά το κλειδί ως **κυριολεκτικό τύπο**, ώστε
 * το σύνολο των στηλών ενός πίνακα να **παράγεται** από τον ίδιο τον πίνακα
 * (`(typeof COORDINATE_COLUMNS)[number]['key']`) αντί να ξαναγραφτεί με το χέρι. Δεύτερη
 * χειρόγραφη λίστα θα απέκλινε σιωπηλά — το repo το πλήρωσε τέσσερις φορές (CHECK 3.34/3.37).
 * Για τους υπόλοιπους καλούντες η αλλαγή είναι διαφανής (στενότερος τύπος, ίδια τιμή).
 */
function col<K extends string>(
  key: K,
  valueType: ScheduleColumnDef['valueType'],
  align: ScheduleColumnDef['align'],
): ScheduleColumnDef & { readonly key: K } {
  return { key, i18nKey: `${KEY}.${key}`, valueType, align };
}

// ─── Πίνακας συντεταγμένων ΕΓΣΑ'87 ────────────────────────────────────────────

/**
 * Α/Α · Χ · Υ · Ζ · Κωδικός — όλα τα σημεία της αποτύπωσης.
 *
 * Τα X/Y/Z είναι **ήδη** ΕΓΣΑ'87 (EPSG:2100): το σύστημα εισάγει τα σημεία σε world mm στο
 * native τους σύστημα και δεν αλλάζει προβολή πουθενά. Άρα ο πίνακας είναι μια αλλαγή ΜΟΝΑΔΑΣ
 * (mm → m), όχι μετασχηματισμός συντεταγμένων — γι' αυτό το M7 ΔΕΝ χρειάστηκε proj4 (§10, N.5).
 */
export const COORDINATE_COLUMNS = [
  col('index', 'count', 'right'),
  col('x', 'dimension-mm-to-m', 'right'),
  col('y', 'dimension-mm-to-m', 'right'),
  col('z', 'dimension-mm-to-m', 'right'),
  col('code', 'text', 'left'),
] as const satisfies readonly ScheduleColumnDef[];

/** Τα κλειδιά του πίνακα συντεταγμένων — **παράγονται** από τον πίνακα, ποτέ ξαναγραμμένα. */
export type CoordinateColumnKey = (typeof COORDINATE_COLUMNS)[number]['key'];

/**
 * 🔴 **ADR-769 Δ2 — η ΑΝΤΙΣΤΡΟΦΗ κατεύθυνση: ποιο κελί γράφει σε ποια ιδιότητα.**
 *
 * ## Γιατί ζει ΕΔΩ, τρεις γραμμές κάτω από τον εμπρός χάρτη
 * Ο {@link buildCoordinateTable} είναι **αυθαίρετος κώδικας** — αναμειγνύει άμεσες παραμέτρους
 * (`x: p.x`) με παράγωγα (`index: i + 1`). Η αντιστροφή **δεν εξάγεται αυτόματα**, πρέπει να
 * δηλωθεί· και αν δηλωνόταν σε άλλο αρχείο, οι δύο κατευθύνσεις θα ήταν **δύο χειρόγραφες
 * λίστες που αποκλίνουν σιωπηλά**. Δίπλα-δίπλα, ο ίδιος αναγνώστης τις βλέπει και τις δύο.
 *
 * ## 🔑 Ο τύπος ΑΠΑΙΤΕΙ απάντηση για κάθε στήλη
 * `Record<CoordinateColumnKey, …>` με το κλειδί **παραγόμενο** από τον πίνακα: νέα στήλη χωρίς
 * απόφαση γραψιμότητας **δεν μεταγλωττίζεται**. Άγκυρα και σε χρόνο εκτέλεσης (ο πράκτορας δεν
 * τρέχει `tsc` — N.17), στο `survey-coordinate-write-back.test.ts`.
 *
 * ## Οι αποφάσεις, μία-μία
 * | στήλη | | γιατί |
 * |---|---|---|
 * | `index` | `unwritable: ordinal` | αύξων αριθμός γραμμής. Revit: *«calculated values… are not parameters, only values»* ⇒ **ποτέ** |
 * | `x`·`y` | **γράψιμες** | ο ιδιοκτήτης υπάρχει: `MoveTopoSurveyPointCommand` (ADR-662 §13), undoable, με cascade |
 * | `z` | `unwritable: no-owner` | ⚠️ **ΟΧΙ παράγωγο — παράμετρος χωρίς ιδιοκτήτη.** Γραφή υψομέτρου είναι **δήλωση μέτρησης** (ADR-720) και αλλάζει το {@link TopoPoint.zSource} (ADR-731: *«αληθινός αριθμός αγνώστου γονέα»*). Θέλει **δική της απόφαση**, όχι παρενέργεια |
 * | `code` | `unwritable: no-owner` | καμία εντολή δεν κατέχει το feature code σήμερα |
 *
 * 🔴 Το `no-owner` **δεν είναι παράλειψη — είναι η άρνηση να πούμε ψέματα**: δηλώνοντάς τα
 * `computed` θα κρύβαμε ότι είναι πραγματικές παράμετροι, και το ψέμα θα επιβίωνε στον χρόνο.
 */
export const COORDINATE_WRITE_BACK: Readonly<Record<CoordinateColumnKey, TableColumnWriteBack>> = {
  index: { kind: 'unwritable', reason: 'ordinal' },
  x: { kind: 'writable', field: 'x' },
  y: { kind: 'writable', field: 'y' },
  z: { kind: 'unwritable', reason: 'no-owner' },
  code: { kind: 'unwritable', reason: 'no-owner' },
};

/**
 * ⚠️ ADR-720 — a point measured in plan only writes `null` in the Ζ column, i.e. an EMPTY cell —
 * never `0`. The convention is already the file's own, three functions down: `buildPlotMeasurements`
 * writes `null` for a corner outside the survey, «ποτέ 0, που θα διαβαζόταν ως πραγματικό υψόμετρο».
 * The same reasoning applies with more force here, because this table is the coordinate schedule
 * that goes into the legal deliverable: a fabricated `0.000` in it is a stated measurement that
 * nobody took.
 */
export function buildCoordinateTable(points: readonly TopoPoint[]): ExportableTable {
  const rows: ExportableTableRow[] = points.map((p, i) => ({
    cells: { index: i + 1, x: p.x, y: p.y, z: p.z ?? null, code: p.code ?? '' },
  }));
  return { columns: COORDINATE_COLUMNS, rows };
}

// ─── Πίνακας κορυφών οικοπέδου (διάγραμμα εμβαδομέτρησης) ─────────────────────

/**
 * Κορυφή · Χ · Υ · Ζ · Πλευρά · Μήκος — το «διάγραμμα εμβαδομέτρησης» που ζητά κάθε δήλωση.
 *
 * Το Ζ **δειγματοληπτείται** από την ΜΕΤΡΗΜΕΝΗ επιφάνεια (`getTopoSurfaceFull` → `TinSampler`,
 * βλ. `useSurveyExport`), δεν ξανα-τριγωνοποιείται τίποτα. Κορυφή έξω από την αποτύπωση ⇒ `null`
 * (κενό κελί) — ποτέ 0, που θα διαβαζόταν ως πραγματικό υψόμετρο.
 *
 * ⚠️ ADR-718 — **ποτέ** η κομμένη (`getTopoSurface`): με ενεργή κοπή, κάθε κορυφή έξω από το όριο
 * θα έχανε το υψόμετρό της και θα έβγαινε μισή στο παραδοτέο. Η κοπή είναι εργαλείο μελέτης· ο
 * πίνακας είναι το αρχείο του τι μετρήθηκε.
 */
export const BOUNDARY_COLUMNS: readonly ScheduleColumnDef[] = [
  col('vertex', 'count', 'right'),
  col('x', 'dimension-mm-to-m', 'right'),
  col('y', 'dimension-mm-to-m', 'right'),
  col('z', 'dimension-mm-to-m', 'right'),
  col('side', 'text', 'center'),
  col('sideLength', 'dimension-mm-to-m', 'right'),
];

/** Τα μετρημένα μεγέθη του οικοπέδου, σε μονάδες παρουσίασης (αυτά που κρίνει ο νόμος). */
export interface PlotMeasurements {
  readonly areaM2: number;
  readonly perimeterM: number;
  readonly table: ExportableTable;
}

function sideLengthMm(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Εμβαδόν + περίμετρος + πίνακας κορυφών από το κλειστό όριο. Το εμβαδόν/περίμετρος βγαίνουν από
 * το γεωμετρικό SSoT (`polygonArea` / `polygonPerimeter`, shoelace) — καμία δεύτερη υλοποίηση.
 */
export function buildPlotMeasurements(
  vertices: readonly Point2D[],
  sampler: TinSampler,
): PlotMeasurements {
  const asPolygon = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const rows: ExportableTableRow[] = vertices.map((v, i) => {
    const next = vertices[(i + 1) % vertices.length];
    return {
      cells: {
        vertex: i + 1,
        x: v.x,
        y: v.y,
        z: sampler.zAtMm(v.x, v.y),
        side: `${i + 1}-${((i + 1) % vertices.length) + 1}`,
        sideLength: sideLengthMm(v, next),
      },
    };
  });

  return {
    areaM2: areaMm2ToM2(polygonArea(asPolygon)),
    perimeterM: lengthMmToM(polygonPerimeter(asPolygon)),
    table: { columns: BOUNDARY_COLUMNS, rows },
  };
}

// ─── Πίνακας όγκων εκσκαφών / επιχώσεων ───────────────────────────────────────

export const VOLUME_COLUMNS: readonly ScheduleColumnDef[] = [
  col('item', 'text', 'left'),
  col('volume', 'volume-m3', 'right'),
  col('area', 'area-m2', 'right'),
];

/** Ήδη μεταφρασμένες ετικέτες γραμμών — τα κελιά είναι ΔΕΔΟΜΕΝΑ, άρα τοπικοποιούνται στο call site. */
export interface VolumeLabels {
  readonly cut: string;
  readonly fill: string;
  readonly net: string;
}

/**
 * Εκσκαφή · Επίχωση · Καθαρό. Οι όγκοι φτάνουν σε mm³/mm² από το `cut-fill-store` και οι στήλες
 * `volume-m3` / `area-m2` απαιτούν μετρικές τιμές ⇒ η μετατροπή γίνεται εδώ, με το units SSoT.
 * Το «καθαρό» δίνεται ως **απόλυτο** μέγεθος· το πρόσημο το λέει η ετικέτα (πλεόνασμα/έλλειμμα).
 */
export function buildVolumeTable(result: CutFillResult, labels: VolumeLabels): ExportableTable {
  const rows: ExportableTableRow[] = [
    {
      cells: {
        item: labels.cut,
        volume: volumeMm3ToM3(result.cutVolumeMm3),
        area: areaMm2ToM2(result.cutAreaMm2),
      },
    },
    {
      cells: {
        item: labels.fill,
        volume: volumeMm3ToM3(result.fillVolumeMm3),
        area: areaMm2ToM2(result.fillAreaMm2),
      },
    },
    {
      cells: {
        item: labels.net,
        volume: volumeMm3ToM3(Math.abs(result.netVolumeMm3)),
        area: null,
      },
    },
  ];
  return { columns: VOLUME_COLUMNS, rows };
}

// ─── Πίνακας ελέγχου ανοχών (§10) ─────────────────────────────────────────────

export const TOLERANCE_COLUMNS: readonly ScheduleColumnDef[] = [
  col('check', 'text', 'left'),
  col('measured', 'number', 'right'),
  col('declared', 'number', 'right'),
  col('allowed', 'number', 'right'),
  col('result', 'text', 'center'),
];

/** Ήδη μεταφρασμένες ετικέτες: τα ονόματα των ελέγχων + οι τρεις εκβάσεις. */
export interface ToleranceLabels {
  readonly area: string;
  readonly perimeter: string;
  readonly pass: string;
  readonly fail: string;
  readonly notDeclared: string;
}

export function buildToleranceTable(
  checks: readonly ToleranceCheck[],
  labels: ToleranceLabels,
): ExportableTable {
  const rows: ExportableTableRow[] = checks.map((c) => ({
    cells: {
      check: c.id === 'area' ? labels.area : labels.perimeter,
      measured: c.measured,
      declared: c.declared,
      allowed: c.allowed,
      result: labels[c.status === 'not-declared' ? 'notDeclared' : c.status],
    },
  }));
  return { columns: TOLERANCE_COLUMNS, rows };
}
