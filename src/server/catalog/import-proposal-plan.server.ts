import 'server-only';

/**
 * Το **σχέδιο** μιας πρότασης (ADR-923 §5.5): η `ExtractedGroup` απέναντι στα ζωντανά, μέσα σε συναλλαγή. Μόνο αναγνώσεις·
 * τις καθαρές κρίσεις τις κάνουν τα `subapps/catalog/import/*`.
 *
 * **Αντιστοίχιση γραμμής με SKU**, με σειρά: (1) `unique` ιδιότητα μέσα στο σύνολο · (2) κράτηση μοναδικής τιμής
 * (`catalog_unique_values`, ίδιο κλειδί με τον γραφέα) · (3) GTIN, με την κράτηση `@gtin` (ADR-934 Σ1γ Δ3) · (4) συνδυασμός
 * αξόνων. Κωδικός ή GTIN που κρατά SKU **άλλου** μοντέλου δεν ταιριάζει σιωπηλά: γίνεται εύρημα, γιατί η εγγραφή θα έπεφτε
 * πάνω στην κράτηση. Κωδικός και GTIN που δείχνουν σε **διαφορετικά** SKU ⇒ `identityKeysDisagree`, ποτέ σιωπηλή επιλογή.
 * @module server/catalog/import-proposal-plan.server
 */

import { GTIN_RESERVATION_KEY, gtinReservationKeysOf } from '@/subapps/catalog/derived/trade-keys';
import { buildAttributeRows, type ImportBaseValues, type LiveHolder } from '@/subapps/catalog/import/build-attribute-proposal';
import { buildPriceRows, type PriceLineValues } from '@/subapps/catalog/import/build-price-proposal';
import { judgeProposal, proposalAggregateOf, type ProposalVerdict } from '@/subapps/catalog/import/judge-proposal';
import { parseImportCell } from '@/subapps/catalog/import/proposal-values';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportBatchTarget, ImportIssue, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { AttributeValue } from '@/subapps/catalog/types/product';
import type { StoredCatalogProductDefinition, StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import type { DiscountGroupDefinition, StoredPriceListLineDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { axisCombinationKey } from '@/subapps/catalog/values/axis-combination';
import { uniqueValueKey } from '@/subapps/catalog/values/normalize-unique';
import { brandOf, EMPTY_TRADE_IDENTITY, gtinInputOf, tradeIdentityOf } from '@/subapps/catalog/values/trade-identity';
import type { ValueTextContext } from '@/subapps/catalog/values/value-text-codec';
import { axesAtDepth, leafDepth } from '@/subapps/catalog/values/attribute-levels';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { readActiveByIds } from './catalog-library-reads.server';
import { readAggregateReferences, readSchemaSnapshot } from './catalog-product-reads.server';
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
  const parsed = parseImportCell(attribute, { text: cell.text, unitCode: cell.unitCode }, textContextOf(schema));
  return parsed.ok && parsed.value ? { attributeId: cell.target.attributeId, value: parsed.value } : null;
}

function rowUniqueKeys(row: ExtractedRow, schema: CatalogSchemaSnapshot): RowKey[] {
  return row.cells.flatMap((cell) => {
    const parsed = parsedValue(cell, schema);
    const key = parsed && schema.attributes.get(parsed.attributeId)?.unique ? uniqueValueKey(parsed.value) : null;
    return parsed && key ? [{ rowKey: row.rowKey, attributeId: parsed.attributeId, uniqueKey: key }] : [];
  });
}

/** Το κλειδί `@gtin` της γραμμής — ο **ίδιος** κανόνας με τον γραφέα (`gtinReservationKeysOf`)· άκυρο GTIN δεν ταιριάζει τίποτα. */
function rowGtinKey(row: ExtractedRow): RowKey | null {
  const text = row.cells.find((cell) => cell.target.kind === 'tradeIdentity' && cell.target.field === 'gtin')?.text ?? null;
  const uniqueKey = text === null ? undefined : gtinReservationKeysOf({ gtin: gtinInputOf(text) })[GTIN_RESERVATION_KEY];
  return uniqueKey ? { rowKey: row.rowKey, attributeId: GTIN_RESERVATION_KEY, uniqueKey } : null;
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

const asLive = (record: StoredModel | StoredProduct): LiveHolder => ({
  id: record.id,
  revision: record.revision,
  values: record.values,
  noValueReasons: record.noValueReasons,
  // Το μοντέλο κρατά μόνο τη μάρκα (βάθος 0)· GTIN · MPN · «χωρίς GTIN» ζουν στο SKU.
  trade: { brand: brandOf(record), ...('modelId' in record ? tradeIdentityOf(record) : EMPTY_TRADE_IDENTITY) },
});

async function readRootProducts(scope: CatalogTx, root: StoredModel | null): Promise<ReadonlyMap<string, StoredProduct>> {
  if (!root) return new Map();
  const ids = Object.entries(root.derived?.descendants ?? {}).filter(([, entry]) => entry.kind === 'product').map(([id]) => id);
  return readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', ids);
}

interface RowMatch {
  readonly matches: ReadonlyMap<string, LiveHolder>;
  /** rowKey → ο κωδικός κρατιέται από SKU άλλου συνόλου. */
  readonly foreign: ReadonlyMap<string, RowKey>;
  /** rowKey → ευρήματα του GTIN της γραμμής (ξένος κάτοχος · διαφωνία με τον κωδικό). */
  readonly gtinIssues: ReadonlyMap<string, readonly ImportIssue[]>;
}

/**
 * Το τρίτο σκαλί (Δ3): το GTIN της γραμμής απέναντι στην κράτηση `@gtin`. Ταιριάζει γραμμή που δεν ταίριαξε· σε γραμμή που
 * ταίριαξε με τον κωδικό **επιβεβαιώνει** ή διαφωνεί. GTIN ξένου συνόλου ⇒ εύρημα πάντα: η εγγραφή θα έπεφτε στην κράτηση.
 */
async function matchByGtin(
  scope: CatalogTx,
  group: ExtractedGroup,
  root: StoredModel | null,
  products: ReadonlyMap<string, StoredProduct>,
  matches: Map<string, LiveHolder>,
  codeForeign: ReadonlySet<string>,
): Promise<ReadonlyMap<string, readonly ImportIssue[]>> {
  const keys = group.rows.flatMap((row) => rowGtinKey(row) ?? []);
  const holders = await readUniqueHolders(scope, keys);
  const others = await readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', [...holders.values()].map((doc) => doc.holderId));
  const issues = new Map<string, readonly ImportIssue[]>();
  for (const key of keys) {
    const doc = holders.get(uniqueHolderKey(key.attributeId, key.uniqueKey));
    const product = doc ? (products.get(doc.holderId) ?? others.get(doc.holderId)) : undefined;
    if (!product) continue;
    const matched = matches.get(key.rowKey);
    if (product.modelId !== (root?.id ?? null)) issues.set(key.rowKey, [{ code: 'uniqueValueTaken', path: 'gtin' }]);
    else if (matched && matched.id !== product.id) issues.set(key.rowKey, [{ code: 'identityKeysDisagree', path: 'gtin' }]);
    else if (!matched && !codeForeign.has(key.rowKey)) matches.set(key.rowKey, asLive(product));
  }
  return issues;
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
  // Δύο τυπωμένοι κωδικοί στη γραμμή: όταν ο ένας ταυτίζεται, ο άλλος δεν είναι σύγκρουση με ξένο SKU.
  for (const rowKey of matches.keys()) foreign.delete(rowKey);
  const gtinIssues = await matchByGtin(scope, group, root, products, matches, new Set(foreign.keys()));
  const byAxis = new Map([...products.values()].map((product) => [axisCombinationKey(product.values, axesAtDepth(schema.scheme, leafDepth(schema.scheme)), schema.attributes, schema.registry), product]));
  for (const row of group.rows) {
    const key = matches.has(row.rowKey) || foreign.has(row.rowKey) ? null : rowAxisKey(row, schema);
    const product = key === null ? undefined : byAxis.get(key);
    if (product) matches.set(row.rowKey, asLive(product));
  }
  return { matches, foreign, gtinIssues };
}

/** Τα ευρήματα αντιστοίχισης πάνω στις γραμμές: ξένος κωδικός, και ό,τι είπε το GTIN. */
const withMatchIssues = (rows: readonly ImportProposalRow[], { foreign, gtinIssues }: RowMatch): ImportProposalRow[] =>
  rows.map((row) => {
    const key = foreign.get(row.rowKey);
    const found: ImportIssue[] = [...(key ? [{ code: 'uniqueValueTaken' as const, path: key.attributeId }] : []), ...(gtinIssues.get(row.rowKey) ?? [])];
    return found.length > 0 ? { ...row, issues: [...row.issues, ...found] } : row;
  });

async function planAttributes(scope: CatalogTx, target: Extract<ImportBatchTarget, { purpose: 'attributes' }>, group: ExtractedGroup, base: ImportBaseValues): Promise<PlannedProposal> {
  const schema = await readSchemaSnapshot(scope, target.familyId, target.variantSchemeCode);
  const code = group.modelCode === null ? '' : suggestCatalogCode(group.modelCode);
  const modelCode = code === '' ? null : code;
  const root = modelCode === null ? null : await readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', naturalKeyId(scope, 'productModel', modelCode));
  const products = await readRootProducts(scope, root);
  const matched = await matchRows(scope, group, root, products, schema);
  const { matches } = matched;
  const built = buildAttributeRows({ ...group, modelCode }, { schema, text: textContextOf(schema), model: root ? asLive(root) : null, matches, base });
  const input = { rows: withMatchIssues(built, matched), modelCode, familyId: target.familyId, categoryIds: target.categoryIds, holdings: { rootModel: root, products }, schema };
  const refs = await readAggregateReferences(scope, proposalAggregateOf(input));
  const verdict = judgeProposal({ ...input, refs });
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

/** Το μοντέλο που κρατά ήδη τα SKU της ομάδας, αν είναι ένα. Δύο μοντέλα ⇒ καμία απάντηση: τα λέει το `uniqueValueTaken`. */
async function modelOfHeldSkus(scope: CatalogTx, group: ExtractedGroup, schema: CatalogSchemaSnapshot): Promise<StoredModel | null> {
  const keys = group.rows.flatMap((row) => rowUniqueKeys(row, schema));
  const holders = await readUniqueHolders(scope, keys);
  const held = await readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', [...holders.values()].map((doc) => doc.holderId));
  const modelIds = new Set([...held.values()].flatMap((product) => product.modelId ?? []));
  const [modelId] = modelIds;
  return modelIds.size === 1 ? readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', modelId) : null;
}

/**
 * Η ταυτότητα της ομάδας **πριν** από το σχέδιο (§5.5.1 Δ3 · Δ7): ο τυπωμένος κωδικός, αν είναι ζωντανό μοντέλο· αλλιώς το μοντέλο
 * που κρατά ήδη τα SKU της. Ο τιμοκατάλογος της Aries δεν τυπώνει κωδικό μοντέλου: χωρίς αυτό το βήμα όλες οι γραμμές θα ήταν
 * «ξένες». Τρέχει πριν από τη βάση σύγκρισης, ώστε και η σύγκριση τριών σημείων να βλέπει το σωστό μοντέλο.
 */
export async function resolveGroupIdentity(scope: CatalogTx, target: ImportBatchTarget, group: ExtractedGroup): Promise<ExtractedGroup> {
  if (target.purpose !== 'attributes') return group;
  const code = group.modelCode === null ? '' : suggestCatalogCode(group.modelCode);
  if (code !== '' && (await readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', naturalKeyId(scope, 'productModel', code)))) return group;
  const schema = await readSchemaSnapshot(scope, target.familyId, target.variantSchemeCode);
  const model = await modelOfHeldSkus(scope, group, schema);
  return model ? { ...group, modelCode: model.code } : group;
}

/** Το σχέδιο μιας ομάδας απέναντι στα ζωντανά: ίδιο για πρώτη κατασκευή και για επανυπολογισμό. */
export function planProposal(scope: CatalogTx, target: ImportBatchTarget, group: ExtractedGroup, base: ImportBaseValues): Promise<PlannedProposal> {
  return target.purpose === 'attributes' ? planAttributes(scope, target, group, base) : planPrices(scope, target, group);
}

export type { StoredModel, StoredProduct };
