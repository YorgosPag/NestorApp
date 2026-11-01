/**
 * Το **συμβόλαιο αντιστοίχισης** με το μοντέλο (ADR-923 §5.5.1): ο πίνακας πάει ανασυντεθειμένος και το μοντέλο λέει ποια γραμμή είναι
 * ποια ιδιότητα. 🔑 Το σχήμα **δεν έχει πεδίο τιμής**: ό,τι δεν γράφει το μοντέλο δεν μπορεί να το επινοήσει ή να το μετατρέψει.
 *
 * 🚀 Το `imageCheck` καλύπτει το όριο της στρώσης κειμένου: χαλασμένη κωδικοποίηση ή κρυφό κείμενο δίνουν αριθμούς που δεν τυπώνονται.
 * Ο διακομιστής διαλέγει λίγα κελιά και το μοντέλο λέει τι βλέπει στην **εικόνα**. Μεμονωμένη διαφωνία είναι ολίσθημα ανάγνωσης,
 * όχι κρίση για τη στρώση· γι' αυτό μετρά μόνο η μαζική.
 * @module subapps/catalog/import/page-table-mapping
 */

import type { PageTable, PageTableCell } from '@/lib/pdf-tables/page-table-types';
import { parseEnteredAmount } from '../values/decimal-amount';
import { comparableForm } from './page-tokens';
import { attributeLine, type PageAttributeSpec } from './page-extraction';

export const PAGE_MAPPING_SCHEMA_NAME = 'catalog_page_table_mapping';

export const PAGE_TABLE_ROLES = ['variants', 'accessories', 'other'] as const;
export type PageTableRole = (typeof PAGE_TABLE_ROLES)[number];

export const VARIANT_ORIENTATIONS = ['columns', 'rows'] as const;
export type VariantOrientation = (typeof VARIANT_ORIENTATIONS)[number];

export interface RawLineMapping {
  /** Ο αριθμός της γραμμής (`variantsIn: columns`) ή της στήλης (`rows`) του πλέγματος. */
  readonly line: number;
  readonly attribute: string | null;
  readonly confidence: number;
}

export interface RawTableMapping {
  readonly table: string;
  readonly role: PageTableRole;
  readonly variantsIn: VariantOrientation;
  readonly lines: readonly RawLineMapping[];
  readonly imageCheck: readonly { readonly cell: string; readonly seen: string | null }[];
}

export interface RawPageMapping {
  readonly tables: readonly RawTableMapping[];
}

const IMAGE_CHECK_CELLS = 6;
/** Κάτω από τόσες συγκρίσιμες αναγνώσεις δεν κρίνεται η στρώση. */
const MIN_IMAGE_COMPARISONS = 3;

const cellId = (cell: Pick<PageTableCell, 'row' | 'col'>): string => `r${cell.row}c${cell.col}`;

const textCell = (table: PageTable, id: string): PageTableCell | null => table.cells.find((cell) => cellId(cell) === id) ?? null;

/** Κελιά διασκορπισμένα στον πίνακα, με σταθερή επιλογή: ίδια σελίδα ⇒ ίδια ερώτηση. */
export function imageCheckCells(table: Pick<PageTable, 'cells'>): readonly PageTableCell[] {
  const amounts = table.cells.filter((cell) => parseEnteredAmount(cell.text.trim()) !== null);
  if (amounts.length <= IMAGE_CHECK_CELLS) return amounts;
  const step = (amounts.length - 1) / (IMAGE_CHECK_CELLS - 1);
  return Array.from({ length: IMAGE_CHECK_CELLS }, (_, index) => amounts[Math.round(index * step)]);
}

/** Διαφωνεί η εικόνα με τη στρώση κειμένου στα μισά κελιά ή περισσότερα; Ό,τι δεν διαβάστηκε στην εικόνα δεν είναι διαφωνία. */
export function textLayerDoubted(table: PageTable, mapping: Pick<RawTableMapping, 'imageCheck'>): boolean {
  const compared = mapping.imageCheck.flatMap(({ cell, seen }) => {
    const printed = textCell(table, cell);
    return printed === null || seen === null || seen.trim() === '' ? [] : [comparableForm(printed.text) === comparableForm(seen)];
  });
  return compared.length >= MIN_IMAGE_COMPARISONS && compared.filter((same) => !same).length * 2 >= compared.length;
}

const lineMappingSchema = (attributeCodes: readonly string[]) => ({
  type: 'object',
  additionalProperties: false,
  required: ['line', 'attribute', 'confidence'],
  properties: {
    line: { type: 'integer' },
    attribute: { type: ['string', 'null'], enum: [...attributeCodes, null] },
    confidence: { type: 'number' },
  },
});

const imageCheckSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cell', 'seen'],
  properties: { cell: { type: 'string' }, seen: { type: ['string', 'null'] } },
};

/** Το strict schema της οικογένειας. Καμία ιδιότητα `value`: η απουσία του είναι το συμβόλαιο. */
export function pageMappingSchema(attributeCodes: readonly string[]): Record<string, unknown> {
  const table = {
    type: 'object',
    additionalProperties: false,
    required: ['table', 'role', 'variantsIn', 'lines', 'imageCheck'],
    properties: {
      table: { type: 'string' },
      role: { type: 'string', enum: PAGE_TABLE_ROLES },
      variantsIn: { type: 'string', enum: VARIANT_ORIENTATIONS },
      lines: { type: 'array', items: lineMappingSchema(attributeCodes) },
      imageCheck: { type: 'array', items: imageCheckSchema },
    },
  };
  return { type: 'object', additionalProperties: false, required: ['tables'], properties: { tables: { type: 'array', items: table } } };
}

export function isRawPageMapping(value: unknown): value is RawPageMapping {
  return typeof value === 'object' && value !== null && Array.isArray((value as { tables?: unknown }).tables);
}

/** Οι οδηγίες δεν εμφανίζονται ποτέ σε άνθρωπο: είναι πρωτόκολλο με το μοντέλο. */
export const PAGE_MAPPING_SYSTEM_PROMPT = [
  'You receive one page of a building-products supplier catalog: its image, and its tables already rebuilt from the PDF.',
  'The values are already read. You never copy, convert or correct a value. You only say what each line of a table means.',
  'Rules:',
  '- Return one entry per table, using its id.',
  '- "role": "variants" when the table lists variants of the product family below. "accessories" for a list of spare parts, valves, controllers or other separate items. "other" for anything else.',
  '- "variantsIn": "columns" when each variant is a column and each row is one property. "rows" when each variant is a row and each column is one property.',
  '- "lines": each line that carries a property. The line number is the row number r for "columns" and the column number c for "rows". "attribute" is the code of the property, or null when no attribute of the family fits. Never force a fit.',
  '- If the same quantity is printed on two lines in different units (W and Btu/h), map both lines to the same attribute.',
  '- If two lines print identifiers, map both to the identifier attribute.',
  '- "confidence" is your honest probability, 0 to 1, that the mapping of that line is correct.',
  '- "imageCheck": for each listed check cell, "seen" is the text you read in that position of the IMAGE, not from the table text. Null when the image is not legible there.',
].join('\n');

const spanNote = ({ rowSpan, colSpan }: PageTableCell): string => {
  const parts = [rowSpan > 1 ? `rows+${rowSpan - 1}` : '', colSpan > 1 ? `cols+${colSpan - 1}` : ''].filter((part) => part !== '');
  return parts.length > 0 ? ` (${parts.join(' ')})` : '';
};

function tableLines(table: PageTable): string {
  const rows = Array.from({ length: table.rowCount }, (_, row) => {
    const cells = table.cells.filter((cell) => cell.row === row && cell.text !== '');
    return cells.length === 0 ? '' : `r${row}: ${cells.map((cell) => `[c${cell.col}${spanNote(cell)}] ${cell.text}`).join(' | ')}`;
  });
  const checks = imageCheckCells(table).map((cell) => `${cellId(cell)}`).join(', ');
  return [`Table ${table.key}:`, ...rows.filter((row) => row !== ''), `Check cells: ${checks}`].join('\n');
}

export function pageMappingPrompt(attributes: readonly PageAttributeSpec[], tables: readonly PageTable[], feedback: readonly string[]): string {
  const parts = ['Attributes of this product family:', attributes.map(attributeLine).join('\n'), ...tables.map(tableLines)];
  return (feedback.length > 0 ? [...parts, `A previous mapping failed these checks. Map the page again:\n${feedback.join('\n')}`] : parts).join('\n\n');
}
