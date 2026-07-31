/**
 * detail-sheet-schedule-table — το «ΣΤΟΙΧΕΙΑ ΟΠΛΙΣΜΟΥ» των φύλλων οπλισμού.
 *
 * **ADR-739 Φάση Β — ΑΠΟΡΡΟΦΗΣΗ.** Αυτό το module ΔΕΝ είναι πια μηχανή διάταξης: είναι
 * **thin adapter** πάνω στη μία μηχανή του repo (`bim/table/table-layout.ts`). Η δημόσια
 * επιφάνεια (`buildScheduleTable` / `buildReinforcementSchedule` / `ScheduleColumn` /
 * `ScheduleTableSpec` / `fmt1` / `REINFORCEMENT_SCHEDULE_COLUMNS`) μένει **ακέραιη** —
 * και οι έξι καταναλωτές συνεχίζουν να καλούν το ίδιο πράγμα.
 *
 * Ιστορικό: ο ADR-622 κεντρικοποίησε εδώ το χειρόγραφο layout που τα beam/column/footing/
 * slab είχαν αντιγράψει. Ο ADR-739 βρήκε ότι αυτό ήταν **μία από τρεις** μηχανές πίνακα
 * στο repo (§1) και ότι ο σωστός δρόμος δεν ήταν τέταρτη, αλλά **απορρόφηση** (§3 Αρχή 2).
 *
 * ## Οι τρεις μεταφράσεις που κάνει ο adapter
 *
 * 1. **`frac` (άγκυρα) → πλάτη στηλών.** Το `ScheduleColumn.frac` δεν είναι πλάτος: είναι
 *    το x όπου *προσδένεται* το κείμενο, με την πλευρά που ορίζει το `align`. Γι' αυτό ο
 *    παλιός πίνακας δεν μπορούσε να έχει κάθετες γραμμές. Το `resolveColumnEdges` το
 *    μεταφράζει σε πραγματικά όρια στηλών (βλ. εκεί).
 * 2. **Οι δύο γραμμές στο `y - ROW_H*0.2`.** Δεν είναι quirk: είναι **κοντύτερη γραμμή
 *    κεφαλίδας** + κείμενο δεδομένων που κάθεται 1,5mm χαμηλότερα μέσα στη γραμμή του.
 *    Ζει ολόκληρο στο preset `detailSheet` (`DETAIL_SHEET_BASELINE_INSET_MM`), όπου
 *    αποδεικνύεται αλγεβρικά. **Η γενική μηχανή δεν έκανε καμία παραχώρηση.**
 * 3. **Τα footers δεν είναι πίνακας.** Είναι ελεύθερες γραμμές κειμένου κάτω από αυτόν
 *    (ο λόγος ρ, ο συντελεστής α) — χωρίς στήλες, χωρίς κελιά. Παράγονται ως έχουν.
 *
 * Η ισοδυναμία **αποδεικνύεται**, δεν δηλώνεται: `__tests__/adr622-absorption-characterization.test.ts`
 * κρατά 10 snapshots και των έξι καταναλωτών, γραμμένα ΠΡΙΝ αγγιχτεί αυτό το αρχείο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §3, §16, §17
 * @see ADR-457/463/471/476 — τα φύλλα οπλισμού ανά μέλος · ADR-650 M7 — τα τοπογραφικά
 */

import { layoutTable } from '../../table/table-layout';
import { tableLayoutToPrimitives } from '../../table/table-layout-to-primitives';
import { createTableModel } from '../../table/table-model-helpers';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
  DETAIL_SHEET_BASELINE_INSET_MM,
  DETAIL_SHEET_HEADER_HEIGHT_MM,
  DETAIL_SHEET_ROW_HEIGHT_MM,
  DETAIL_SHEET_RULE,
  DETAIL_SHEET_SIDE_PAD_MM,
  DETAIL_SHEET_TEXT_HEIGHT_MM,
  DETAIL_SHEET_TEXT_HEX,
  DETAIL_SHEET_TOP_PAD_MM,
} from '../../table/table-style-presets';
import type { TableStyle } from '../../table/table-style';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { DetailPrimitive, RectMm, TextAlign } from './detail-sheet-types';

/** Το built-in στυλ που κρατά τις ακριβείς τιμές του ADR-622 (§16.4). */
const DETAIL_SHEET_STYLE: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);
  if (!style) throw new Error('TABLE_STYLE_DETAIL_SHEET_MISSING');
  return style;
})();

/** Κατακόρυφο κενό ανάμεσα στη γραμμή συνόλου και την πρώτη γραμμή υποσημείωσης. */
const FOOTER_GAP_MM = DETAIL_SHEET_ROW_HEIGHT_MM * 1.5;

/** One decimal place — shared number format for schedule lengths (m) and weights (kg). */
export function fmt1(n: number): string {
  return n.toFixed(1);
}

/** A schedule column: x-anchor as a fraction of the content width (0 = left, 1 = right) + text alignment. */
export interface ScheduleColumn {
  readonly frac: number;
  readonly align: TextAlign;
}

/**
 * Στοιχείο | Οπλισμός | Μήκος | Βάρος — the shared 4-column reinforcement schedule
 * layout (beam / footing / slab). Description is left-aligned, the two numeric
 * columns right-aligned. Columns roll their own set (5-column mark/Ø/n/L/W).
 */
export const REINFORCEMENT_SCHEDULE_COLUMNS: readonly ScheduleColumn[] = [
  { frac: 0, align: 'left' },
  { frac: 0.4, align: 'left' },
  { frac: 0.78, align: 'right' },
  { frac: 1, align: 'right' },
];

/** A fully-specified schedule table (all cells already formatted; empty strings are skipped). */
export interface ScheduleTableSpec {
  readonly region: RectMm;
  readonly columns: readonly ScheduleColumn[];
  /** Bold header cells (one per column). */
  readonly header: readonly string[];
  /** Data rows (each a cell array per column) — callers filter zero-weight families out. */
  readonly rows: readonly (readonly string[])[];
  /** Bold total row (one per column; empty cells omitted). */
  readonly total: readonly string[];
  /** Left-aligned footer lines below the total (ratio ρ, confinement α, …). */
  readonly footers?: readonly string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Μετάφραση 1 — άγκυρες → όρια στηλών
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Γεμίζει τα **αδιόριστα** όρια με γραμμική παρεμβολή ανάμεσα στα γνωστά γειτονικά.
 * Τα άκρα (`0` και το πλήρες πλάτος) είναι πάντα γνωστά, οπότε κάθε κενό έχει και τις
 * δύο πλευρές του.
 */
function fillEdgeGaps(edges: readonly (number | null)[]): number[] {
  const out = edges.slice();
  let i = 0;
  while (i < out.length) {
    if (out[i] !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j] === null) j++;
    const before = out[i - 1] as number;
    const after = out[j] as number;
    const steps = j - i + 1;
    for (let k = i; k < j; k++) out[k] = before + ((after - before) * (k - i + 1)) / steps;
    i = j;
  }
  return out as number[];
}

/**
 * Άγκυρες + στοιχίσεις → πραγματικά όρια στηλών.
 *
 * Μια στήλη με `align: 'left'` κλειδώνει το **αριστερό** της όριο στην άγκυρα· με
 * `align: 'right'` το **δεξί**. Καμία στήλη δεν κλειδώνει και τα δύο, οπότε κάποια
 * ενδιάμεσα όρια μένουν αδιόριστα — και αυτό είναι **σωστό**: η θέση τους δεν επηρεάζει
 * ούτε ένα glyph, αφού η στοίχιση έχει ήδη καθηλώσει την πλευρά που μετράει. Γεμίζουν με
 * παρεμβολή ώστε οι στήλες να βγαίνουν εύλογες (και οι μελλοντικές κάθετες γραμμές, όταν
 * κάποιο στυλ τις ζητήσει, να πέφτουν σε λογικά σημεία).
 */
function resolveColumnEdges(
  columns: readonly ScheduleColumn[],
  contentWidthMm: number,
): number[] {
  const edges: (number | null)[] = new Array(columns.length + 1).fill(null);
  edges[0] = 0;
  edges[columns.length] = contentWidthMm;
  columns.forEach((column, i) => {
    const anchorMm = contentWidthMm * column.frac;
    if (column.align === 'right') edges[i + 1] = anchorMm;
    else if (column.align === 'left') edges[i] = anchorMm;
    // 'center': το κέντρο δεν καθηλώνει μόνο του καμία ακμή — αφήνεται στην παρεμβολή.
  });
  return fillEdgeGaps(edges);
}

// ──────────────────────────────────────────────────────────────────────────────
// Μετάφραση 2 — spec → TableModel
// ──────────────────────────────────────────────────────────────────────────────

const HEADER_ROW_ID = 'header';
const TOTAL_ROW_ID = 'total';
const dataRowId = (i: number): string => `d${i}`;
const columnId = (i: number): string => `c${i}`;

function toTableColumns(
  columns: readonly ScheduleColumn[],
  contentWidthMm: number,
): TableColumn[] {
  const edges = resolveColumnEdges(columns, contentWidthMm);
  return columns.map((column, i) => ({
    id: columnId(i),
    sizing: { kind: 'fixed', widthMm: edges[i + 1] - edges[i] },
    valueType: 'text',
    align: column.align,
    }));
}

/**
 * Οι γραμμές: κεφαλίδα (κοντύτερη — βλ. §16.4), τα δεδομένα, και το σύνολο με τη ρητή
 * γραμμή από πάνω του. Η γραμμή συνόλου υπάρχει **πάντα**, ακόμη και με κενά κελιά: ο
 * ADR-622 ζωγράφιζε τη δεύτερη γραμμή ανεξάρτητα από το αν το `total` είχε περιεχόμενο
 * (το εκμεταλλεύεται το τοπογραφικό φύλλο, που περνά `total: []`).
 */
function toTableRows(spec: ScheduleTableSpec): TableRow[] {
  return [
    { id: HEADER_ROW_ID, rowClass: 'header', heightMm: DETAIL_SHEET_HEADER_HEIGHT_MM },
    ...spec.rows.map((_, i): TableRow => ({ id: dataRowId(i), rowClass: 'data' })),
    { id: TOTAL_ROW_ID, rowClass: 'data', borderTop: DETAIL_SHEET_RULE },
  ];
}

/** Έντονο κελί κειμένου (κεφαλίδα / σύνολο) — η κλάση `data` δεν είναι έντονη από μόνη της. */
function boldCell(value: string): TableCell {
  return { kind: 'text', value, styleOverride: { bold: true } };
}

/** Τα μη-κενά κελιά μιας γραμμής, ως τριάδες για το `createTableModel` (αραιός χάρτης). */
function rowCells(
  rowId: string,
  values: readonly string[],
  bold: boolean,
): (readonly [string, string, TableCell])[] {
  const out: (readonly [string, string, TableCell])[] = [];
  values.forEach((value, i) => {
    if (!value) return; // κενό κελί = καθόλου κελί (ο ADR-622 το παρέλειπε κι αυτός)
    out.push([rowId, columnId(i), bold ? boldCell(value) : { kind: 'text', value }]);
  });
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Μετάφραση 3 — υποσημειώσεις (δεν είναι πίνακας)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι γραμμές κάτω από τον πίνακα (ρ, α): αριστερά στοιχισμένες στο περιθώριο, χωρίς
 * στήλες και χωρίς κελιά. Δεν μοντελοποιούνται ως γραμμές πίνακα γιατί **δεν είναι**
 * γραμμές πίνακα — θα χρειάζονταν πλασματική στήλη μόνο και μόνο για να χωρέσουν.
 */
function footerPrimitives(
  footers: readonly string[],
  xMm: number,
  firstTopMm: number,
): DetailPrimitive[] {
  return footers.map((text, i) => ({
    kind: 'text',
    position: { x: xMm, y: firstTopMm + i * DETAIL_SHEET_ROW_HEIGHT_MM + DETAIL_SHEET_TEXT_HEIGHT_MM },
    text,
    heightMm: DETAIL_SHEET_TEXT_HEIGHT_MM,
    colorHex: DETAIL_SHEET_TEXT_HEX,
    align: 'left',
    bold: false,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Η δημόσια επιφάνεια — αμετάβλητη
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit the steel-schedule primitives (sheet-mm): header row + underline, one line
 * per data row, a pre-total rule + total row, then the footer lines.
 *
 * ADR-739 Φ.Β: η διάταξη έρχεται πλέον από το `layoutTable` — μία μηχανή στο repo.
 */
export function buildScheduleTable(spec: ScheduleTableSpec): DetailPrimitive[] {
  const { region, columns } = spec;
  const contentWidthMm = region.w - 2 * DETAIL_SHEET_SIDE_PAD_MM;
  const originMm = {
    xMm: region.x + DETAIL_SHEET_SIDE_PAD_MM,
    yMm: region.y + DETAIL_SHEET_TOP_PAD_MM,
  };

  const model = createTableModel({
    columns: toTableColumns(columns, contentWidthMm),
    rows: toTableRows(spec),
    cells: [
      ...rowCells(HEADER_ROW_ID, spec.header, true),
      ...spec.rows.flatMap((values, i) => rowCells(dataRowId(i), values, false)),
      ...rowCells(TOTAL_ROW_ID, spec.total, true),
    ],
  });

  const layout = layoutTable(model, DETAIL_SHEET_STYLE, { availableWidthMm: contentWidthMm });
  const out = tableLayoutToPrimitives(layout, originMm);

  const footers = spec.footers ?? [];
  if (footers.length > 0) {
    // Μετρώνται από τη ΓΡΑΜΜΗ ΠΕΡΙΕΧΟΜΕΝΟΥ του συνόλου, όχι από την ακμή της γραμμής του:
    // ο ADR-622 δεν είχε καθόλου έννοια «ακμής» — το `y` που κρατούσε ήταν η θέση του
    // κειμένου (`baseline = y + TEXT_MM`), και από εκεί μετρούσε το κενό. Στο νέο μοντέλο
    // η ίδια θέση είναι «κορυφή γραμμής + κατακόρυφο περιθώριο».
    const totalContentTopMm =
      layout.heightMm - DETAIL_SHEET_ROW_HEIGHT_MM + DETAIL_SHEET_BASELINE_INSET_MM;
    out.push(
      ...footerPrimitives(footers, originMm.xMm, originMm.yMm + totalContentTopMm + FOOTER_GAP_MM),
    );
  }

  return out;
}

/** The six header/total/ratio labels shared by the 4-column reinforcement schedules. */
export interface ReinforcementScheduleLabels {
  readonly item: string;
  readonly description: string;
  readonly length: string;
  readonly weight: string;
  readonly total: string;
  readonly ratio: string;
}

/**
 * Convenience wrapper for the 4-column «Στοιχείο | Οπλισμός | Μήκος | Βάρος»
 * reinforcement schedule (beam / footing / slab): header from `labels`, the given
 * pre-formatted data `rows`, a bold total-weight row, and the ratio ρ footer. Only
 * the rows vary per member; column keeps the 5-column {@link buildScheduleTable}.
 */
export function buildReinforcementSchedule(
  region: RectMm,
  labels: ReinforcementScheduleLabels,
  rows: readonly (readonly string[])[],
  totalWeight: string,
  ratio: number,
): DetailPrimitive[] {
  return buildScheduleTable({
    region,
    columns: REINFORCEMENT_SCHEDULE_COLUMNS,
    header: [labels.item, labels.description, labels.length, labels.weight],
    rows,
    total: [labels.total, '', '', totalWeight],
    footers: [`${labels.ratio} = ${(ratio * 100).toFixed(2)}%`],
  });
}
