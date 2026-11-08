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
} from '../types/catalog-import';
import type { CatalogValueHolderKind, NoValueReasons, ProductValues } from '../types/product';
import { attributeOwnerDepth, leafDepth } from '../values/attribute-levels';
import type { ValueTextContext } from '../values/value-text-codec';
import {
  isAttributeCell,
  isNoValueReasonCell,
  isTradeIdentityCell,
  settleRepeatedCells,
  suggestModelCode,
  type AttributeCell,
  type HolderCell,
  type NoValueReasonCell,
} from './cell-identity';
import { sameTradeText, settleTradeCells, tradeFieldOf, type LiveTradeIdentity } from './trade-identity-fields';
import { defaultDecisionOf, proposalFieldOf } from './field-diff';
import {
  attributeValueEquality,
  holdsValue,
  importCellText,
  importTargetKey,
  liveSlotValue,
  parseImportCell,
  parseNoValueReasonText,
  plainValueEquality,
} from './proposal-values';

/** Ένας ζωντανός φορέας τιμών όπως τον χρειάζεται η διαφορά. */
export interface LiveHolder {
  readonly id: string;
  readonly revision: number;
  readonly values: ProductValues;
  readonly noValueReasons: NoValueReasons;
  /** Μάρκα + ταυτότητα εμπορίου (ADR-934 Σ1γ)· στο μοντέλο μόνο η μάρκα. */
  readonly trade: LiveTradeIdentity;
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

function parseCell(cell: AttributeCell, context: AttributeProposalContext): { readonly value: ImportFieldValue | null; readonly issues: readonly ImportIssue[] } {
  const path = cell.target.attributeId;
  const attribute = context.schema.attributes.get(path);
  if (!attribute) return { value: null, issues: [{ code: 'attributeUnknown', path }] };
  const parsed = parseImportCell(attribute, cell, context.text);
  return parsed.ok ? { value: parsed.value, issues: [] } : { value: null, issues: [{ code: parsed.issue, path, params: parsed.params } as ImportIssue] };
}

function fieldOf(cell: AttributeCell, holder: LiveHolder | null, context: AttributeProposalContext): ImportProposalField {
  const { value, issues } = parseCell(cell, context);
  const live = holder ? liveSlotValue(holder.values, cell.target) : null;
  const base = (holder && context.base.get(holder.id)?.get(importTargetKey(cell.target))) ?? null;
  const attribute = context.schema.attributes.get(cell.target.attributeId);
  const same = attribute ? attributeValueEquality(attribute, context.schema.registry) : null;
  return proposalFieldOf({ cell: { ...cell, text: importCellText(cell) }, incoming: value, issues, live, base, same });
}

/**
 * Το πεδίο «λόγος απουσίας» (§23.2 K4 · ETIM xChange Guideline V2.0, κωδικολόγιο 5.20). Η κανονική σύγκριση τριών σημείων, με
 * δύο εξαιρέσεις όταν η ιδιότητα έχει **ζωντανή τιμή** — γιατί η έγκριση εκεί θα την έσβηνε:
 *   - `notApplicable` (NA: «δεν αφορά αυτό το προϊόν») ⇒ `conflict` + `noValueReplacesValue`: απόφαση ανθρώπου, ποτέ σιωπηλά.
 *   - `unknown` (UN: «ο προμηθευτής δεν μπορεί να τη δώσει τώρα») ⇒ `unchanged` + `unknownKeepsValue`: η άγνοια της πηγής δεν
 *     ακυρώνει τη γνώση του καταλόγου — όπως το κενό κελί δεν σβήνει τίποτα. Φαίνεται, απορριμμένο.
 */
function reasonFieldOf(cell: NoValueReasonCell, holder: LiveHolder | null, context: AttributeProposalContext): ImportProposalField {
  const path = cell.target.attributeId;
  const incoming = parseNoValueReasonText(cell.text);
  const issues: ImportIssue[] = incoming ? [] : [{ code: 'noValueReasonUnreadable', path }];
  const liveReason = holder?.noValueReasons[path];
  const live = liveReason ? { type: 'noValueReason' as const, reason: liveReason } : null;
  const base = (holder && context.base.get(holder.id)?.get(importTargetKey(cell.target))) ?? null;
  const field = proposalFieldOf({ cell, incoming, issues, live, base, same: plainValueEquality });
  if (!incoming || live || !holder || !holdsValue(holder.values, path)) return field;
  if (incoming.reason === 'unknown') {
    return { ...field, status: 'unchanged', decision: 'reject', issues: [...field.issues, { code: 'unknownKeepsValue', path }] };
  }
  const flagged = { ...field, status: 'conflict' as const, issues: [...field.issues, { code: 'noValueReplacesValue' as const, path }] };
  return { ...flagged, decision: defaultDecisionOf(flagged) };
}

function holderFieldOf(cell: HolderCell, holder: LiveHolder | null, context: AttributeProposalContext): ImportProposalField {
  if (isTradeIdentityCell(cell)) return tradeFieldOf(cell, { holder, base: holder ? context.base.get(holder.id) : undefined });
  return isNoValueReasonCell(cell) ? reasonFieldOf(cell, holder, context) : fieldOf(cell, holder, context);
}

/** Η διαδρομή του ευρήματος: η ιδιότητα, ή το πεδίο ταυτότητας. */
const cellPathOf = (cell: HolderCell): string => (isTradeIdentityCell(cell) ? cell.target.field : cell.target.attributeId);

/** Το βάθος-ιδιοκτήτης σε σχέση με το σύνολο: κοινό · τελικό SKU · ενδιάμεσο (υπο-μοντέλο, δηλωμένο όριο της Φάσης 4). */
type CellLevel = 'shared' | 'leaf' | 'unsupported';

function levelOf(cell: HolderCell, schema: CatalogSchemaSnapshot): CellLevel {
  const { scheme } = schema;
  if (!scheme) return 'leaf';
  // Η μάρκα ανήκει στο βάθος 0 (Δ1)· GTIN · MPN · «χωρίς GTIN» στην εμπορεύσιμη μονάδα.
  if (isTradeIdentityCell(cell)) return cell.target.field === 'brand' ? 'shared' : 'leaf';
  const depth = attributeOwnerDepth(scheme, cell.target.attributeId);
  if (depth === 0) return 'shared';
  return depth === leafDepth(scheme) ? 'leaf' : 'unsupported';
}

const attributeCellsOf = (cells: readonly ExtractedCell[]): AttributeCell[] => cells.filter(isAttributeCell);
const holderCellsOf = (cells: readonly ExtractedCell[]): HolderCell[] =>
  cells.filter((cell): cell is HolderCell => isAttributeCell(cell) || isNoValueReasonCell(cell) || isTradeIdentityCell(cell));

/** Λένε δύο κελιά το ίδιο; Τα πεδία ταυτότητας κατά κλειδί («DAIKIN» ≡ «Daikin»), τα άλλα κατά κείμενο, όπως πριν. */
const sameText = (left: HolderCell, right: HolderCell): boolean =>
  isTradeIdentityCell(left) && isTradeIdentityCell(right) ? sameTradeText(left.target.field, left.text, right.text) : left.text === right.text;

/** Τα κοινά κελιά, μία φορά ανά στόχο: από τα κοινά της πηγής και από όσα επαναλαμβάνουν οι γραμμές. */
function sharedCellsOf(group: ExtractedGroup, schema: CatalogSchemaSnapshot): { readonly cells: HolderCell[]; readonly disagreeing: ReadonlySet<string> } {
  const fromRows = group.rows.flatMap((row) => holderCellsOf(row.cells)).filter((cell) => levelOf(cell, schema) === 'shared');
  const cells = new Map<string, HolderCell>();
  const disagreeing = new Set<string>();
  for (const cell of [...holderCellsOf(group.sharedCells), ...fromRows]) {
    const key = importTargetKey(cell.target);
    const first = cells.get(key);
    if (!first) cells.set(key, cell);
    else if (!sameText(first, cell)) disagreeing.add(key);
  }
  return { cells: [...cells.values()], disagreeing };
}

function modelRowOf(group: ExtractedGroup, context: AttributeProposalContext): ImportProposalRow | null {
  if (!context.schema.scheme) return null;
  const { cells, disagreeing } = sharedCellsOf(group, context.schema);
  const fields = cells.map((cell): ImportProposalField => {
    const field = holderFieldOf(cell, context.model, context);
    if (!disagreeing.has(importTargetKey(cell.target))) return field;
    return { ...field, decision: 'pending', issues: [...field.issues, { code: 'sharedDisagrees', path: cellPathOf(cell) }] };
  });
  return holderRow(`model:${group.groupKey}`, 'productModel', context.model, group.modelCode ?? '', fields, modelIssues(group, context.schema));
}

function modelIssues(group: ExtractedGroup, schema: CatalogSchemaSnapshot): readonly ImportIssue[] {
  if (group.modelCode !== null) return [];
  const suggestion = suggestModelCode(group, schema);
  return [{ code: 'modelCodeMissing', path: 'modelCode', ...(suggestion === null ? {} : { params: { suggestion } }) }];
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
function rowLabel(rowKey: string, cells: readonly AttributeCell[], schema: CatalogSchemaSnapshot): string {
  const identifier = cells.find((cell) => schema.attributes.get(cell.target.attributeId)?.unique === true);
  return identifier?.text ?? rowKey;
}

function variantRowOf(row: ExtractedRow, context: AttributeProposalContext): ImportProposalRow {
  const holder = context.matches.get(row.rowKey) ?? null;
  const valueCells = settleRepeatedCells(attributeCellsOf(row.cells), holder?.values ?? null, context);
  const cells: HolderCell[] = [...valueCells, ...row.cells.filter(isNoValueReasonCell), ...settleTradeCells(row.cells.filter(isTradeIdentityCell))];
  const leaf = cells.filter((cell) => levelOf(cell, context.schema) === 'leaf');
  const unsupported = cells.filter((cell) => levelOf(cell, context.schema) === 'unsupported');
  const issues = unsupported.map((cell): ImportIssue => ({ code: 'levelUnsupported', path: cellPathOf(cell) }));
  const fields = leaf.map((cell) => holderFieldOf(cell, holder, context));
  return holderRow(row.rowKey, 'product', holder, rowLabel(row.rowKey, valueCells, context.schema), fields, issues);
}

/** Οι γραμμές της πρότασης: το μοντέλο (αν υπάρχει σχήμα παραλλαγών) και τα SKU του. */
export function buildAttributeRows(group: ExtractedGroup, context: AttributeProposalContext): ImportProposalRow[] {
  const model = modelRowOf(group, context);
  const variants = group.rows.map((row) => variantRowOf(row, context));
  return model ? [model, ...variants] : variants;
}
