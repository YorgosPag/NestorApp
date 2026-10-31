/**
 * =============================================================================
 * ΑΠΟ ΤΑ ΑΠΟΘΗΚΕΥΜΕΝΑ ΔΕΔΟΜΕΝΑ ΣΤΑ ΚΕΦΑΛΑΙΑ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-923 §5.2 · §5.6 · §22)
 * =============================================================================
 *
 * Καθαρό: παίρνει ό,τι διάβασε ο διακομιστής σε **ένα** συνεπές στιγμιότυπο και αποφασίζει τι μπαίνει, σε ποιο κεφάλαιο,
 * με ποια σειρά, και τι έμεινε απέξω (ποτέ σιωπηλά: {@link PublicationSelection.report}).
 *
 * 🔑 **Το φρένο πληρότητας** (§5.2): SKU χωρίς το `print:<γλώσσα>` στα πλήρη κανάλια του **δεν** μπαίνει σε έκδοση.
 * 🔑 **§22**: το είδος καταχώρισης της οικογένειας διαβάζεται από τη ρίζα, με το `listingKindOf`. Ίδια συνταγή για όλα
 *    τα είδη· η `productWithInstallation` τυπώνει **δύο** τιμές χωριστά, ποτέ μία ενιαία (Υ5).
 * @module subapps/catalog/publishing/publication-chapters
 */

import type { HumanLanguage } from '@/i18n/languages';
import { compareOrderKeys } from '@/lib/ordering/fractional-index';
import { catalogSortKey } from '../derived/sort-key';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { TableAttribute, PreviewWords } from '../table/catalog-table';
import type { CatalogCategoryDefinition } from '../types/category';
import { listingKindOf, type CatalogFamilyDefinition, type VariantScheme } from '../types/family';
import type { CatalogProductDefinition, CatalogProductModelDefinition } from '../types/product';
import type { CatalogProductDerived } from '../types/product-derived';
import type { PublicationScope } from '../types/publication';
import type { InheritanceLink } from '../values/resolve-inherited';
import { readSlot } from '../values/value-shape';
import { formatAttributeValue, type ValueTextContext } from '../values/value-text-codec';
import type { DataVersionRef } from './publication-input-hash';
import {
  variantModelEntry,
  type ProductGridEntry,
  type PublicationChapter,
  type PublicationEntry,
  type PublicationPriceLookup,
  type PublicationVariant,
  type SimpleProductCard,
} from './publication-entries';

interface Stored {
  readonly id: string;
  readonly revision: number;
}

export type StoredCategory = CatalogCategoryDefinition & Stored & { readonly ancestorIds: readonly string[]; readonly orderKey: string };
export type StoredFamily = CatalogFamilyDefinition & Stored;
export type StoredModel = CatalogProductModelDefinition & Stored;
export type StoredProduct = CatalogProductDefinition & Stored & { readonly derived: Pick<CatalogProductDerived, 'identifier' | 'label' | 'completeChannels' | 'sortKey'> };

export interface PublicationDataSet {
  readonly scope: PublicationScope;
  readonly language: HumanLanguage;
  readonly categories: readonly StoredCategory[];
  readonly families: readonly StoredFamily[];
  readonly attributes: ReadonlyMap<string, TableAttribute & Stored>;
  readonly models: readonly StoredModel[];
  readonly products: readonly StoredProduct[];
  readonly registry: MeasurementRegistry;
  readonly codec: ValueTextContext;
  readonly words: PreviewWords & { readonly price: string; readonly installationPrice: string; readonly askForQuote: string; readonly uncategorized: string };
  readonly priceOf: PublicationPriceLookup | null;
  /** Μόνο η προεπισκόπηση: ο άνθρωπος βλέπει και το ημιτελές. */
  readonly ignoreCompleteness: boolean;
}

export interface PublicationSelection {
  readonly chapters: readonly PublicationChapter[];
  readonly data: readonly DataVersionRef[];
  readonly report: { readonly incompleteSkuCount: number; readonly unpricedSkuCount: number };
}

const UNCATEGORIZED = 'uncategorized';

type ModelGroup = { readonly root: StoredModel; readonly products: StoredProduct[] };

function rootOf(model: StoredModel, models: ReadonlyMap<string, StoredModel>): StoredModel {
  return model.parentId ? models.get(model.parentId) ?? model : model;
}

function linkOf(id: string, kind: InheritanceLink['kind'], record: StoredModel | StoredProduct): InheritanceLink {
  return { id, kind, revision: record.revision, holder: record };
}

function chainOf(product: StoredProduct, models: ReadonlyMap<string, StoredModel>): InheritanceLink[] {
  const direct = product.modelId ? models.get(product.modelId) : undefined;
  const parent = direct?.parentId ? models.get(direct.parentId) : undefined;
  return [...(parent ? [linkOf(parent.id, 'productModel', parent)] : []), ...(direct ? [linkOf(direct.id, 'productModel', direct)] : []), linkOf(product.id, 'product', product)];
}

function inScope(scope: PublicationScope, categoryIds: readonly string[], ids: readonly string[], categories: ReadonlyMap<string, StoredCategory>): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'selection') return scope.entries.some((entry) => ids.includes(entry.id));
  const wanted = new Set(scope.categoryIds);
  return categoryIds.some((id) => wanted.has(id) || (categories.get(id)?.ancestorIds ?? []).some((ancestor) => wanted.has(ancestor)));
}

function chapterIdOf(categoryIds: readonly string[], categories: ReadonlyMap<string, StoredCategory>): string {
  const first = categoryIds.map((id) => categories.get(id)).find((category) => category !== undefined);
  if (!first) return UNCATEGORIZED;
  return first.ancestorIds[0] ?? first.id;
}

function isComplete(product: StoredProduct, language: HumanLanguage): boolean {
  return product.derived.completeChannels.includes(`print:${language}`);
}

const variantOf = (product: StoredProduct, models: ReadonlyMap<string, StoredModel>): PublicationVariant => ({
  id: product.id,
  chain: chainOf(product, models),
  identifier: product.derived.identifier,
  label: product.derived.label,
});

function schemeOf(family: StoredFamily, model: StoredModel): VariantScheme | undefined {
  return family.variantSchemes.find((scheme) => scheme.code === model.variantSchemeCode);
}

/** Η τιμή τοποθέτησης μιας παραλλαγής: το SKU εργασίας της αναφοράς `installationAttributeId` (Υ5). */
function installationPriceOf(data: PublicationDataSet, family: StoredFamily, byProduct: ReadonlyMap<string, StoredProduct>): PublicationPriceLookup | null {
  const attributeId = family.installationAttributeId;
  const attribute = attributeId ? data.attributes.get(attributeId) : undefined;
  const { priceOf } = data;
  if (!attribute || !priceOf) return null;
  return (variantId) => {
    const value = readSlot(byProduct.get(variantId)?.values[attribute.id], attribute, 'print', data.language);
    const target = value?.type === 'reference' ? value.targets.find((candidate) => candidate.kind === 'product') : undefined;
    return target ? priceOf(target.id) : null;
  };
}

function modelEntry(data: PublicationDataSet, group: ModelGroup, family: StoredFamily, models: ReadonlyMap<string, StoredModel>): PublicationEntry | null {
  const scheme = schemeOf(family, group.root);
  if (!scheme) return null;
  const byProduct = new Map(group.products.map((product) => [product.id, product]));
  return variantModelEntry({
    id: group.root.id,
    family,
    scheme,
    model: linkOf(group.root.id, 'productModel', group.root),
    variants: group.products.map((product) => variantOf(product, models)),
    attributeById: data.attributes,
    registry: data.registry,
    language: data.language,
    words: data.words,
    codec: data.codec,
    priceOf: data.priceOf,
    installationPriceOf: installationPriceOf(data, family, byProduct),
    listingKind: listingKindOf(family),
  });
}

function simpleCard(data: PublicationDataSet, product: StoredProduct, family: StoredFamily): SimpleProductCard {
  const lines = family.attributes.flatMap((binding) => {
    const attribute = data.attributes.get(binding.attributeId);
    if (!attribute || attribute.type === 'richText' || attribute.type === 'asset' || attribute.id === family.labelAttributeId) return [];
    const text = formatAttributeValue(attribute, readSlot(product.values[attribute.id], attribute, 'print', data.language), data.codec);
    return text === '' ? [] : [`${data.words.text(attribute.labels, attribute.code)}: ${text}`];
  });
  const image = family.imageAttributeId ? data.attributes.get(family.imageAttributeId) : undefined;
  const asset = image ? readSlot(product.values[image.id], image, 'print', data.language) : undefined;
  return {
    id: product.id,
    title: product.derived.label ?? product.derived.identifier ?? product.id,
    code: product.derived.identifier,
    imageAssetId: asset?.type === 'asset' ? asset.assetIds[0] ?? null : null,
    lines,
    price: data.priceOf ? data.priceOf(product.id) ?? data.words.askForQuote : null,
  };
}

function gridEntry(data: PublicationDataSet, family: StoredFamily, products: readonly StoredProduct[]): ProductGridEntry {
  const ordered = [...products].sort((a, b) => a.derived.sortKey.localeCompare(b.derived.sortKey) || a.id.localeCompare(b.id));
  return { kind: 'productGrid', id: family.id, title: data.words.text(family.labels, family.code), cards: ordered.map((product) => simpleCard(data, product, family)), listingKind: listingKindOf(family) };
}

interface Bucket {
  readonly entries: { readonly entry: PublicationEntry; readonly key: string }[];
}

function bucketOf(buckets: Map<string, Bucket>, id: string): Bucket {
  const bucket = buckets.get(id) ?? { entries: [] };
  buckets.set(id, bucket);
  return bucket;
}

function chapterTitle(id: string, data: PublicationDataSet, categories: ReadonlyMap<string, StoredCategory>): string {
  const category = categories.get(id);
  return category ? data.words.text(category.labels, category.code) : data.words.uncategorized;
}

function toChapters(buckets: ReadonlyMap<string, Bucket>, data: PublicationDataSet, categories: ReadonlyMap<string, StoredCategory>): PublicationChapter[] {
  const chapterOrder = (id: string) => categories.get(id)?.orderKey ?? '';
  const ids = [...buckets.keys()].sort((a, b) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : compareOrderKeys(chapterOrder(a), chapterOrder(b)) || a.localeCompare(b)));
  return ids.map((id) => {
    const entries = [...(buckets.get(id)?.entries ?? [])].sort((a, b) => a.key.localeCompare(b.key) || a.entry.id.localeCompare(b.entry.id));
    return { id, title: chapterTitle(id, data, categories), entries: entries.map((item) => item.entry) };
  });
}

interface Grouped {
  readonly byModel: Map<string, ModelGroup>;
  readonly simpleByFamily: Map<string, StoredProduct[]>;
  readonly incomplete: number;
}

function groupProducts(data: PublicationDataSet, models: ReadonlyMap<string, StoredModel>, categories: ReadonlyMap<string, StoredCategory>): Grouped {
  const byModel = new Map<string, ModelGroup>();
  const simpleByFamily = new Map<string, StoredProduct[]>();
  let incomplete = 0;
  for (const product of data.products) {
    const chain = chainOf(product, models);
    const categoryIds = chain.flatMap((link) => link.holder.categoryIds);
    if (!inScope(data.scope, categoryIds, chain.map((link) => link.id), categories)) continue;
    if (!data.ignoreCompleteness && !isComplete(product, data.language)) { incomplete += 1; continue; }
    const model = product.modelId ? models.get(product.modelId) : undefined;
    if (model) {
      const root = rootOf(model, models);
      const group = byModel.get(root.id) ?? { root, products: [] };
      group.products.push(product);
      byModel.set(root.id, group);
    } else {
      simpleByFamily.set(product.familyId, [...(simpleByFamily.get(product.familyId) ?? []), product]);
    }
  }
  return { byModel, simpleByFamily, incomplete };
}

function dataRefs(grouped: Grouped, data: PublicationDataSet): DataVersionRef[] {
  const products = [...grouped.byModel.values()].flatMap((group) => group.products).concat([...grouped.simpleByFamily.values()].flat());
  const modelIds = new Set(products.flatMap((product) => (product.modelId ? [product.modelId] : [])));
  for (const group of grouped.byModel.values()) modelIds.add(group.root.id);
  const ref = (kind: string, record: Stored) => ({ key: `${kind}:${record.id}`, revision: record.revision });
  return [
    ...products.map((product) => ref('product', product)),
    ...data.models.filter((model) => modelIds.has(model.id)).map((model) => ref('model', model)),
    ...data.families.map((family) => ref('family', family)),
    ...data.categories.map((category) => ref('category', category)),
    ...[...data.attributes.values()].map((attribute) => ref('attribute', attribute)),
  ];
}

function countUnpriced(chapters: readonly PublicationChapter[], words: PublicationDataSet['words']): number {
  let count = 0;
  for (const entry of chapters.flatMap((chapter) => chapter.entries)) {
    if (entry.kind === 'productGrid') count += entry.cards.filter((card) => card.price === words.askForQuote).length;
    else for (const row of entry.preview.rows) {
      if (row.kind === 'attribute' && entry.priceRowIds.has(row.id)) count += (row.cells ?? []).filter((cell) => cell === words.askForQuote).length;
    }
  }
  return count;
}

/** Το σύνολο της έκδοσης: κεφάλαια, εκδόσεις δεδομένων για το κλειδί, και ό,τι έμεινε απέξω. */
export function selectPublicationContent(data: PublicationDataSet): PublicationSelection {
  const models = new Map(data.models.map((model) => [model.id, model]));
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const families = new Map(data.families.map((family) => [family.id, family]));
  const grouped = groupProducts(data, models, categories);
  const buckets = new Map<string, Bucket>();
  for (const group of grouped.byModel.values()) {
    const family = families.get(group.root.familyId);
    const entry = family ? modelEntry(data, group, family, models) : null;
    if (entry) bucketOf(buckets, chapterIdOf(group.root.categoryIds, categories)).entries.push({ entry, key: catalogSortKey(entry.title) });
  }
  for (const [familyId, products] of grouped.simpleByFamily) {
    const family = families.get(familyId);
    if (!family) continue;
    const entry = gridEntry(data, family, products);
    bucketOf(buckets, chapterIdOf(products[0].categoryIds, categories)).entries.push({ entry, key: catalogSortKey(entry.title) });
  }
  const chapters = toChapters(buckets, data, categories);
  return { chapters, data: dataRefs(grouped, data), report: { incompleteSkuCount: grouped.incomplete, unpricedSkuCount: countUnpriced(chapters, data.words) } };
}
