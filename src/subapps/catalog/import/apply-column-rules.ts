/**
 * `RawTable` + προφίλ → `ExtractedGroup[]` (ADR-923 §5.5) — ο **καταλογικός** αντιστοιχιστής πάνω στον γενικό πινακοειδή
 * πυρήνα. Το αρχείο δεν αγγίζεται ποτέ· μετακινείται η αντιστοίχιση (το UX-κέρδος του ADR-650, Civil 3D Format Manager).
 *
 * Στήλη με **ίδια ετικέτα** βρίσκεται όπου κι αν μετακινήθηκε στο νέο αρχείο του προμηθευτή· χωρίς επικεφαλίδα μετρά η
 * θέση. Οι γραμμές ομαδοποιούνται κατά κωδικό μοντέλου· χωρίς τέτοια στήλη κάθε γραμμή είναι δικό της σύνολο (απλό
 * προϊόν). Στη ροή τιμών οι γραμμές κόβονται σε τμήματα: ένα τμήμα = μία συναλλαγή.
 * @module subapps/catalog/import/apply-column-rules
 */

import type { RawTable } from '@/lib/tabular-import/tabular-types';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportColumnRule, ImportProfileDefinition } from '../types/catalog-import';
import { IMPORT_PRICE_LINES_PER_PROPOSAL, IMPORT_ROWS_PER_PROPOSAL } from '../vocabulary/catalog-import';

const headerForm = (header: string): string => header.trim().toLowerCase().replace(/\s+/g, ' ');

/** Η θέση της στήλης σε **αυτό** το αρχείο: πρώτα με την ετικέτα, μετά με τη δηλωμένη θέση. `null` = η στήλη έλειψε. */
function columnIndexOf(rule: ImportColumnRule, headers: readonly string[]): number | null {
  if (headers.length === 0 || rule.header.trim() === '') return rule.position;
  const index = headers.findIndex((header) => headerForm(header) === headerForm(rule.header));
  return index === -1 ? null : index;
}

/** Οι κανόνες που εφαρμόζονται, με τη θέση τους, και όσοι δεν βρήκαν στήλη (τους δείχνει η οθόνη). */
export interface ResolvedColumns {
  readonly columns: readonly { readonly rule: ImportColumnRule; readonly index: number }[];
  readonly missing: readonly ImportColumnRule[];
}

export function resolveColumns(profile: Pick<ImportProfileDefinition, 'columns'>, headers: readonly string[]): ResolvedColumns {
  const active = profile.columns.filter((rule) => rule.target !== null);
  const located = active.map((rule) => ({ rule, index: columnIndexOf(rule, headers) }));
  return {
    columns: located.flatMap(({ rule, index }) => (index === null ? [] : [{ rule, index }])),
    missing: located.flatMap(({ rule, index }) => (index === null ? [rule] : [])),
  };
}

function cellOf(rule: ImportColumnRule, index: number, row: readonly string[], rowNumber: number): ExtractedCell | null {
  const { target } = rule;
  if (target === null) return null;
  const text = (row[index] ?? '').trim();
  return {
    target,
    text: text === '' ? null : text,
    confidence: 1,
    anchor: { kind: 'cell', row: rowNumber, column: index + 1 },
    unitCode: rule.unitCode,
    flags: [],
  };
}

interface TableRow {
  readonly modelCode: string | null;
  readonly row: ExtractedRow;
}

function tableRows(table: RawTable, resolved: ResolvedColumns, firstRowNumber: number): TableRow[] {
  return table.rows.map((row, offset) => {
    const rowNumber = firstRowNumber + offset;
    const cells = resolved.columns.flatMap(({ rule, index }) => cellOf(rule, index, row, rowNumber) ?? []);
    const modelCode = cells.find((cell) => cell.target.kind === 'modelCode')?.text ?? null;
    return { modelCode, row: { rowKey: `r${rowNumber}`, cells: cells.filter((cell) => cell.target.kind !== 'modelCode') } };
  });
}

function hasContent(row: ExtractedRow): boolean {
  return row.cells.some((cell) => cell.text !== null);
}

function groupOf(groupKey: string, modelCode: string | null, rows: readonly ExtractedRow[]): ExtractedGroup {
  return { groupKey, modelCode, sharedCells: [], rows, pages: [] };
}

/** Τμήματα σταθερού μεγέθους: το `groupKey` είναι ο δείκτης, άρα ίδιο αρχείο ⇒ ίδια τμήματα. */
function chunksOf(prefix: string, modelCode: string | null, rows: readonly ExtractedRow[], size: number): ExtractedGroup[] {
  const groups: ExtractedGroup[] = [];
  for (let start = 0; start < rows.length; start += size) {
    groups.push(groupOf(`${prefix}:${groups.length}`, modelCode, rows.slice(start, start + size)));
  }
  return groups;
}

function byModel(rows: readonly TableRow[]): ExtractedGroup[] {
  const models = new Map<string, ExtractedRow[]>();
  const standalone: ExtractedGroup[] = [];
  for (const { modelCode, row } of rows) {
    if (modelCode === null) standalone.push(groupOf(`row:${row.rowKey}`, null, [row]));
    else models.set(modelCode, [...(models.get(modelCode) ?? []), row]);
  }
  const grouped = [...models].flatMap(([code, modelRows]) => chunksOf(`model:${code}`, code, modelRows, IMPORT_ROWS_PER_PROPOSAL));
  return [...grouped, ...standalone];
}

/**
 * Ο αριθμός γραμμής της **πρώτης** γραμμής δεδομένων, όπως τον βλέπει ο άνθρωπος στο αρχείο: οι παραλειπόμενες + η
 * επικεφαλίδα (ένδειξη, όχι εγγύηση: οι κενές/σχόλια γραμμές δεν μετρούν στον αναγνώστη).
 */
const firstDataRowNumber = (table: RawTable, skipRows: number): number => skipRows + (table.headers.length > 0 ? 1 : 0) + 1;

export function extractGroupsFromTable(table: RawTable, profile: ImportProfileDefinition): ExtractedGroup[] {
  const resolved = resolveColumns(profile, table.headers);
  const rows = tableRows(table, resolved, firstDataRowNumber(table, profile.skipRows)).filter(({ row }) => hasContent(row));
  if (profile.purpose === 'priceLines') {
    return chunksOf('prices', null, rows.map(({ row }) => row), IMPORT_PRICE_LINES_PER_PROPOSAL);
  }
  return byModel(rows);
}
