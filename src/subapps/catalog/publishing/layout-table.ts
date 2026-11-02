/**
 * =============================================================================
 * ΑΠΟ ΤΟΝ ΠΙΝΑΚΑ ΚΑΤΑΛΟΓΟΥ ΣΤΟ ΜΠΛΟΚ ΣΕΛΙΔΑΣ (ADR-923 §5.6 · §21.4.3)
 * =============================================================================
 *
 * Παίρνει το `TablePreview` του **ενός** builder και αποφασίζει ό,τι δεν είναι δουλειά μηχανής:
 *   - **συνέχεια στηλών**: περισσότερες στήλες από όσες χωρούν ⇒ νέο μπλοκ με τις ίδιες ετικέτες γραμμών·
 *   - **συγχωνεύσεις** ανά γραμμή με τον κανόνα της οθόνης (`mergeRowCells`), **μέσα** σε κάθε μπλοκ — ένα `colSpan` δεν
 *     περνά ποτέ το όριο μπλοκ·
 *   - **rowspan** ομάδας (`rail`): η ετικέτα ομάδας πιάνει όσες γραμμές ακολουθούν ως την επόμενη ομάδα. Το κελί δεν κόβεται
 *     σε σελίδες, άρα ομάδα ψηλότερη από σελίδα χωρίζεται εδώ σε τμήματα με επανάληψη ετικέτας ({@link evenSegments})·
 *   - **κεφαλίδες**: οι αρχικές γραμμές αξόνων, που η μηχανή επαναλαμβάνει όταν ο πίνακας σπάσει σε νέα σελίδα.
 *
 * @module subapps/catalog/publishing/layout-table
 */

import { mergeRowCells, type PreviewRow, type TablePreview } from '../table/catalog-table';
import type { TableOverflowMode } from '../types/family';
import type { LayoutCell, LayoutTable, LayoutTableRow } from './layout-model';
import { withBreakHints } from './layout-text';
import { PUBLICATION_LIMITS, PUBLICATION_NO_VALUE, type TableGroupStyle } from './publication-vocabulary';

export interface LayoutTableOptions {
  readonly id: string;
  readonly caption: string;
  readonly groupStyle: TableGroupStyle;
  readonly maxValueColumns: number;
  /** Πόσες στήλες χωρούν ανεστραμμένες: χωρίς στήλη ομάδας, γιατί οι ομάδες ανεβαίνουν στην κεφαλίδα. */
  readonly maxTransposedColumns: number;
  readonly overflow: TableOverflowMode;
  readonly labelColumnMm: number;
  readonly railColumnMm: number;
  /** Οι κωδικοί στηλών που είναι **τιμές** (`id` γραμμής): άλλος ρόλος, άλλη όψη· ποτέ υπολογισμός από το κείμενο. */
  readonly priceRowIds: ReadonlySet<string>;
}

type AttributeRow = Extract<PreviewRow, { kind: 'attribute' }>;
type AxisRow = Extract<PreviewRow, { kind: 'axis' }>;

const cell = (text: string, role: LayoutCell['role'], colSpan = 1, rowSpan = 1): LayoutCell => ({ text, role, colSpan, rowSpan });

/** Πόσες στήλες τιμών χωρούν: πλάτος περιοχής − ετικέτα, ανά ελάχιστο πλάτος στήλης, μέσα στα όρια του εκδότη. */
export function fitValueColumns(input: { readonly areaMm: number; readonly labelMm: number; readonly minColumnMm: number }): number {
  const fit = Math.floor((input.areaMm - input.labelMm) / input.minColumnMm);
  return Math.min(PUBLICATION_LIMITS.maxValueColumnsPerBlock, Math.max(PUBLICATION_LIMITS.minValueColumnsPerBlock, fit));
}

/** Ισομερή όρια `[from, to)` των `size` το πολύ: το 8 με όριο 7 γίνεται 4 + 4, ποτέ 7 + μία ορφανή στήλη σε όλο το πλάτος. */
function evenRanges(length: number, size: number): readonly (readonly [number, number])[] {
  const count = Math.ceil(length / size);
  return Array.from({ length: count }, (_, index) => [Math.floor((index * length) / count), Math.floor(((index + 1) * length) / count)] as const);
}

/** Τα κομμάτια στηλών `[from, to)` — τουλάχιστον ένα, ακόμη και σε πίνακα χωρίς στήλες. */
export function columnChunks(columnCount: number, maxValueColumns: number): readonly (readonly [number, number])[] {
  return columnCount === 0 ? [[0, 0]] : evenRanges(columnCount, maxValueColumns);
}

function rowLabel(row: AttributeRow): string {
  const unit = row.unit ? ` (${row.unit})` : '';
  const filter = row.filter ? ` ${row.filter}` : '';
  return `${row.label}${unit}${filter}`;
}

function attributeCells(row: AttributeRow, range: readonly [number, number], priceRow: boolean): LayoutCell[] {
  const slice = (row.cells ?? []).slice(range[0], range[1]);
  const role = priceRow ? 'price' : 'value';
  return mergeRowCells(row.merge, slice).map((run) => cell(run.text === '' ? PUBLICATION_NO_VALUE : withBreakHints(run.text), role, run.span));
}

/** Μία ομάδα: η κεφαλίδα της και οι γραμμές ως την επόμενη. `head: null` = γραμμές πριν από την πρώτη κεφαλίδα. */
interface RowGroup {
  readonly head: Extract<PreviewRow, { kind: 'groupHeader' }> | null;
  readonly rows: readonly Exclude<PreviewRow, { kind: 'groupHeader' }>[];
}

function groupRows(rows: readonly PreviewRow[]): RowGroup[] {
  const groups: { head: RowGroup['head']; rows: Exclude<PreviewRow, { kind: 'groupHeader' }>[] }[] = [{ head: null, rows: [] }];
  for (const row of rows) {
    if (row.kind === 'groupHeader') groups.push({ head: row, rows: [] });
    else groups[groups.length - 1].rows.push(row);
  }
  return groups.filter((group) => group.head !== null || group.rows.length > 0);
}

function bodyRow(
  row: Exclude<PreviewRow, { kind: 'groupHeader' }>,
  range: readonly [number, number],
  lead: readonly LayoutCell[],
  options: LayoutTableOptions,
): LayoutTableRow {
  if (row.kind === 'axis') {
    const heads = row.cells.slice(range[0], range[1]).map((text) => cell(withBreakHints(text), 'columnHead'));
    return { id: row.id, header: false, cells: [...lead, cell(row.label, 'corner'), ...heads] };
  }
  return { id: row.id, header: false, cells: [...lead, cell(rowLabel(row), 'rowHead'), ...attributeCells(row, range, options.priceRowIds.has(row.id))] };
}

/** Ισομερή τμήματα: η ομάδα των 25 με όριο 20 γίνεται 12 + 13, όχι 20 + πέντε ορφανές γραμμές. */
export function evenSegments<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  return evenRanges(items.length, size).map(([from, to]) => items.slice(from, to));
}

function bandRows(group: RowGroup, range: readonly [number, number], options: LayoutTableOptions, width: number): LayoutTableRow[] {
  const band = group.head ? [{ id: group.head.id, header: false, cells: [cell(group.head.label, 'groupBand', width)] }] : [];
  return [...band, ...group.rows.map((row) => bodyRow(row, range, [], options))];
}

function railRows(group: RowGroup, range: readonly [number, number], options: LayoutTableOptions): LayoutTableRow[] {
  const { head } = group;
  // 🔴 Χωρίς ομάδα (κεφαλίδες αξόνων): ένα κελί ανά γραμμή — rowspan από κεφαλίδα σε σώμα δεν επαναλαμβάνεται σωστά.
  if (!head) return group.rows.map((row) => bodyRow(row, range, [cell('', row.kind === 'axis' ? 'corner' : 'groupRail')], options));
  return evenSegments(group.rows, PUBLICATION_LIMITS.maxRailRowsPerSegment).flatMap((segment) =>
    segment.map((row, index) => bodyRow(row, range, index === 0 ? [cell(head.label, 'groupRail', 1, segment.length)] : [], options)));
}

/** Οι **αρχικές** γραμμές αξόνων γίνονται κεφαλίδα· άξονας πιο κάτω μένει σώμα. */
function markHeader(rows: readonly LayoutTableRow[], source: readonly PreviewRow[]): LayoutTableRow[] {
  const axisIds = new Set(source.filter((row) => row.kind === 'axis').map((row) => row.id));
  let leading = true;
  return rows.map((row) => {
    leading = leading && axisIds.has(row.id);
    return leading ? { ...row, header: true } : row;
  });
}

/** Παίρνει ο πίνακας στήλη ομάδας; Το ίδιο ερώτημα κάνει και ο υπολογισμός των στηλών που χωρούν. */
export function tableUsesRail(preview: Pick<TablePreview, 'rows'>, groupStyle: TableGroupStyle): boolean {
  return groupStyle === 'rail' && preview.rows.some((row) => row.kind === 'groupHeader');
}

function buildPart(preview: TablePreview, range: readonly [number, number], options: LayoutTableOptions, part: readonly [number, number]): LayoutTable {
  const rail = tableUsesRail(preview, options.groupStyle);
  const valueColumns = range[1] - range[0];
  const columnCount = valueColumns + 1 + (rail ? 1 : 0);
  const rows = groupRows(preview.rows).flatMap((group) => (rail ? railRows(group, range, options) : bandRows(group, range, options, columnCount)));
  return {
    id: part[1] > 1 ? `${options.id}-${part[0]}` : options.id,
    caption: options.caption,
    columnCount,
    railColumn: rail,
    labelColumnMm: options.labelColumnMm,
    railColumnMm: options.railColumnMm,
    part: part[0],
    parts: part[1],
    rows: markHeader(rows, preview.rows),
  };
}

// ── Αναστροφή (§5.6): παραλλαγή = γραμμή, ιδιότητα = στήλη ──────────────────────

/** Η ετικέτα γραμμής της παραλλαγής `index`: οι τιμές των αξόνων, από την πρώτη εμφάνιση κάθε άξονα. */
function variantLabel(axes: readonly AxisRow[], index: number): string {
  return axes.map((axis) => axis.cells[index] ?? '').join(' · ');
}

function distinctAxes(rows: readonly PreviewRow[]): AxisRow[] {
  const byLabel = new Map<string, AxisRow>();
  for (const row of rows) if (row.kind === 'axis' && !byLabel.has(row.label)) byLabel.set(row.label, row);
  return [...byLabel.values()];
}

/** Η γραμμή ομάδων πάνω από τις στήλες. Όχι `groupBand`: εκείνος ο ρόλος πιάνει όλο το πλάτος στο πρότυπο. */
function groupHeadRow(groups: readonly RowGroup[], id: string): LayoutTableRow | null {
  const spans = groups.flatMap((group) => {
    const span = group.rows.filter((row) => row.kind === 'attribute').length;
    return span > 0 ? [{ label: group.head?.label ?? '', span }] : [];
  });
  if (!spans.some((item) => item.label !== '')) return null;
  return { id: `${id}-groups`, header: true, cells: [cell('', 'corner'), ...spans.map((item) => cell(item.label, 'columnHead', item.span))] };
}

/** Τα κελιά μιας στήλης, ανά γραμμή: τα κατειλημμένα από `rowSpan` μένουν απόντα, όπως στη στήλη ομάδας. */
function columnCells(row: AttributeRow, variants: number, priceRow: boolean): (readonly LayoutCell[])[] {
  const values = Array.from({ length: variants }, (_, index) => row.cells?.[index] ?? '');
  const column: LayoutCell[][] = values.map(() => []);
  const role = priceRow ? 'price' : 'value';
  let start = 0;
  for (const segment of evenSegments(values, PUBLICATION_LIMITS.maxRailRowsPerSegment)) {
    let at = start;
    for (const run of mergeRowCells(row.merge, segment)) {
      column[at] = [cell(run.text === '' ? PUBLICATION_NO_VALUE : withBreakHints(run.text), role, 1, run.span)];
      at += run.span;
    }
    start += segment.length;
  }
  return column;
}

/**
 * Ο πίνακας ανεστραμμένος, ή `null` όταν η αναστροφή δεν λύνει το πρόβλημα: όταν λείπει άξονας ή όταν οι ιδιότητες δεν
 * χωρούν ούτε αυτές. Τότε ισχύει η συνέχεια, γιατί ένας πίνακας που βγαίνει έξω από το χαρτί δεν είναι επιλογή.
 */
function transposedTable(preview: TablePreview, options: LayoutTableOptions): LayoutTable | null {
  const attributes = preview.rows.filter((row): row is AttributeRow => row.kind === 'attribute');
  const axes = distinctAxes(preview.rows);
  if (axes.length === 0 || attributes.length === 0 || attributes.length > options.maxTransposedColumns) return null;
  const variants = preview.columns.length;
  const columns = attributes.map((row) => columnCells(row, variants, options.priceRowIds.has(row.id)));
  const heads = attributes.map((row) => cell(withBreakHints(rowLabel(row)), 'columnHead'));
  const groups = groupHeadRow(groupRows(preview.rows), options.id);
  const header: LayoutTableRow = { id: `${options.id}-head`, header: true, cells: [cell(axes.map((axis) => axis.label).join(' · '), 'corner'), ...heads] };
  const body = Array.from({ length: variants }, (_, index): LayoutTableRow => ({
    id: `${options.id}-v${index}`,
    header: false,
    cells: [cell(withBreakHints(variantLabel(axes, index)), 'rowHead'), ...columns.flatMap((column) => column[index])],
  }));
  return {
    id: options.id, caption: options.caption, columnCount: attributes.length + 1, railColumn: false,
    labelColumnMm: options.labelColumnMm, railColumnMm: options.railColumnMm, part: 1, parts: 1,
    rows: [...(groups ? [groups] : []), header, ...body],
  };
}

/**
 * Ο πίνακας ως **ένα ή περισσότερα** μπλοκ. Στη σελίδα ο μηχανικός διαβάζει κάθε μπλοκ μόνο του: οι ετικέτες γραμμών και
 * οι ομάδες επαναλαμβάνονται σε κάθε συνέχεια, αλλιώς οι στήλες 9–12 θα ήταν αριθμοί χωρίς νόημα.
 * 🔑 Η αναστροφή τρέχει μόνο όταν χρειάζεται: πίνακας που χωρά μένει όπως τον δήλωσε η οικογένεια.
 */
export function layoutTables(preview: TablePreview, options: LayoutTableOptions): LayoutTable[] {
  const chunks = columnChunks(preview.columns.length, options.maxValueColumns);
  const transposed = chunks.length > 1 && options.overflow === 'transpose' ? transposedTable(preview, options) : null;
  if (transposed) return [transposed];
  return chunks.map((range, index) => buildPart(preview, range, options, [index + 1, chunks.length]));
}
