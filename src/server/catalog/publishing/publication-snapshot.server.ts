import 'server-only';

/**
 * Το **στιγμιότυπο μιας έκδοσης** (ADR-923 §5.6): όλα τα δεδομένα σε **μία** συναλλαγή μόνο-ανάγνωσης, άρα συνεπή, χωρίς
 * κλειδώματα πάνω σε ό,τι επεξεργάζεται ο χρήστης. Βγάζει έγγραφο διάταξης + κλειδί ιδεμποτίας.
 *
 * ⚠️ Κάθε ερώτημα γράφεται με ρητό `COLLECTIONS.X` (CHECK 3.91: η μεταβλητή συλλογή θα ήταν «μη αναλύσιμη»). Όλα είναι
 *    ισότητες σε `companyId` + `isDeleted`, άρα δεν χρειάζονται σύνθετο δείκτη.
 * @module server/catalog/publishing/publication-snapshot.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import elCatalog from '@/i18n/locales/el/catalog.json';
import enCatalog from '@/i18n/locales/en/catalog.json';
import { localizedTextIn, type LocalizedText } from '@/i18n/localized-text';
import { CATALOG_RENDITION_RECIPE_VERSION } from '@/subapps/catalog/renditions/catalog-renditions';
import { composePublication, type PublicationComposeWords } from '@/subapps/catalog/publishing/compose-publication';
import { collectLayoutAssetIds, type LayoutDocument } from '@/subapps/catalog/publishing/layout-model';
import { formatPublicationDate } from '@/subapps/catalog/publishing/layout-text';
import {
  selectPublicationContent,
  type PublicationDataSet,
  type StoredCategory,
  type StoredFamily,
  type StoredModel,
  type StoredProduct,
} from '@/subapps/catalog/publishing/publication-chapters';
import { publicationInputHash, type DataVersionRef } from '@/subapps/catalog/publishing/publication-input-hash';
import { PUBLICATION_RENDER_SCHEMA_VERSION } from '@/subapps/catalog/publishing/publication-vocabulary';
import type { TableAttribute } from '@/subapps/catalog/table/catalog-table';
import type { StoredCatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { PublicationRecipeDefinition, PublicationReport } from '@/subapps/catalog/types/publication';
import { readActiveByIds, readMeasurementRegistry } from '../catalog-library-reads.server';
import type { CatalogTx, StoredCatalogRecord } from '../catalog-store.server';
import { PublicationRunError, readPublicationPriceSheet, type PublicationPriceSheet } from './publication-prices.server';
import { TYPST_EXPECTED_VERSION } from './typst-engine.server';

/** Ό,τι αλλάζει τα bytes χωρίς να αλλάξουν τα δεδομένα: πρότυπο, μηχανή, συνταγή αποδόσεων εικόνας. */
export const PUBLICATION_RENDER_VERSION = `${PUBLICATION_RENDER_SCHEMA_VERSION}:typst-${TYPST_EXPECTED_VERSION}:renditions-${CATALOG_RENDITION_RECIPE_VERSION}`;

const TRANSLATE: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ catalog: elCatalog }, 'catalog', 'el'),
  en: createBundleTranslate({ catalog: enCatalog }, 'catalog', 'en'),
};

export interface PublicationSnapshot {
  readonly document: LayoutDocument;
  readonly inputHash: string;
  readonly audienceKey: string;
  readonly priced: boolean;
  readonly dataAsOfEpoch: number;
  readonly report: Pick<PublicationReport, 'incompleteSkuCount' | 'unpricedSkuCount'>;
  readonly assets: ReadonlyMap<string, StoredCatalogRecord<CatalogAssetDefinition>>;
}

export function publicationWords(language: HumanLanguage) {
  const t = TRANSLATE[language];
  const text = (value: LocalizedText | undefined, fallback = ''): string => localizedTextIn(value, language) ?? fallback;
  return {
    t,
    text,
    table: {
      text,
      yes: t('common.yes'),
      no: t('common.no'),
      sample: t('families.table.sample'),
      price: t('publishing.document.price'),
      installationPrice: t('publishing.document.installationPrice'),
      askForQuote: t('publishing.document.askForQuote'),
      uncategorized: t('publishing.document.uncategorized'),
    },
    compose: {
      contents: t('publishing.document.contents'),
      codeIndex: t('publishing.document.codeIndex'),
      tablePart: (part, parts) => t('publishing.document.tablePart', { part, parts }),
    } satisfies PublicationComposeWords,
  };
}

async function readActiveOf<T>(scope: CatalogTx, query: FirebaseFirestore.Query): Promise<T[]> {
  const snap = await scope.tx.get(query);
  return snap.docs.map((doc) => doc.data() as T);
}

async function readCatalogData(scope: CatalogTx) {
  const { db, ctx } = scope;
  const of = (name: string) => db.collection(name).where('companyId', '==', ctx.companyId).where('isDeleted', '==', false);
  const [categories, families, attributes, models, products] = await Promise.all([
    readActiveOf<StoredCategory>(scope, of(COLLECTIONS.CATALOG_CATEGORIES)),
    readActiveOf<StoredFamily>(scope, of(COLLECTIONS.CATALOG_FAMILIES)),
    readActiveOf<StoredCatalogRecord<StoredCatalogAttributeDefinition>>(scope, of(COLLECTIONS.CATALOG_ATTRIBUTES)),
    readActiveOf<StoredModel>(scope, of(COLLECTIONS.CATALOG_PRODUCT_MODELS)),
    readActiveOf<StoredProduct>(scope, of(COLLECTIONS.CATALOG_PRODUCTS)),
  ]);
  return { categories, families, attributes, models, products, registry: await readMeasurementRegistry(scope) };
}

function footerOf(recipe: PublicationRecipeDefinition, sheet: PublicationPriceSheet, words: ReturnType<typeof publicationWords>): string {
  const note = words.text(recipe.footerNote);
  const { edition } = sheet;
  const prices = edition
    ? words.t('publishing.document.pricesEdition', { version: edition.versionNumber, date: formatPublicationDate(edition.validFrom, recipe.language) })
    : '';
  return [note, prices].filter((part) => part !== '').join(' · ');
}

function latestEpoch(records: readonly { readonly updatedAt?: string }[]): number {
  const latest = records.reduce((max, record) => Math.max(max, record.updatedAt ? Date.parse(record.updatedAt) : 0), 0);
  return Math.floor(latest / 1000);
}

/** Το έγγραφο και το κλειδί του. `emptyScope` όταν δεν μένει τίποτα να τυπωθεί. */
export async function readPublicationSnapshot(scope: CatalogTx, recipe: PublicationRecipeDefinition, options: { readonly ignoreCompleteness?: boolean } = {}): Promise<PublicationSnapshot> {
  const language = recipe.language;
  const words = publicationWords(language);
  const sheet = await readPublicationPriceSheet(scope, recipe.pricing, language);
  const data = await readCatalogData(scope);
  const attributes = new Map<string, TableAttribute & { readonly id: string; readonly revision: number }>(data.attributes.map((attribute) => [attribute.id, attribute]));
  const dataSet: PublicationDataSet = {
    ...data,
    scope: recipe.scope,
    language,
    attributes,
    words: words.table,
    codec: { registry: data.registry, language, assetIdByCode: new Map(), assetCodeById: new Map(), yes: words.table.yes, no: words.table.no },
    priceOf: sheet.priceOf,
    ignoreCompleteness: options.ignoreCompleteness ?? false,
  };
  const selection = selectPublicationContent(dataSet);
  if (selection.chapters.length === 0) throw new PublicationRunError('emptyScope');
  const title = words.text(recipe.title, recipe.code);
  const document = composePublication({ recipe, title, footer: footerOf(recipe, sheet, words), chapters: selection.chapters, words: words.compose });
  const assets = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', collectLayoutAssetIds(document));
  const assetRefs: DataVersionRef[] = [...assets.values()].map((asset) => ({ key: `asset:${asset.id}:${asset.fileId ?? ''}`, revision: asset.revision }));
  const inputHash = publicationInputHash({
    companyId: scope.ctx.companyId,
    recipe,
    data: [...selection.data, ...assetRefs],
    audienceKey: sheet.audienceKey,
    pricing: sheet.refs,
    renderVersion: PUBLICATION_RENDER_VERSION,
  });
  const dataAsOfEpoch = latestEpoch([...data.products, ...data.models, ...data.families] as readonly { readonly updatedAt?: string }[]);
  return { document, inputHash, audienceKey: sheet.audienceKey, priced: sheet.priceOf !== null, dataAsOfEpoch, report: selection.report, assets };
}
