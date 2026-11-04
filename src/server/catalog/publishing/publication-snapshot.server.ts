import 'server-only';

/**
 * Το **στιγμιότυπο μιας έκδοσης** (ADR-923 §5.6): όλα τα δεδομένα σε **μία** συναλλαγή μόνο-ανάγνωσης, άρα συνεπή, χωρίς
 * κλειδώματα πάνω σε ό,τι επεξεργάζεται ο χρήστης. Βγάζει έγγραφο διάταξης + κλειδί ιδεμποτίας.
 *
 * Ο κατάλογος του χώρου διαβάζεται από τον έναν αναγνώστη `readCatalogDataSet`, τον ίδιο με την εξαγωγή xChange.
 * @module server/catalog/publishing/publication-snapshot.server
 */

import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import elCatalog from '@/i18n/locales/el/catalog.json';
import enCatalog from '@/i18n/locales/en/catalog.json';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { CATALOG_RENDITION_RECIPE_VERSION } from '@/subapps/catalog/renditions/catalog-renditions';
import { composePublication, type PublicationComposeWords } from '@/subapps/catalog/publishing/compose-publication';
import { collectLayoutAssetIds, type LayoutDocument, type LayoutQrCode } from '@/subapps/catalog/publishing/layout-model';
import { productsInScope, selectPublicationContent, type PublicationDataSet, type StoredProduct } from '@/subapps/catalog/publishing/publication-chapters';
import { publicationFontRefusal } from '@/subapps/catalog/publishing/publication-font-rights';
import { publicationInputHash, type DataVersionRef } from '@/subapps/catalog/publishing/publication-input-hash';
import { priceEditionLine, type PriceEditionWords } from '@/subapps/catalog/publishing/publication-price-edition';
import { priceChangesEntry, type PriceChangeWords, type PublicationPriceChange } from '@/subapps/catalog/publishing/publication-price-changes';
import { linkableModelIds, publicationQrCode } from '@/subapps/catalog/publishing/publication-qr';
import { PUBLICATION_RENDER_SCHEMA_VERSION } from '@/subapps/catalog/publishing/publication-vocabulary';
import type { PublicationChapter } from '@/subapps/catalog/publishing/publication-entries';
import type { TableAttribute } from '@/subapps/catalog/table/catalog-table';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { PublicationFailure, PublicationRecipeDefinition, PublicationReport } from '@/subapps/catalog/types/publication';
import { readCatalogDataSet, type CatalogDataSet } from '../catalog-dataset-reads.server';
import { readActiveByIds } from '../catalog-library-reads.server';
import { readOwnedEvenDeleted, type CatalogTx, type StoredCatalogRecord } from '../catalog-store.server';
import type { PublicationLinkReader, PublicationLinks } from './publication-links.server';
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
  readonly report: Pick<PublicationReport, 'incompleteSkuCount' | 'unpricedSkuCount' | 'fencedPriceChangeCount'>;
  readonly assets: ReadonlyMap<string, StoredCatalogRecord<CatalogAssetDefinition>>;
  /** Οι όψεις της γραμματοσειράς προμηθευτή· κενό ⇒ της πλατφόρμας. */
  readonly fonts: readonly StoredCatalogRecord<CatalogAssetDefinition>[];
  /** Η έκδοση δεν επιτρέπεται να αποδοθεί (§5.13 Σ7, απόφαση 4). Ο εκτελεστής τη ρίχνει πριν από τη μηχανή. */
  readonly refusal: Extract<PublicationFailure, 'qrOriginNotPublic'> | null;
}

export function publicationWords(language: HumanLanguage) {
  const t = TRANSLATE[language];
  const text = (value: LocalizedText | undefined, fallback = ''): string => resolveLocalizedText(value, language) || fallback;
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
    qrCaption: t('publishing.document.qrCaption'),
    priceEdition: {
      open: (version, from) => t('publishing.document.pricesEdition', { version, date: from }),
      closed: (version, from, until) => t('publishing.document.pricesEditionClosed', { version, from, until }),
    } satisfies PriceEditionWords,
    comparison: (before: string, after: string) => t('publishing.document.changes.comparison', { before, after }),
  };
}

function footerOf(recipe: PublicationRecipeDefinition, sheet: PublicationPriceSheet, words: ReturnType<typeof publicationWords>): string {
  const note = words.text(recipe.footerNote);
  const { edition } = sheet;
  const prices = edition ? priceEditionLine(edition, recipe.language, words.priceEdition) : '';
  return [note, prices].filter((part) => part !== '').join(' · ');
}

/** Η άρνηση της αποθήκευσης ξανακρίνεται εδώ, γιατί ένα μέσο μπορεί να διαγράφηκε ή να άλλαξε αρχείο μετά: ποτέ σιωπηλά η άλλη γραμματοσειρά. */
async function readRecipeFonts(scope: CatalogTx, recipe: PublicationRecipeDefinition): Promise<PublicationSnapshot['fonts']> {
  const ids = recipe.theme.fontAssetIds ?? [];
  if (ids.length === 0) return [];
  const assets = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', ids);
  const fonts = ids.flatMap((id) => assets.get(id) ?? []);
  if (fonts.length !== ids.length || publicationFontRefusal(fonts, recipe.language) !== null) throw new PublicationRunError('fontMissing');
  return fonts;
}

/** Τα σύμβολα των QR: ένα ανά μοντέλο που έχει δημόσια διεύθυνση. */
function qrCodesOf(links: PublicationLinks, caption: string): ReadonlyMap<string, LayoutQrCode> {
  return new Map([...links.urls].map(([modelId, url]) => [modelId, publicationQrCode(url, caption)]));
}

/** Ό,τι μπαίνει στο κλειδί: οι διευθύνσεις, ή τα μοντέλα της άρνησης, ώστε η αρνημένη έκδοση να μη μοιάζει με έκδοση χωρίς QR. */
const linkKeysOf = (links: PublicationLinks): string[] => [...links.urls.values(), ...links.refusedModelIds.map((id) => `refused:${id}`)];

const assetRefOf = (asset: StoredCatalogRecord<CatalogAssetDefinition>): DataVersionRef => ({ key: `asset:${asset.id}:${asset.fileId ?? ''}`, revision: asset.revision });

function changeWords(t: BundleTranslate, askForQuote: string): PriceChangeWords {
  return {
    title: t('publishing.document.changes.title'),
    groups: { added: t('publishing.document.changes.added'), removed: t('publishing.document.changes.removed'), raised: t('publishing.document.changes.raised'), lowered: t('publishing.document.changes.lowered') },
    before: t('publishing.document.changes.before'),
    after: t('publishing.document.changes.after'),
    change: t('publishing.document.changes.change'),
    noPrice: askForQuote,
  };
}

/** Τα SKU της σύγκρισης, και όσα διαγράφηκαν: η κατάργηση ονομάζει ό,τι δεν υπάρχει πια στον ενεργό κατάλογο. Μέσα στο εύρος της συνταγής μόνο. */
async function changedProducts(scope: CatalogTx, changes: readonly PublicationPriceChange[], dataSet: PublicationDataSet): Promise<readonly StoredProduct[]> {
  const active = new Map(dataSet.products.map((product) => [product.id, product]));
  const found = await Promise.all(changes.map(async ({ variantId }) => active.get(variantId) ?? await readOwnedEvenDeleted(scope, 'product', variantId) as StoredProduct | null));
  return productsInScope(dataSet, found.filter((product): product is StoredProduct => product !== null));
}

/** «Πριν: … · Τώρα: …» με τις δύο εκδόσεις γραμμένες όπως στο υποσέλιδο (ίδια συνάρτηση). Κενό όταν δεν υπάρχει σύγκριση. */
function comparisonOf(sheet: PublicationPriceSheet, words: ReturnType<typeof publicationWords>, language: HumanLanguage): string {
  if (!sheet.edition || !sheet.compareEdition) return '';
  return words.comparison(priceEditionLine(sheet.compareEdition, language, words.priceEdition), priceEditionLine(sheet.edition, language, words.priceEdition));
}

async function changesChapter(scope: CatalogTx, sheet: PublicationPriceSheet, dataSet: PublicationDataSet, words: ReturnType<typeof publicationWords>) {
  const { changes } = sheet;
  const products = await changedProducts(scope, changes, dataSet);
  const names = new Map(products.map((product) => [product.id, { code: product.derived.identifier, label: product.derived.label }]));
  const entry = priceChangesEntry({ changes, names, words: changeWords(words.t, words.table.askForQuote), comparison: comparisonOf(sheet, words, dataSet.language), language: dataSet.language });
  const chapter: PublicationChapter | null = entry ? { id: entry.id, title: entry.title, entries: [entry] } : null;
  return { chapter, fencedCount: changes.filter((change) => change.fenced && names.has(change.variantId)).length };
}

function latestEpoch(records: readonly { readonly updatedAt?: string }[]): number {
  const latest = records.reduce((max, record) => Math.max(max, record.updatedAt ? Date.parse(record.updatedAt) : 0), 0);
  return Math.floor(latest / 1000);
}

/** Το έγγραφο και το κλειδί του. `emptyScope` όταν δεν μένει τίποτα να τυπωθεί. */
function dataSetOf(
  recipe: PublicationRecipeDefinition,
  data: CatalogDataSet,
  context: { readonly words: ReturnType<typeof publicationWords>; readonly priceOf: PublicationDataSet['priceOf']; readonly ignoreCompleteness: boolean },
): PublicationDataSet {
  const { language } = recipe;
  const { words } = context;
  const attributes = new Map<string, TableAttribute & { readonly id: string; readonly revision: number }>(data.attributes.map((attribute) => [attribute.id, attribute]));
  return {
    ...data,
    scope: recipe.scope,
    language,
    attributes,
    words: words.table,
    codec: { registry: data.registry, language, assetIdByCode: new Map(), assetCodeById: new Map(), yes: words.table.yes, no: words.table.no },
    priceOf: context.priceOf,
    ignoreCompleteness: context.ignoreCompleteness,
  };
}

export interface PublicationSnapshotOptions {
  /** Ποια μοντέλα παίρνουν QR και πού δείχνουν (§5.13 Σ7). Υποχρεωτικό: η έκδοση χωρίς QR είναι ρητή επιλογή του καλούντα. */
  readonly links: PublicationLinkReader;
  readonly ignoreCompleteness?: boolean;
}

export async function readPublicationSnapshot(scope: CatalogTx, recipe: PublicationRecipeDefinition, options: PublicationSnapshotOptions): Promise<PublicationSnapshot> {
  const language = recipe.language;
  const words = publicationWords(language);
  const sheet = await readPublicationPriceSheet(scope, recipe.pricing, language);
  const data = await readCatalogDataSet(scope);
  const dataSet = dataSetOf(recipe, data, { words, priceOf: sheet.priceOf, ignoreCompleteness: options.ignoreCompleteness ?? false });
  const selection = selectPublicationContent(dataSet);
  if (selection.chapters.length === 0) throw new PublicationRunError('emptyScope');
  const title = words.text(recipe.title, recipe.code);
  const changes = await changesChapter(scope, sheet, dataSet, words);
  const fonts = await readRecipeFonts(scope, recipe);
  const links = await options.links(linkableModelIds(selection.chapters));
  const document = composePublication({
    recipe, title, footer: footerOf(recipe, sheet, words), supplierFontFamily: fonts[0]?.font?.family, chapters: changes.chapter ? [changes.chapter, ...selection.chapters] : selection.chapters, words: words.compose, qrCodes: qrCodesOf(links, words.qrCaption),
  });
  const assets = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', collectLayoutAssetIds(document));
  const assetRefs = [...assets.values(), ...fonts].map(assetRefOf);
  const inputHash = publicationInputHash({
    companyId: scope.ctx.companyId,
    recipe,
    data: [...selection.data, ...assetRefs],
    audienceKey: sheet.audienceKey,
    pricing: sheet.refs,
    renderVersion: PUBLICATION_RENDER_VERSION,
    links: linkKeysOf(links),
  });
  const dataAsOfEpoch = latestEpoch([...data.products, ...data.models, ...data.families] as readonly { readonly updatedAt?: string }[]);
  const refusal = links.refusedModelIds.length > 0 ? 'qrOriginNotPublic' : null;
  return { document, inputHash, audienceKey: sheet.audienceKey, priced: sheet.priceOf !== null, dataAsOfEpoch, report: { ...selection.report, fencedPriceChangeCount: changes.fencedCount }, assets, fonts, refusal };
}
