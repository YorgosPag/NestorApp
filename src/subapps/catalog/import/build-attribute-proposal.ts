/**
 * `ExtractedGroup` + ζωντανά ⇒ γραμμές πρότασης με διαφορά ανά πεδίο (ADR-923 §5.5). Καθαρό: οι αναγνώσεις γίνονται στον
 * διακομιστή και έρχονται εδώ έτοιμες.
 *
 * Το **επίπεδο** κάθε τιμής το λέει το σχήμα (`attributeOwnerDepth`): κοινή ιδιότητα που ο προμηθευτής επαναλαμβάνει σε
 * κάθε γραμμή του Excel ανεβαίνει στο μοντέλο μία φορά· αν οι γραμμές διαφωνούν, αυτό είναι εύρημα, όχι σιωπηλή επιλογή.
 * @module subapps/catalog/import/build-attribute-proposal
 */

import type { CatalogSchemaSnapshot } from '../derived/chain-derived';
import type {
  ExtractedCell,
  ExtractedGroup,
  ExtractedRow,
  ImportFieldValue,
  ImportIssue,
  ImportProposalField,
  ImportProposalRow,
  ImportTarget,
} from '../types/catalog-import';
import type { CatalogValueHolderKind, ProductValues } from '../types/product';
import { attributeOwnerDepth, leafDepth } from '../values/attribute-levels';
import { isBareAmountText, parseAttributeText, type ValueTextContext } from '../values/value-text-codec';
import { proposalFieldOf } from './field-diff';
import { attributeValueEquality, importTargetKey, liveSlotValue } from './proposal-values';

/** Ένας ζωντανός φορέας τιμών όπως τον χρειάζεται η διαφορά. */
export interface LiveHolder {
  readonly id: string;
  readonly revision: number;
  readonly values: ProductValues;
}

/** `κάτοχος → κλειδί στόχου → τιμή`: ό,τι έφερε η τελευταία εφαρμοσμένη εισαγωγή. */
export type ImportBaseValues = ReadonlyMap<string, ReadonlyMap<string, ImportFieldValue>>;

export interface AttributeProposalContext {
  readonly schema: CatalogSchemaSnapshot;
  readonly text: ValueTextContext;
  readonly model: LiveHolder | null;
  /** Ποια γραμμή της πηγής είναι ποιο ζωντανό SKU. */
  readonly matches: ReadonlyMap<string, LiveHolder>;
  readonly base: ImportBaseValues;
}

type AttributeTarget = Extract<ImportTarget, { kind: 'attribute' }>;
type AttributeCell = ExtractedCell & { readonly target: AttributeTarget; readonly text: string };

const isAttributeCell = (cell: ExtractedCell): cell is AttributeCell => cell.target.kind === 'attribute' && cell.text !== null;

/** Γυμνός αριθμός + μονάδα στήλης ⇒ το κείμενο που καταλαβαίνει ο κωδικοποιητής. */
const textWithUnit = (cell: AttributeCell): string => (cell.unitCode !== null && isBareAmountText(cell.text) ? `${cell.text} ${cell.unitCode}` : cell.text);

function parseCell(cell: AttributeCell, context: AttributeProposalContext): { readonly value: ImportFieldValue | null; readonly issues: readonly ImportIssue[] } {
  const path = cell.target.attributeId;
  const attribute = context.schema.attributes.get(path);
  if (!attribute) return { value: null, issues: [{ code: 'attributeUnknown', path }] };
  const parsed = parseAttributeText(attribute, textWithUnit(cell), context.text);
  return parsed.ok ? { value: parsed.value, issues: [] } : { value: null, issues: [{ code: parsed.issue, path, params: parsed.params }] };
}

function fieldOf(cell: AttributeCell, holder: LiveHolder | null, context: AttributeProposalContext): ImportProposalField {
  const { value, issues } = parseCell(cell, context);
  const live = holder ? liveSlotValue(holder.values, cell.target) : null;
  const base = (holder && context.base.get(holder.id)?.get(importTargetKey(cell.target))) ?? null;
  const attribute = context.schema.attributes.get(cell.target.attributeId);
  const same = attribute ? attributeValueEquality(attribute, context.schema.registry) : null;
  return proposalFieldOf({ cell, incoming: value, issues, live, base, same });
}

/** Το βάθος-ιδιοκτήτης σε σχέση με το σύνολο: κοινό · τελικό SKU · ενδιάμεσο (υπο-μοντέλο, δηλωμένο όριο της Φάσης 4). */
type CellLevel = 'shared' | 'leaf' | 'unsupported';

function levelOf(cell: AttributeCell, schema: CatalogSchemaSnapshot): CellLevel {
  const { scheme } = schema;
  if (!scheme) return 'leaf';
  const depth = attributeOwnerDepth(scheme, cell.target.attributeId);
  if (depth === 0) return 'shared';
  return depth === leafDepth(scheme) ? 'leaf' : 'unsupported';
}

const attributeCellsOf = (cells: readonly ExtractedCell[]): AttributeCell[] => cells.filter(isAttributeCell);

/** Τα κοινά κελιά, μία φορά ανά στόχο: από τα κοινά της πηγής και από όσα επαναλαμβάνουν οι γραμμές. */
function sharedCellsOf(group: ExtractedGroup, schema: CatalogSchemaSnapshot): { readonly cells: AttributeCell[]; readonly disagreeing: ReadonlySet<string> } {
  const fromRows = group.rows.flatMap((row) => attributeCellsOf(row.cells)).filter((cell) => levelOf(cell, schema) === 'shared');
  const cells = new Map<string, AttributeCell>();
  const disagreeing = new Set<string>();
  for (const cell of [...attributeCellsOf(group.sharedCells), ...fromRows]) {
    const key = importTargetKey(cell.target);
    const first = cells.get(key);
    if (!first) cells.set(key, cell);
    else if (first.text !== cell.text) disagreeing.add(key);
  }
  return { cells: [...cells.values()], disagreeing };
}

function modelRowOf(group: ExtractedGroup, context: AttributeProposalContext): ImportProposalRow | null {
  if (!context.schema.scheme) return null;
  const { cells, disagreeing } = sharedCellsOf(group, context.schema);
  const fields = cells.map((cell): ImportProposalField => {
    const field = fieldOf(cell, context.model, context);
    if (!disagreeing.has(importTargetKey(cell.target))) return field;
    return { ...field, decision: 'pending', issues: [...field.issues, { code: 'sharedDisagrees', path: cell.target.attributeId }] };
  });
  const rowIssues: readonly ImportIssue[] = group.modelCode === null ? [{ code: 'modelCodeMissing', path: 'modelCode' }] : [];
  return holderRow(`model:${group.groupKey}`, 'productModel', context.model, group.modelCode ?? '', fields, rowIssues);
}

function holderRow(
  rowKey: string,
  holderKind: CatalogValueHolderKind,
  holder: LiveHolder | null,
  label: string,
  fields: readonly ImportProposalField[],
  issues: readonly ImportIssue[],
): ImportProposalRow {
  return { rowKey, holderKind, holderId: holder?.id ?? null, expectedRevision: holder?.revision ?? null, action: holder ? 'update' : 'create', label, fields, issues };
}

/** Η ετικέτα γραμμής: η πρώτη `unique` ιδιότητα που έχει τιμή, αλλιώς το κλειδί της γραμμής. */
function rowLabel(row: ExtractedRow, schema: CatalogSchemaSnapshot): string {
  const identifier = attributeCellsOf(row.cells).find((cell) => schema.attributes.get(cell.target.attributeId)?.unique === true);
  return identifier?.text ?? row.rowKey;
}

function variantRowOf(row: ExtractedRow, context: AttributeProposalContext): ImportProposalRow {
  const cells = attributeCellsOf(row.cells);
  const holder = context.matches.get(row.rowKey) ?? null;
  const leaf = cells.filter((cell) => levelOf(cell, context.schema) === 'leaf');
  const unsupported = cells.filter((cell) => levelOf(cell, context.schema) === 'unsupported');
  const issues = unsupported.map((cell): ImportIssue => ({ code: 'levelUnsupported', path: cell.target.attributeId }));
  const fields = leaf.map((cell) => fieldOf(cell, holder, context));
  return holderRow(row.rowKey, 'product', holder, rowLabel(row, context.schema), fields, issues);
}

/** Οι γραμμές της πρότασης: το μοντέλο (αν υπάρχει σχήμα παραλλαγών) και τα SKU του. */
export function buildAttributeRows(group: ExtractedGroup, context: AttributeProposalContext): ImportProposalRow[] {
  const model = modelRowOf(group, context);
  const variants = group.rows.map((row) => variantRowOf(row, context));
  return model ? [model, ...variants] : variants;
}
