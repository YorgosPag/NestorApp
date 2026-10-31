/**
 * Η ροή **«μόνο τιμές»** (ADR-923 §5.5 · §5.4): γραμμές αρχείου ⇒ γραμμές πρότασης για πρόχειρη έκδοση τιμοκαταλόγου.
 * Αγγίζει **μόνο** τιμές: ποτέ περιγραφή, ποτέ ιδιότητα.
 *
 * Η σύγκριση τριών σημείων έχει εδώ φυσική βάση: **βάση** = η έκδοση από την οποία σπάρθηκε η πρόχειρη · **ζωντανή** = η
 * πρόχειρη. Τιμή που άλλαξε χέρι μέσα στην πρόχειρη **και** το αρχείο τη λέει αλλιώς ⇒ σύγκρουση, όχι σιωπηλή αντικατάσταση.
 * Γραμμή που λείπει από το αρχείο **μένει** όπως είναι: η απουσία δεν είναι διαγραφή.
 * @module subapps/catalog/import/build-price-proposal
 */

import { minorFromMajor } from '@/lib/money/money';
import type {
  ExtractedCell,
  ExtractedGroup,
  ExtractedRow,
  ImportIssue,
  ImportPriceValue,
  ImportProposalField,
  ImportProposalRow,
} from '../types/catalog-import';
import type { PriceListLineDefinition } from '../types/price-list';
import { isPriceQuantity } from '../vocabulary/pricing';
import type { ImportPriceField } from '../vocabulary/catalog-import';
import { parseEnteredAmount } from '../values/decimal-amount';
import { proposalFieldOf } from './field-diff';
import { plainValueEquality } from './proposal-values';

export type PriceLineValues = Pick<PriceListLineDefinition, 'netPrice' | 'priceQuantity' | 'unitCode' | 'discountGroupId'>;

export interface PriceProposalContext {
  /** rowKey → id SKU. Απών ⇒ ο κωδικός δεν βρέθηκε. */
  readonly variantIdByRow: ReadonlyMap<string, string>;
  /** variantId → τρέχουσα γραμμή της πρόχειρης. */
  readonly liveLines: ReadonlyMap<string, PriceLineValues>;
  /** variantId → γραμμή της έκδοσης-βάσης. */
  readonly baseLines: ReadonlyMap<string, PriceLineValues>;
  readonly discountGroupIdByCode: ReadonlyMap<string, string>;
}

type Parsed = { readonly value: ImportPriceValue | null; readonly issues: readonly ImportIssue[] };

const failed = (code: ImportIssue['code'], path: ImportPriceField): Parsed => ({ value: null, issues: [{ code, path } as ImportIssue] });

function parseMoney(text: string): Parsed {
  const amount = parseEnteredAmount(text.replace(/\s*€\s*/g, ''));
  const minor = amount ? minorFromMajor(amount.value) : null;
  return minor === null ? failed('priceAmountInvalid', 'netPrice') : { value: { type: 'money', minor }, issues: [] };
}

function parseQuantity(text: string): Parsed {
  const quantity = Number(text.trim());
  return isPriceQuantity(quantity) ? { value: { type: 'priceQuantity', quantity }, issues: [] } : failed('priceQuantityInvalid', 'priceQuantity');
}

function parseDiscountGroup(text: string, context: PriceProposalContext): Parsed {
  const discountGroupId = context.discountGroupIdByCode.get(text.trim().toLowerCase());
  return discountGroupId ? { value: { type: 'discountGroup', discountGroupId }, issues: [] } : failed('unknownReference', 'discountGroup');
}

function parsePrice(field: ImportPriceField, text: string, context: PriceProposalContext): Parsed {
  switch (field) {
    case 'netPrice':
      return parseMoney(text);
    case 'priceQuantity':
      return parseQuantity(text);
    case 'unitCode':
      return { value: { type: 'unit', unitCode: text.trim() }, issues: [] };
    case 'discountGroup':
      return parseDiscountGroup(text, context);
  }
}

function lineFieldValue(field: ImportPriceField, line: PriceLineValues | undefined): ImportPriceValue | null {
  if (!line) return null;
  switch (field) {
    case 'netPrice':
      return { type: 'money', minor: line.netPrice };
    case 'priceQuantity':
      return { type: 'priceQuantity', quantity: line.priceQuantity };
    case 'unitCode':
      return { type: 'unit', unitCode: line.unitCode };
    case 'discountGroup':
      return { type: 'discountGroup', discountGroupId: line.discountGroupId };
  }
}

type PriceCell = ExtractedCell & { readonly target: { readonly kind: 'price'; readonly field: ImportPriceField }; readonly text: string };

const isPriceCell = (cell: ExtractedCell): cell is PriceCell => cell.target.kind === 'price' && cell.text !== null;

function priceField(cell: PriceCell, variantId: string | null, context: PriceProposalContext): ImportProposalField {
  const { value, issues } = parsePrice(cell.target.field, cell.text, context);
  const live = lineFieldValue(cell.target.field, variantId === null ? undefined : context.liveLines.get(variantId));
  const base = lineFieldValue(cell.target.field, variantId === null ? undefined : context.baseLines.get(variantId));
  return proposalFieldOf({ cell, incoming: value, issues, live, base, same: plainValueEquality });
}

/** Νέα γραμμή χωρίς τιμή ή μονάδα δεν μπορεί να γεννηθεί: το λέμε στην πρόταση, όχι στην έγκριση. */
function completenessIssues(cells: readonly PriceCell[], existing: boolean): ImportIssue[] {
  if (existing) return [];
  const present = new Set(cells.map((cell) => cell.target.field));
  const required: readonly ImportPriceField[] = ['netPrice', 'unitCode'];
  return required.filter((field) => !present.has(field)).map((field): ImportIssue => ({ code: 'priceIncomplete', path: field }));
}

function rowOf(row: ExtractedRow, context: PriceProposalContext): ImportProposalRow {
  const variantId = context.variantIdByRow.get(row.rowKey) ?? null;
  const label = row.cells.find((cell) => cell.target.kind === 'skuIdentifier')?.text ?? row.rowKey;
  const cells = row.cells.filter(isPriceCell);
  const existing = variantId !== null && context.liveLines.has(variantId);
  const unknown: readonly ImportIssue[] = variantId === null ? [{ code: 'skuUnknown', path: 'skuIdentifier', params: { code: label } }] : [];
  const fields = cells.map((cell) => priceField(cell, variantId, context));
  return {
    rowKey: row.rowKey,
    holderKind: 'product',
    holderId: variantId,
    expectedRevision: null,
    action: existing ? 'update' : 'create',
    label,
    fields: variantId === null ? fields.map((field) => ({ ...field, decision: 'reject' as const })) : fields,
    issues: [...unknown, ...completenessIssues(cells, existing)],
  };
}

export function buildPriceRows(group: ExtractedGroup, context: PriceProposalContext): ImportProposalRow[] {
  return group.rows.map((row) => rowOf(row, context));
}
