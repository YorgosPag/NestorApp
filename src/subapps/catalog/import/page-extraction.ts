/**
 * Η **ανάγνωση σελίδας PDF** ως συμβόλαιο (ADR-923 §5.5 · §21.3): σχήμα structured output από την οικογένεια, και η
 * μετατροπή της απάντησης στην ουδέτερη `ExtractedGroup[]`. Καθαρό: ο αναλυτής ζει στον διακομιστή.
 *
 * 🔑 Γραμμές `{ attribute, value, … }` με **enum** ιδιοτήτων, όχι ένα πεδίο ανά ιδιότητα: strict schema μένει μικρό όσες
 * ιδιότητες κι αν έχει η οικογένεια, και μια παραλειπόμενη ιδιότητα είναι απλώς κενό κελί.
 * 🔑 Οι τιμές ζητούνται ως **κείμενο όπως τυπώνεται**. Τη σημασία τη δίνει ο ίδιος κωδικοποιητής με το πλέγμα.
 * 🔑 Τα κείμενα περνούν από κανονικοποίηση ελληνικών/λατινικών ομοιόμορφων **εδώ**, πριν δει κανείς άλλος την τιμή.
 *
 * @module subapps/catalog/import/page-extraction
 */

import { normalizeMixedScriptHomoglyphs } from '@/utils/greek-text';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportTarget } from '../types/catalog-import';
import { IMPORT_UNVERIFIED_CONFIDENCE_CAP } from '../vocabulary/catalog-import';
import { ANY_SLOT } from '../types/product';
import { anchorForCell, misalignedCells, type AlignedRow, type PageToken } from './page-tokens';

export const PAGE_EXTRACTION_SCHEMA_NAME = 'catalog_page_extraction';

/** Μία ιδιότητα όπως την περιγράφουμε στο μοντέλο. */
export interface PageAttributeSpec {
  readonly code: string;
  readonly label: string;
  readonly type: string;
  readonly unit: string | null;
  readonly level: 'shared' | 'variant';
  readonly options: readonly string[];
}

export interface RawPageValue {
  readonly value: string | null;
  readonly confidence: number;
  readonly sourceTokens: readonly string[];
}

export interface RawPageCell extends RawPageValue {
  readonly attribute: string;
}

export interface RawPageTable {
  readonly modelCode: RawPageValue;
  readonly shared: readonly RawPageCell[];
  readonly variants: readonly { readonly cells: readonly RawPageCell[] }[];
}

export interface RawPageExtraction {
  readonly tables: readonly RawPageTable[];
}

const valueProperties = {
  value: { type: ['string', 'null'] },
  confidence: { type: 'number' },
  sourceTokens: { type: 'array', items: { type: 'string' } },
};

function cellSchema(attributeCodes: readonly string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['attribute', 'value', 'confidence', 'sourceTokens'],
    properties: { attribute: { type: 'string', enum: attributeCodes }, ...valueProperties },
  };
}

/** Το strict JSON schema της οικογένειας (OpenAI: όλα στο `required`, `additionalProperties: false`, null αντί για απουσία). */
export function pageExtractionSchema(attributeCodes: readonly string[]): Record<string, unknown> {
  const cell = cellSchema(attributeCodes);
  const table = {
    type: 'object',
    additionalProperties: false,
    required: ['modelCode', 'shared', 'variants'],
    properties: {
      modelCode: { type: 'object', additionalProperties: false, required: ['value', 'confidence', 'sourceTokens'], properties: valueProperties },
      shared: { type: 'array', items: cell },
      variants: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['cells'], properties: { cells: { type: 'array', items: cell } } },
      },
    },
  };
  return { type: 'object', additionalProperties: false, required: ['tables'], properties: { tables: { type: 'array', items: table } } };
}

/** Είναι η απάντηση αυτό που ζητήσαμε; Το strict το εγγυάται· ο έλεγχος μένει ζώνη ασφαλείας πριν από κάθε χρήση. */
export function isRawPageExtraction(value: unknown): value is RawPageExtraction {
  return typeof value === 'object' && value !== null && Array.isArray((value as { tables?: unknown }).tables);
}

export interface PageExtractionContext {
  readonly page: number;
  readonly tokens: ReadonlyMap<string, PageToken>;
  readonly attributesByCode: ReadonlyMap<string, CatalogAttributeDefinition & { readonly id: string }>;
}

const clampConfidence = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function cellFrom(raw: RawPageValue, target: ImportTarget, context: PageExtractionContext): ExtractedCell {
  const text = raw.value === null || raw.value.trim() === '' ? null : normalizeMixedScriptHomoglyphs(raw.value.trim());
  const anchor = text === null ? null : anchorForCell(context.page, text, raw.sourceTokens, context.tokens);
  const verified = anchor?.kind === 'page' && anchor.verified === true;
  const stated = clampConfidence(raw.confidence);
  return {
    target,
    text,
    confidence: verified ? stated : Math.min(stated, IMPORT_UNVERIFIED_CONFIDENCE_CAP),
    anchor,
    unitCode: null,
    flags: [],
  };
}

function attributeCell(raw: RawPageCell, context: PageExtractionContext): ExtractedCell | null {
  const attribute = context.attributesByCode.get(raw.attribute);
  if (!attribute) return null;
  return cellFrom(raw, { kind: 'attribute', attributeId: attribute.id, channel: ANY_SLOT, locale: ANY_SLOT }, context);
}

const attributeCells = (raws: readonly RawPageCell[], context: PageExtractionContext): ExtractedCell[] =>
  raws.flatMap((raw) => attributeCell(raw, context) ?? []);

const centerOf = (cell: ExtractedCell): { readonly x: number; readonly y: number } | null => {
  const region = cell.anchor?.kind === 'page' && cell.anchor.verified === true && cell.anchor.regions.length === 1 ? cell.anchor.regions[0] : null;
  return region ? { x: region.x + region.width / 2, y: region.y + region.height / 2 } : null;
};

const attributeIdOf = (cell: ExtractedCell): string | null => (cell.target.kind === 'attribute' ? cell.target.attributeId : null);

function alignedRowOf(row: ExtractedRow): AlignedRow {
  const centers = new Map<string, { readonly x: number; readonly y: number }>();
  for (const cell of row.cells) {
    const attributeId = attributeIdOf(cell);
    const center = centerOf(cell);
    if (attributeId !== null && center !== null) centers.set(attributeId, center);
  }
  return { rowKey: row.rowKey, centers };
}

/** Σημαία σε ό,τι ξεφεύγει από τη στήλη/γραμμή της παραλλαγής του — η σιωπηλή μετατόπιση που δεν πιάνει κανόνας. */
function withAlignmentFlags(rows: readonly ExtractedRow[]): ExtractedRow[] {
  const strays = misalignedCells(rows.map(alignedRowOf));
  return rows.map((row) => {
    const flagged = strays.get(row.rowKey) ?? [];
    return {
      ...row,
      cells: row.cells.map((cell) => {
        const attributeId = attributeIdOf(cell);
        if (attributeId === null || !flagged.includes(attributeId)) return cell;
        return { ...cell, flags: [...cell.flags, { code: 'misaligned' as const, path: attributeId }] };
      }),
    };
  });
}

function groupFromTable(table: RawPageTable, index: number, context: PageExtractionContext): ExtractedGroup {
  const rows = table.variants.map((variant, position): ExtractedRow => ({
    rowKey: `p${context.page}t${index}v${position}`,
    cells: attributeCells(variant.cells, context),
  }));
  const modelCode = cellFrom(table.modelCode, { kind: 'modelCode' }, context).text;
  return {
    groupKey: `page:${context.page}:${index}`,
    modelCode,
    sharedCells: attributeCells(table.shared, context),
    rows: withAlignmentFlags(rows),
    pages: [context.page],
  };
}

export function extractGroupsFromPage(raw: RawPageExtraction, context: PageExtractionContext): ExtractedGroup[] {
  return raw.tables.map((table, index) => groupFromTable(table, index, context));
}

// ── Η εντολή προς το μοντέλο ─────────────────────────────────────────────────

/** Οι οδηγίες δεν εμφανίζονται ποτέ σε άνθρωπο: είναι πρωτόκολλο με το μοντέλο, όχι κείμενο περιβάλλοντος χρήστη. */
export const PAGE_EXTRACTION_SYSTEM_PROMPT = [
  'You read one page of a building-products supplier catalog and return its product tables as JSON.',
  'Rules:',
  '- One entry in "tables" per product table. Each variant is one column or row of the table.',
  '- Copy every value EXACTLY as printed, including units and letter suffixes. Never convert, round or complete.',
  '- An empty table cell is value null. A value printed once for several variants belongs ONLY to the variant under it unless the table visibly merges the cell.',
  '- Keep columns and rows aligned: never shift a value into a neighbouring variant.',
  '- "sourceTokens" lists the ids of the page text tokens you read the value from. Leave it empty if the page has no tokens.',
  '- "confidence" is your honest probability, 0 to 1, that the value is correct.',
  '- Return an empty "tables" array when the page has no product table.',
].join('\n');

function attributeLine(spec: PageAttributeSpec): string {
  const unit = spec.unit ? `, unit ${spec.unit}` : '';
  const options = spec.options.length > 0 ? `, one of: ${spec.options.join(' | ')}` : '';
  return `- ${spec.code} (${spec.level}): ${spec.label} [${spec.type}${unit}${options}]`;
}

/** Το μήνυμα χρήστη: οι ιδιότητες της οικογένειας + τα αριθμημένα κομμάτια κειμένου + (στην επανάληψη) τα ευρήματα. */
export function pageExtractionPrompt(
  attributes: readonly PageAttributeSpec[],
  tokens: readonly PageToken[],
  feedback: readonly string[],
): string {
  const tokenLines = tokens.map((token) => `${token.id}: ${token.text}`).join('\n');
  const parts = [
    'Attributes of this product family:',
    attributes.map(attributeLine).join('\n'),
    tokens.length > 0 ? `Page text tokens:\n${tokenLines}` : 'This page has no text layer. Read the image only.',
  ];
  return (feedback.length > 0 ? [...parts, `A previous reading failed these checks. Read the page again:\n${feedback.join('\n')}`] : parts).join('\n\n');
}
