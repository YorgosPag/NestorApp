import 'server-only';

/**
 * Το **σχέδιο** μιας πρότασης (ADR-923 §5.5): η `ExtractedGroup` απέναντι στα ζωντανά, μέσα σε συναλλαγή. Μόνο αναγνώσεις·
 * τις καθαρές κρίσεις τις κάνουν τα `subapps/catalog/import/*`.
 *
 * **Αντιστοίχιση γραμμής με SKU**, με σειρά: (1) `unique` ιδιότητα μέσα στο σύνολο · (2) κράτηση μοναδικής τιμής
 * (`catalog_unique_values`, ίδιο κλειδί με τον γραφέα) · (3) συνδυασμός αξόνων. Κωδικός που κρατά SKU **άλλου** μοντέλου δεν
 * ταιριάζει σιωπηλά: γίνεται εύρημα, γιατί δημιουργία θα έπεφτε πάνω στην κράτηση.
 * @module server/catalog/import-proposal-plan.server
 */

import { buildAttributeRows, type ImportBaseValues, type LiveHolder } from '@/subapps/catalog/import/build-attribute-proposal';
import { buildPriceRows, type PriceLineValues } from '@/subapps/catalog/import/build-price-proposal';
import { judgeProposal, type ProposalVerdict } from '@/subapps/catalog/import/judge-proposal';
import { mergeFieldsIntoValues } from '@/subapps/catalog/import/proposal-values';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportBatchTarget, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { AttributeValue, CatalogValueHolder } from '@/subapps/catalog/types/product';
import type { StoredCatalogProductDefinition, StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import type { DiscountGroupDefinition, StoredPriceListLineDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { axisCombinationKey } from '@/subapps/catalog/values/axis-combination';
import { uniqueValueKey } from '@/subapps/catalog/values/normalize-unique';
import { parseAttributeText, type ValueTextContext } from '@/subapps/catalog/values/value-text-codec';
import { axesAtDepth, leafDepth } from '@/subapps/catalog/values/attribute-levels';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { readActiveByIds } from './catalog-library-reads.server';
import { collectHolderReferences, readReferenceSnapshot, readSchemaSnapshot } from './catalog-product-reads.server';
import { naturalKeyId, readForUpsert, readOwned, readOwnedOrNull, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';
import { readUniqueHolders, uniqueHolderKey } from './unique-reservations.server';

type StoredModel = StoredCatalogRecord<StoredCatalogProductModelDefinition>;
type StoredProduct = StoredCatalogRecord<StoredCatalogProductDefinition>;

export interface PlannedProposal extends ProposalVerdict {
  readonly familyId: string | null;
  readonly variantSchemeCode: string | null;
  readonly modelCode: string | null;
  readonly priceListVersionId: string | null;
}

/** Ο ναι/όχι σε ουδέτερη μορφή: ο `value-text-codec` δέχεται και τις λέξεις της γλώσσας από τον πίνακά του. */
const textContextOf = (schema: CatalogSchemaSnapshot): ValueTextContext => ({
  registry: schema.registry,
  language: 'el',
  assetIdByCode: new Map(),
  assetCodeById: new Map(),
  yes: 'yes',
  no: 'no',
});

interface RowKey {
  readonly rowKey: string;
  readonly attributeId: string;
  readonly uniqueKey: string;
}

function parsedValue(cell: ExtractedCell, schema: CatalogSchemaSnapshot): { readonly attributeId: string; readonly value: AttributeValue } | null {
  if (cell.target.kind !== 'attribute' || cell.text === null) return null;
  const attribute = schema.attributes.get(cell.target.attributeId);
  if (!attribute) return null;
  const parsed = parseAttributeText(attribute, cell.text, textContextOf(schema));
  return parsed.ok && parsed.value ? { attributeId: cell.target.attributeId, value: parsed.value } : null;
}

function rowUniqueKeys(row: ExtractedRow, schema: CatalogSchemaSnapshot): RowKey[] {
  return row.cells.flatMap((cell) => {
    const parsed = parsedValue(cell, schema);
    const key = parsed && schema.attributes.get(parsed.attributeId)?.unique ? uniqueValueKey(parsed.value) : null;
    return parsed && key ? [{ rowKey: row.rowKey, attributeId: parsed.attributeId, uniqueKey: key }] : [];
  });
}

function rowAxisKey(row: ExtractedRow, schema: CatalogSchemaSnapshot): string | null {
  const axes = axesAtDepth(schema.scheme, leafDepth(schema.scheme));
  if (axes.length === 0) return null;
  const values = Object.fromEntries(row.cells.flatMap((cell) => {
    const parsed = parsedValue(cell, schema);
    return parsed ? [[parsed.attributeId, { '*': { '*': parsed.value } }] as const] : [];
  }));
  return axisCombinationKey(values, axes, schema.attributes, schema.registry);
}

const asLive = (record: StoredModel | StoredProduct): LiveHolder => ({ id: record.id, revision: record.revision, values: record.values });

async function readRootProducts(scope: CatalogTx, root: StoredModel | null): Promise<ReadonlyMap<string, StoredProduct>> {
  if (!root) return new Map();
  const ids = Object.entries(root.derived?.descendants ?? {}).filter(([, entry]) => entry.kind === 'product').map(([id]) => id);
  return readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', ids);
}

interface RowMatch {
  readonly matches: ReadonlyMap<string, LiveHolder>;
  /** rowKey → ο κωδικός κρατιέται από SKU άλλου συνόλου. */
  readonly foreign: ReadonlyMap<string, RowKey>;
}

async function matchRows(scope: CatalogTx, group: ExtractedGroup, root: StoredModel | null, products: ReadonlyMap<string, StoredProduct>, schema: CatalogSchemaSnapshot): Promise<RowMatch> {
  const keys = group.rows.flatMap((row) => rowUniqueKeys(row, schema));
  const holders = await readUniqueHolders(scope, keys);
  const others = await readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', [...holders.values()].map((doc) => doc.holderId));
  const matches = new Map<string, LiveHolder>();
  const foreign = new Map<string, RowKey>();
  for (const key of keys) {
    const doc = holders.get(uniqueHolderKey(key.attributeId, key.uniqueKey));
    const product = doc ? (products.get(doc.holderId) ?? others.get(doc.holderId)) : undefined;
    if (!product || matches.has(key.rowKey)) continue;
    if (product.modelId === (root?.id ?? null)) matches.set(key.rowKey, asLive(product));
    else foreign.set(key.rowKey, key);
  }
  const byAxis = new Map([...products.values()].map((product) => [axisCombinationKey(product.values, axesAtDepth(schema.scheme, leafDepth(schema.scheme)), schema.attributes, schema.registry), product]));
  for (const row of group.rows) {
    const key = matches.has(row.rowKey) || foreign.has(row.rowKey) ? null : rowAxisKey(row, schema);
    const product = key === null ? undefined : byAxis.get(key);
    if (product) matches.set(row.rowKey, asLive(product));
  }
  return { matches, foreign };
}

const withForeignIssue = (rows: readonly ImportProposalRow[], foreign: RowMatch['foreign']): ImportProposalRow[] =>
  rows.map((row) => {
    const key = foreign.get(row.rowKey);
    return key ? { ...row, issues: [...row.issues, { code: 'uniqueValueTaken' as const, path: key.attributeId }] } : row;
  });

const holderOfRow = (row: ImportProposalRow): CatalogValueHolder => ({ values: mergeFieldsIntoValues({}, row.fields, () => true), noValueReasons: {}, categoryIds: [] });

async function planAttributes(scope: CatalogTx, target: Extract<ImportBatchTarget, { purpose: 'attributes' }>, group: ExtractedGroup, base: ImportBaseValues): Promise<PlannedProposal> {
  const schema = await readSchemaSnapshot(scope, target.familyId, target.variantSchemeCode);
  const code = group.modelCode === null ? '' : suggestCatalogCode(group.modelCode);
  const modelCode = code === '' ? null : code;
  const root = modelCode === null ? null : await readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', naturalKeyId(scope, 'productModel', modelCode));
  const products = await readRootProducts(scope, root);
  const { matches, foreign } = await matchRows(scope, group, root, products, schema);
  const built = buildAttributeRows({ ...group, modelCode }, { schema, text: textContextOf(schema), model: root ? asLive(root) : null, matches, base });
  const rows = withForeignIssue(built, foreign);
  const refs = await readReferenceSnapshot(scope, collectHolderReferences(rows.map(holderOfRow)));
  const verdict = judgeProposal({ rows, modelCode, familyId: target.familyId, categoryIds: target.categoryIds, holdings: { rootModel: root, products }, schema, refs });
  return { ...verdict, familyId: target.familyId, variantSchemeCode: target.variantSchemeCode, modelCode, priceListVersionId: null };
}

// ── Η ροή «μόνο τιμές» ───────────────────────────────────────────────────────

async function readLines(scope: CatalogTx, versionId: string, variantIds: readonly string[]): Promise<ReadonlyMap<string, PriceLineValues>> {
  const lines = new Map<string, PriceLineValues>();
  for (const variantId of variantIds) {
    const key = priceListLineKey(versionId, priceLineSubjectKey({ kind: 'variant', variantId }));
    const { current } = await readForUpsert<StoredPriceListLineDefinition>(scope, 'priceListLine', key);
    if (current) lines.set(variantId, current);
  }
  return lines;
}

async function readDiscountGroupIds(scope: CatalogTx, group: ExtractedGroup): Promise<ReadonlyMap<string, string>> {
  const codes = group.rows.flatMap((row) => row.cells).flatMap((cell) =>
    cell.target.kind === 'price' && cell.target.field === 'discountGroup' && cell.text ? [cell.text.trim().toLowerCase()] : [],
  );
  const unique = [...new Set(codes)];
  const ids = new Map(unique.map((code) => [code, naturalKeyId(scope, 'discountGroup', code)]));
  const live = await readActiveByIds<DiscountGroupDefinition>(scope, 'discountGroup', [...ids.values()]);
  return new Map([...ids].filter(([, id]) => live.has(id)));
}

async function variantIdsOf(scope: CatalogTx, group: ExtractedGroup, attributeId: string): Promise<ReadonlyMap<string, string>> {
  const keys = group.rows.flatMap((row): RowKey[] => {
    const text = row.cells.find((cell) => cell.target.kind === 'skuIdentifier')?.text;
    const uniqueKey = text ? uniqueValueKey({ type: 'text', text }) : null;
    return uniqueKey ? [{ rowKey: row.rowKey, attributeId, uniqueKey }] : [];
  });
  const holders = await readUniqueHolders(scope, keys);
  return new Map(keys.flatMap((key) => {
    const doc = holders.get(uniqueHolderKey(attributeId, key.uniqueKey));
    return doc ? [[key.rowKey, doc.holderId] as const] : [];
  }));
}

async function planPrices(scope: CatalogTx, target: Extract<ImportBatchTarget, { purpose: 'priceLines' }>, group: ExtractedGroup): Promise<PlannedProposal> {
  const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', target.priceListVersionId);
  const variantIdByRow = await variantIdsOf(scope, group, target.identifierAttributeId);
  const variantIds = [...new Set(variantIdByRow.values())];
  const liveLines = await readLines(scope, version.id, variantIds);
  const baseLines = version.basedOnVersionId === null ? new Map() : await readLines(scope, version.basedOnVersionId, variantIds);
  const discountGroupIdByCode = await readDiscountGroupIds(scope, group);
  const rows = buildPriceRows(group, { variantIdByRow, liveLines, baseLines, discountGroupIdByCode });
  return { rows, violations: [], familyId: null, variantSchemeCode: null, modelCode: null, priceListVersionId: version.id };
}

/** Το σχέδιο μιας ομάδας απέναντι στα ζωντανά: ίδιο για πρώτη κατασκευή και για επανυπολογισμό. */
export function planProposal(scope: CatalogTx, target: ImportBatchTarget, group: ExtractedGroup, base: ImportBaseValues): Promise<PlannedProposal> {
  return target.purpose === 'attributes' ? planAttributes(scope, target, group, base) : planPrices(scope, target, group);
}

export type { StoredModel, StoredProduct };
