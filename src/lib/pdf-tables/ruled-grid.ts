/**
 * Πίνακες από **ζωγραφισμένες γραμμές** (ADR-923 §5.5.1), η οικογένεια Lattice του Camelot και της στρατηγικής `lines` του
 * pdfplumber, αλλά από τα διανυσματικά δεδομένα του PDF αντί για εικόνα.
 *
 *   1. Οι γραμμές κουμπώνουν στην ίδια θέση και οι συνεχόμενες ενώνονται.
 *   2. Γραμμές που τέμνονται ανήκουν στον ίδιο πίνακα: έτσι δύο πίνακες μιας σελίδας δεν μπλέκουν τις στήλες τους.
 *   3. Πλέγμα από τις θέσεις. Όπου λείπει το όριο ανάμεσα σε δύο βασικά κελιά, τα κελιά είναι ένα: από εκεί βγαίνουν οι ενώσεις.
 *   4. Κάθε λέξη πάει στο κελί του κέντρου της.
 * @module lib/pdf-tables/ruled-grid
 */

import { cellText } from './cell-text';
import type { PageRule, PageTable, PageTableCell, PageWord } from './page-table-types';

/** ≈ 1,5 pt σε σελίδα A4: το πάχος γραμμής και οι στρογγυλοποιήσεις της InDesign, όχι άλλη στήλη. */
const SNAP = 0.0025;

type Ruling = PageRule;
type RulingTable = Omit<PageTable, 'key' | 'witness'>;

function snapPositions(values: readonly number[]): (value: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: { sum: number; count: number; last: number }[] = [];
  for (const value of sorted) {
    const open = clusters[clusters.length - 1];
    if (open && value - open.last <= SNAP) Object.assign(open, { sum: open.sum + value, count: open.count + 1, last: value });
    else clusters.push({ sum: value, count: 1, last: value });
  }
  const centers = clusters.map(({ sum, count }) => sum / count);
  return (value) => centers.reduce((best, center) => (Math.abs(center - value) < Math.abs(best - value) ? center : best), centers[0]);
}

function joinSpans(rules: readonly Ruling[]): Ruling[] {
  const joined: Ruling[] = [];
  for (const rule of [...rules].sort((a, b) => a.from - b.from)) {
    const open = joined[joined.length - 1];
    if (open && rule.from <= open.to + SNAP) joined[joined.length - 1] = { ...open, to: Math.max(open.to, rule.to) };
    else joined.push(rule);
  }
  return joined;
}

function normalizeAxis(rules: readonly PageRule[], axis: PageRule['axis']): Ruling[] {
  const onAxis = rules.filter((rule) => rule.axis === axis);
  const snap = snapPositions(onAxis.map((rule) => rule.at));
  const byPosition = new Map<number, Ruling[]>();
  for (const rule of onAxis) {
    const at = snap(rule.at);
    byPosition.set(at, [...(byPosition.get(at) ?? []), { ...rule, at, from: Math.min(rule.from, rule.to), to: Math.max(rule.from, rule.to) }]);
  }
  return [...byPosition.values()].flatMap(joinSpans);
}

function disjointSet(size: number) {
  const parent = Array.from({ length: size }, (_, index) => index);
  const find = (item: number): number => {
    while (parent[item] !== item) {
      parent[item] = parent[parent[item]];
      item = parent[item];
    }
    return item;
  };
  return { find, union: (left: number, right: number) => { parent[find(left)] = find(right); } };
}

const crosses = (h: Ruling, v: Ruling): boolean => v.at >= h.from - SNAP && v.at <= h.to + SNAP && h.at >= v.from - SNAP && h.at <= v.to + SNAP;

/** Οι ομάδες γραμμών που τέμνονται. */
function connectedRulings(horizontal: readonly Ruling[], vertical: readonly Ruling[]): Ruling[][] {
  const all = [...horizontal, ...vertical];
  const sets = disjointSet(all.length);
  horizontal.forEach((h, i) => vertical.forEach((v, j) => {
    if (crosses(h, v)) sets.union(i, horizontal.length + j);
  }));
  const groups = new Map<number, Ruling[]>();
  all.forEach((rule, index) => {
    const root = sets.find(index);
    groups.set(root, [...(groups.get(root) ?? []), rule]);
  });
  return [...groups.values()];
}

const positions = (rules: readonly Ruling[], axis: PageRule['axis']): number[] =>
  [...new Set(rules.filter((rule) => rule.axis === axis).map((rule) => rule.at))].sort((a, b) => a - b);

function ruled(rules: readonly Ruling[], axis: PageRule['axis'], at: number, from: number, to: number): boolean {
  return rules.some((rule) => rule.axis === axis && rule.at === at && rule.from <= from + SNAP * 2 && rule.to >= to - SNAP * 2);
}

function slotOf(lines: readonly number[], value: number): number {
  return lines.findIndex((line, index) => index + 1 < lines.length && value >= line && value < lines[index + 1]);
}

interface Grid {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
}

/** Οι ρίζες των βασικών κελιών: όπου δεν υπάρχει όριο, τα δύο κελιά είναι ένα. */
function mergedCellRoots({ xs, ys }: Grid, rules: readonly Ruling[]) {
  const rows = ys.length - 1;
  const cols = xs.length - 1;
  const id = (row: number, col: number): number => row * cols + col;
  const sets = disjointSet(rows * cols);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (col + 1 < cols && !ruled(rules, 'v', xs[col + 1], ys[row], ys[row + 1])) sets.union(id(row, col), id(row, col + 1));
      if (row + 1 < rows && !ruled(rules, 'h', ys[row + 1], xs[col], xs[col + 1])) sets.union(id(row, col), id(row + 1, col));
    }
  }
  return { rootOf: (row: number, col: number) => sets.find(id(row, col)), rows, cols };
}

function gridCell(grid: Grid, members: readonly { readonly row: number; readonly col: number }[], words: readonly PageWord[]): PageTableCell {
  const rows = members.map(({ row }) => row);
  const cols = members.map(({ col }) => col);
  const [row, lastRow, col, lastCol] = [Math.min(...rows), Math.max(...rows), Math.min(...cols), Math.max(...cols)];
  const box = { x: grid.xs[col], y: grid.ys[row], width: grid.xs[lastCol + 1] - grid.xs[col], height: grid.ys[lastRow + 1] - grid.ys[row] };
  return { row, col, rowSpan: lastRow - row + 1, colSpan: lastCol - col + 1, text: cellText(words), wordIds: words.map((word) => word.id), box };
}

function buildTable(rules: readonly Ruling[], words: readonly PageWord[]): RulingTable | null {
  const grid = { xs: positions(rules, 'v'), ys: positions(rules, 'h') };
  if (grid.xs.length < 3 || grid.ys.length < 3) return null;
  const { rootOf, rows, cols } = mergedCellRoots(grid, rules);
  const members = new Map<number, { row: number; col: number }[]>();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) members.set(rootOf(row, col), [...(members.get(rootOf(row, col)) ?? []), { row, col }]);
  }
  const wordsByRoot = new Map<number, PageWord[]>();
  for (const word of words) {
    const row = slotOf(grid.ys, word.y + word.height / 2);
    const col = slotOf(grid.xs, word.x + word.width / 2);
    if (row === -1 || col === -1) continue;
    wordsByRoot.set(rootOf(row, col), [...(wordsByRoot.get(rootOf(row, col)) ?? []), word]);
  }
  const cells = [...members].map(([root, group]) => gridCell(grid, group, wordsByRoot.get(root) ?? [])).sort((a, b) => a.row - b.row || a.col - b.col);
  return { source: 'ruled', rowCount: rows, colCount: cols, cells };
}

/** Οι χαραγμένοι πίνακες της σελίδας, από πάνω προς τα κάτω. Πλαίσιο εικόνας ή ένα κουτί δεν είναι πίνακας. */
export function ruledTables(rules: readonly PageRule[], words: readonly PageWord[]): RulingTable[] {
  const groups = connectedRulings(normalizeAxis(rules, 'h'), normalizeAxis(rules, 'v'));
  const tables = groups.flatMap((group) => buildTable(group, words) ?? []);
  return tables.filter((table) => table.cells.some((cell) => cell.text !== '')).sort((a, b) => a.cells[0].box.y - b.cells[0].box.y);
}

export type { RulingTable };
