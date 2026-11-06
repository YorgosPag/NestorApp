/**
 * Τι γίνεται όταν η πηγή λέει **δύο πράγματα για την ίδια ιδιότητα** (ADR-923 §5.5.1 Δ3 · Δ4), και ποιο όνομα αξίζει το
 * μοντέλο όταν δεν τυπώνεται (Δ7). Καθαρό.
 *
 * Ένα πεδίο πρότασης αντιστοιχεί σε μία ιδιότητα. Τα επαναλαμβανόμενα κελιά κρίνονται με σειρά:
 *   1. **Ταύτιση με τα ζωντανά:** ο πίνακας της Aries τυπώνει δύο γραμμές «ΚΩΔΙΚΟΣ» (`MFP-34ΤΜ` · `099-01-001`). Κερδίζει ο
 *      κωδικός που κρατά ήδη το SKU, και το άλλο κελί δεν είναι εύρημα: η κράτηση απάντησε.
 *   2. **Ανεξάρτητη επιβεβαίωση:** ίδιο μέγεθος σε δύο μονάδες (1000 W · 3412 Btu/h). Αν συμφωνούν, είναι απόδειξη ότι η μονάδα
 *      διαβάστηκε σωστά. Σφάλμα ×1000 στη μία δεν περνά.
 *   3. Αλλιώς **εύρημα**, με τις άλλες τιμές στο μήνυμα: κανένας κανόνας δεν διαλέγει σιωπηλά.
 * @module subapps/catalog/import/cell-identity
 */

import type { CatalogSchemaSnapshot } from '../derived/chain-derived';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportTarget } from '../types/catalog-import';
import type { AttributeValue, ProductValues } from '../types/product';
import { uniqueValueKey } from '../values/normalize-unique';
import { standardAmountOf } from '../values/standard-amount';
import type { ValueTextContext } from '../values/value-text-codec';
import { IMPORT_UNIT_AGREEMENT_TOLERANCE } from '../vocabulary/catalog-import';
import { attributeValueEquality, importCellText, importTargetKey, liveSlotValue, parseImportCell } from './proposal-values';

export type AttributeTarget = Extract<ImportTarget, { kind: 'attribute' }>;
export type AttributeCell = ExtractedCell & { readonly target: AttributeTarget; readonly text: string };

export const isAttributeCell = (cell: ExtractedCell): cell is AttributeCell => cell.target.kind === 'attribute' && cell.text !== null;

export type NoValueReasonTarget = Extract<ImportTarget, { kind: 'noValueReason' }>;
/** Δήλωση ρητής απουσίας (§23.2 K4): ανήκει σε ιδιότητα, άρα ακολουθεί το ίδιο επίπεδο-ιδιοκτήτη με τις τιμές της. */
export type NoValueReasonCell = ExtractedCell & { readonly target: NoValueReasonTarget; readonly text: string };

export const isNoValueReasonCell = (cell: ExtractedCell): cell is NoValueReasonCell => cell.target.kind === 'noValueReason' && cell.text !== null;

/** Κελί που γράφει σε φορέα τιμών: τιμή ιδιότητας ή λόγος απουσίας της. */
export type HolderCell = AttributeCell | NoValueReasonCell;

interface RepeatContext {
  readonly schema: CatalogSchemaSnapshot;
  readonly text: ValueTextContext;
}

interface ReadCell {
  readonly cell: AttributeCell;
  readonly value: AttributeValue | null;
}

function readCells(cells: readonly AttributeCell[], context: RepeatContext): ReadCell[] {
  return cells.map((cell) => {
    const attribute = context.schema.attributes.get(cell.target.attributeId);
    const parsed = attribute ? parseImportCell(attribute, cell, context.text) : null;
    return { cell, value: parsed?.ok ? parsed.value : null };
  });
}

function agree(left: AttributeValue, right: AttributeValue, attributeId: string, context: RepeatContext): boolean {
  const attribute = context.schema.attributes.get(attributeId);
  if (!attribute) return false;
  const a = standardAmountOf(attribute, left, context.schema.registry);
  const b = standardAmountOf(attribute, right, context.schema.registry);
  if (a === null || b === null) return attributeValueEquality(attribute, context.schema.registry)(left, right);
  return Math.abs(a - b) <= IMPORT_UNIT_AGREEMENT_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));
}

/** Το κελί που λέει ό,τι ήδη ισχύει. Ο μοναδικός κωδικός συγκρίνεται με το κλειδί της κράτησης: οι παύλες δεν κάνουν άλλο κωδικό. */
function matchingLive(reads: readonly ReadCell[], live: AttributeValue | null, attributeId: string, context: RepeatContext): AttributeCell | null {
  const attribute = context.schema.attributes.get(attributeId);
  if (live === null || !attribute) return null;
  const same = attribute.unique
    ? (value: AttributeValue) => uniqueValueKey(value) === uniqueValueKey(live)
    : (value: AttributeValue) => attributeValueEquality(attribute, context.schema.registry)(value, live);
  return reads.find(({ value }) => value !== null && same(value))?.cell ?? null;
}

function settleRepeat(cells: readonly AttributeCell[], values: ProductValues | null, context: RepeatContext): AttributeCell {
  const reads = readCells(cells, context);
  const { attributeId } = cells[0].target;
  const live = values ? liveSlotValue(values, cells[0].target) : null;
  const held = matchingLive(reads, live, attributeId, context);
  if (held) return held;
  const readable = reads.filter((read): read is ReadCell & { readonly value: AttributeValue } => read.value !== null);
  const winner = readable[0]?.cell ?? cells[0];
  const others = cells.filter((cell) => cell !== winner && importCellText(cell) !== importCellText(winner));
  const unanimous = readable.length === reads.length && readable.every(({ value }) => agree(value, readable[0].value, attributeId, context));
  if (others.length === 0 || unanimous) return winner;
  return { ...winner, flags: [...winner.flags, { code: 'attributeRepeated', path: attributeId, params: { others: others.map(importCellText).join(' · ') } }] };
}

/** Ένα κελί ανά στόχο, στη σειρά της πηγής. `values` = τα ζωντανά του φορέα, αν η γραμμή ταυτίστηκε. */
export function settleRepeatedCells(cells: readonly AttributeCell[], values: ProductValues | null, context: RepeatContext): AttributeCell[] {
  const byTarget = new Map<string, AttributeCell[]>();
  for (const cell of cells) {
    const key = importTargetKey(cell.target);
    byTarget.set(key, [...(byTarget.get(key) ?? []), cell]);
  }
  return [...byTarget.values()].map((repeated) => (repeated.length === 1 ? repeated[0] : settleRepeat(repeated, values, context)));
}

const sharedStart = (values: readonly string[]): string => {
  const [first = '', ...rest] = values;
  let length = first.length;
  for (const value of rest) {
    length = Math.min(length, value.length);
    while (length > 0 && value.slice(0, length) !== first.slice(0, length)) length -= 1;
  }
  return first.slice(0, length);
};

const reversed = (text: string): string => [...text].reverse().join('');
const MIN_SUGGESTED_LENGTH = 3;

/** Ο πρώτος μοναδικός κωδικός κάθε γραμμής: η σειρά της πηγής. */
function rowCodes(rows: readonly ExtractedRow[], schema: CatalogSchemaSnapshot): string[] {
  return rows.flatMap((row) => row.cells.filter(isAttributeCell).find((cell) => schema.attributes.get(cell.target.attributeId)?.unique === true)?.text ?? []);
}

/**
 * Ο πίνακας τυπώνει μόνο τίτλο: πρόταση κωδικού μοντέλου από ό,τι μοιράζονται οι κωδικοί των παραλλαγών (`MFP-34ΤΜ` · `MFP-51ΤΜ`
 * ⇒ `MFP-ΤΜ`). Μένει πρόταση: το εύρημα `modelCodeMissing` δεν σβήνει μέχρι να το γράψει άνθρωπος.
 */
export function suggestModelCode(group: Pick<ExtractedGroup, 'rows'>, schema: CatalogSchemaSnapshot): string | null {
  const codes = [...new Set(rowCodes(group.rows, schema))];
  if (codes.length < 2) return null;
  const start = sharedStart(codes).replace(/\d+$/u, '');
  const end = reversed(sharedStart(codes.map((code) => reversed(code.slice(start.length))))).replace(/^\d+/u, '');
  const suggestion = (end.length > 0 ? `${start}${end}` : start).replace(/^[-_.\s]+|[-_.\s]+$/gu, '');
  return suggestion.length >= MIN_SUGGESTED_LENGTH ? suggestion : null;
}
