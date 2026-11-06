import 'server-only';

/**
 * **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΒΙΤΡΙΝΑΣ** (ADR-923 §5.13 Δ4 · Σ4, σχέδιο §4.5).
 *
 * 🔑 Κάθε ανάγνωση περνά από `unstable_cache` με tags: το Admin SDK δεν περνά από `fetch`, άρα χωρίς tag η ανάκληση δεν
 *    φτάνει τη σελίδα.
 * 🔒 **Πύλη πριν από το περιεχόμενο:** χωρίς έγκυρη βιτρίνα δεν διαβάζεται κανένα μοντέλο. Έτσι η ανάκληση μετρά στη σελίδα
 *    πριν αδειάσουν τα έγγραφα.
 * 🔑 Βλάβη ανάγνωσης ρίχνει: το `unstable_cache` δεν κρατά εξαίρεση, και η σελίδα τη δηλώνει 5xx, ποτέ 404.
 * ⚠️ Κανένας σύνθετος δείκτης: ισότητα και `array-contains` με δρομέα κατά id λύνονται από τους αυτόματους.
 *
 * @module services/public-catalog/public-catalog.reader
 */

import { FieldPath, type Query } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';

import { COLLECTIONS } from '@/config/firestore-collections';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { coverageOutline } from '@/lib/agency/coverage-geometry';
import { servedAdminAreas } from '@/lib/agency/coverage-served-areas';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { readCanonicalAlias } from '@/lib/workspace/workspace-segment';
import { publicCatalogCompanyTag, publicCatalogModelTag } from '@/server/catalog/public/public-catalog-cache-tag';
import { readActiveSupplierBrands } from '@/server/catalog/supplier-brand-claim.server';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import { readAdminAreaDeclarationSources } from '@/services/places/admin-boundaries.reader';
import { readAdminIdentitySources } from '@/services/places/administrative-hierarchy.reader';
import { publicCatalogModelFromDocument, publicCategoryLabelsFromField, publicModelAddressFromDocument } from '@/subapps/catalog/public/public-catalog-from-document';
import { publicCategoryRoute, publicModelRoute, publicProjectRoute, publicSegmentOf, publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { publicModelCardOf, publicModelTitle, type PublicModelCard } from '@/subapps/catalog/public/public-model-card';
import { NO_PROVIDER_FACTS, publicProviderFactsOf, type PublicProviderFacts } from '@/subapps/catalog/public/public-provider-facts';
import { publicProjectTitle, publicSupplierProfileFromDocument, type PublicSupplierProfile } from '@/subapps/catalog/public/public-supplier-profile';
import { supplierShowcaseFromDocument } from '@/subapps/catalog/public/supplier-showcase-from-document';
import type { PublicSupplierBrand } from '@/subapps/catalog/types/supplier-brand-claim';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';
import type { DeclaredCoverage } from '@/types/agency-coverage';

/** Δίχτυ για χαμένη ακύρωση, όχι ο μηχανισμός: αυτός είναι το tag. Ίδιο με το `max-age` του δημόσιου ραφιού. */
const REVALIDATE_SECONDS = 300;
export const PUBLIC_MODEL_PAGE_SIZE = 48;
/** Σελίδα του ευρετηρίου κατηγοριών (Ν9γ): μόνο το `categoryLabels`, άρα μικρή απάντηση ανά σελίδα. */
export const CATEGORY_INDEX_PAGE = 500;
/** Όριο προσοχής, όχι αποκοπής: πάνω από αυτό ένα συγκεντρωτικό έγγραφο του γραφέα θα ήταν φθηνότερο. */
const CATEGORY_INDEX_WARN = 20_000;
/** Το όριο του πρωτοκόλλου sitemaps ανά αρχείο. */
export const MAX_SITEMAP_PATHS = 50_000;

const logger = createModuleLogger('public-catalog-reader');

export interface PublicModelPage {
  readonly cards: readonly PublicModelCard[];
  readonly nextAfter: string | null;
}

export type PublicCategoryIndex = Readonly<Record<string, LocalizedText>>;

export interface PublicModelPageRequest {
  readonly categoryId: string | null;
  readonly after: string | null;
}

const models = () => getAdminFirestore().collection(COLLECTIONS.PUBLIC_CATALOG_MODELS);

/**
 * Η ΜΙΑ μνήμη της βιτρίνας: ίδιο πρόθεμα κλειδιού, ίδιο παράθυρο. Την ζητούν και οι ανώνυμες τιμές (Σ6), που προσθέτουν το
 * δικό τους tag. 🔒 Μόνο για ό,τι **δεν** εξαρτάται από τον επισκέπτη: το κλειδί δεν έχει ταυτότητα.
 */
export function cached<T>(load: () => Promise<T>, key: readonly string[], tags: readonly string[]): Promise<T> {
  return unstable_cache(load, ['public-catalog', 'v1', ...key], { tags: [...tags], revalidate: REVALIDATE_SECONDS })();
}

/** Η βιτρίνα μαζί με το τρέχον ψευδώνυμο. Το ψευδώνυμο δεν αντιγράφεται στο έγγραφο: η αυθεντία του είναι ο χώρος. */
export interface PublicSupplier extends SupplierShowcaseRecord {
  readonly alias: string | null;
}

async function loadSupplier(companyId: string): Promise<PublicSupplier | null> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.SUPPLIER_SHOWCASES).doc(companyId).get();
  const showcase = supplierShowcaseFromDocument(snap.data(), companyId);
  return showcase === null ? null : { ...showcase, alias: await readCanonicalAlias(companyId) };
}

/** Η πύλη. `null` ⇒ ανύπαρκτος, αδημοσίευτος ή ανακλημένος: για τον επισκέπτη το ίδιο. */
export function readPublicSupplier(companyId: string): Promise<PublicSupplier | null> {
  return cached(() => loadSupplier(companyId), ['supplier', companyId], [publicCatalogCompanyTag(companyId)]);
}

/**
 * Οι περιοχές που εξυπηρετεί μια ακτίνα ή ένα περίγραμμα (Ν11 ε). Κενό για κάθε άλλη δήλωση. Ευρετήριο που δεν διαβάστηκε
 * ρίχνει, όπως και η ιεραρχία: «δεν μπόρεσα να ρωτήσω» δεν γίνεται ποτέ «δεν εξυπηρετεί τίποτα».
 */
async function servedAreaNamesOf(coverage: DeclaredCoverage | null): Promise<readonly string[]> {
  const outline = coverage === null ? null : coverageOutline(coverage);
  if (outline === null) return [];
  const sources = await readAdminAreaDeclarationSources();
  if (sources === null) throw new Error('provider-facts-unavailable');
  return (await servedAdminAreas(outline, sources)).map((area) => area.name);
}

async function loadProviderFacts(companyId: string): Promise<PublicProviderFacts> {
  const lookup = await lookupAgencyProfile(getAdminFirestore(), companyId);
  if (lookup.outcome === 'not-published') return NO_PROVIDER_FACTS;
  const sources = lookup.outcome === 'found' ? await readAdminIdentitySources() : null;
  if (lookup.outcome !== 'found' || sources === null) throw new Error('provider-facts-unavailable');
  const servedNames = await servedAreaNamesOf(lookup.showcase.coverage);
  return publicProviderFactsOf(lookup.showcase, { nameOf: (adminId) => sources.placeOf(adminId)?.name, servedNames });
}

/**
 * Λογότυπο, ιστοσελίδα, περιοχή (§22 Υ8), από τον υπάρχοντα αναγνώστη του `agency_profiles`. Πίσω από την ίδια πύλη.
 * 🔑 Η απόσυρση χτυπά το tag αμέσως. Οι αλλαγές κάρτας, σήματος ή περιοχής φαίνονται το πολύ σε ένα παράθυρο.
 */
export async function readPublicProviderFacts(companyId: string): Promise<PublicProviderFacts> {
  if ((await readPublicSupplier(companyId)) === null) return NO_PROVIDER_FACTS;
  return cached(() => loadProviderFacts(companyId), ['provider', companyId], [publicCatalogCompanyTag(companyId)]);
}

/** Μάρκες σε ισχύ (§16). Η λήξη παράγεται στη φόρτωση, άρα φτάνει τη σελίδα το πολύ σε ένα παράθυρο, χωρίς καμία εγγραφή. */
export async function readPublicSupplierBrands(companyId: string): Promise<readonly PublicSupplierBrand[]> {
  if ((await readPublicSupplier(companyId)) === null) return [];
  return cached(() => readActiveSupplierBrands(getAdminFirestore(), companyId, Date.now()), ['brands', companyId], [publicCatalogCompanyTag(companyId)]);
}

async function loadSupplierProfile(companyId: string): Promise<PublicSupplierProfile | null> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.PUBLIC_SUPPLIER_PROFILES).doc(companyId).get();
  return publicSupplierProfileFromDocument(snap.data(), companyId);
}

/** Περιγραφή και portfolio (§22 Υ8). Κενό ή χαλασμένο προφίλ δίνει `null`: η σελίδα ανοίγει χωρίς αυτά. */
export async function readPublicSupplierProfile(companyId: string): Promise<PublicSupplierProfile | null> {
  if ((await readPublicSupplier(companyId)) === null) return null;
  return cached(() => loadSupplierProfile(companyId), ['profile', companyId], [publicCatalogCompanyTag(companyId)]);
}

async function loadModel(companyId: string, modelId: string): Promise<PublicCatalogModel | null> {
  const snap = await models().doc(modelId).get();
  const model = publicCatalogModelFromDocument(snap.data(), modelId);
  return model?.companyId === companyId ? model : null;
}

/** Μοντέλο άλλου χώρου κάτω από αυτόν τον προμηθευτή απαντά όπως το ανύπαρκτο. */
export async function readPublicModel(companyId: string, modelId: string): Promise<PublicCatalogModel | null> {
  if ((await readPublicSupplier(companyId)) === null) return null;
  const tags = [publicCatalogCompanyTag(companyId), publicCatalogModelTag(modelId)];
  return cached(() => loadModel(companyId, modelId), ['model', companyId, modelId], tags);
}

interface ModelAddressFacts {
  readonly companyId: string;
  readonly title: string;
}

async function loadModelAddressFacts(modelId: string): Promise<ModelAddressFacts | null> {
  const snap = await models().doc(modelId).get();
  const model = publicCatalogModelFromDocument(snap.data(), modelId);
  return model === null ? null : { companyId: model.companyId, title: publicModelTitle(model) };
}

/**
 * Η σημερινή διεύθυνση ενός μοντέλου, από το id μόνο: το `/q/<id>` του τυπωμένου QR. Περνά από την ίδια πύλη και τα ίδια tags,
 * άρα ανάκληση και απόσυρση το κλείνουν μαζί με τη σελίδα. `null` ⇒ δεν είναι δημόσιο, χωρίς να λέει γιατί.
 */
export async function readPublicModelTarget(modelId: string): Promise<string | null> {
  const facts = await cached(() => loadModelAddressFacts(modelId), ['target', modelId], [publicCatalogModelTag(modelId)]);
  if (facts === null) return null;
  const supplier = await readPublicSupplier(facts.companyId);
  if (supplier === null) return null;
  return publicModelRoute(supplier.alias ?? supplier.companyId, publicSegmentOf(facts.title, modelId));
}

function modelQuery(companyId: string, categoryId: string | null): Query {
  const owned = models().where('companyId', '==', companyId);
  return categoryId === null ? owned : owned.where('categoryIds', 'array-contains', categoryId);
}

async function loadModelPage(companyId: string, request: PublicModelPageRequest): Promise<PublicModelPage> {
  const ordered = modelQuery(companyId, request.categoryId).orderBy(FieldPath.documentId()).limit(PUBLIC_MODEL_PAGE_SIZE + 1);
  const snap = await (request.after === null ? ordered : ordered.startAfter(request.after)).get();
  const page = snap.docs.slice(0, PUBLIC_MODEL_PAGE_SIZE);
  const cards = page.flatMap((doc) => {
    const model = publicCatalogModelFromDocument(doc.data(), doc.id);
    return model === null ? [] : [publicModelCardOf(model)];
  });
  return { cards, nextAfter: snap.docs.length > PUBLIC_MODEL_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null };
}

const NO_MODELS: PublicModelPage = { cards: [], nextAfter: null };

export async function readPublicModelPage(companyId: string, request: PublicModelPageRequest): Promise<PublicModelPage> {
  if ((await readPublicSupplier(companyId)) === null) return NO_MODELS;
  const key = ['models', companyId, request.categoryId ?? '*', request.after ?? '*'];
  return cached(() => loadModelPage(companyId, request), key, [publicCatalogCompanyTag(companyId)]);
}

/**
 * Ν9(γ): **όλος** ο κατάλογος, σε σελίδες με δρομέα κατά id, μόνο το ένα πεδίο. Το παλιό όριο των 2.000 έκρυβε σιωπηλά τις
 * κατηγορίες των υπολοίπων μοντέλων, και η σελίδα κατηγορίας τους απαντούσε 404. Η μνήμη (5′ + tags) κρατά το κόστος σε ένα
 * πέρασμα ανά παράθυρο· πάνω από το όριο προσοχής γράφεται προειδοποίηση, χωρίς να κοπεί τίποτα.
 */
async function loadCategoryIndex(companyId: string): Promise<PublicCategoryIndex> {
  const index: Record<string, LocalizedText> = {};
  const ordered = modelQuery(companyId, null).select('categoryLabels').orderBy(FieldPath.documentId()).limit(CATEGORY_INDEX_PAGE);
  let read = 0;
  for (let after: string | null = null; ; ) {
    const snap = await (after === null ? ordered : ordered.startAfter(after)).get();
    snap.docs.forEach((doc) => Object.assign(index, publicCategoryLabelsFromField(doc.get('categoryLabels'))));
    read += snap.docs.length;
    if (snap.docs.length < CATEGORY_INDEX_PAGE) break;
    after = snap.docs[snap.docs.length - 1].id;
  }
  if (read > CATEGORY_INDEX_WARN) logger.warn('Μεγάλο ευρετήριο κατηγοριών βιτρίνας: σκέψου συγκεντρωτικό έγγραφο', { companyId, read });
  return index;
}

/** Όλες οι κατηγορίες του προμηθευτή, ανεξάρτητα από τη σελίδα: μόνο το ένα πεδίο, όχι ολόκληρα έγγραφα. */
export async function readPublicCategoryIndex(companyId: string): Promise<PublicCategoryIndex> {
  if ((await readPublicSupplier(companyId)) === null) return {};
  return cached(() => loadCategoryIndex(companyId), ['categories', companyId], [publicCatalogCompanyTag(companyId)]);
}

async function pathsOfSupplier(companyId: string, room: number): Promise<readonly string[]> {
  const supplierSegment = (await readCanonicalAlias(companyId)) ?? companyId;
  const snap = await modelQuery(companyId, null).select('code', 'variants').limit(room).get();
  const modelPaths = snap.docs.flatMap((doc) => {
    const address = publicModelAddressFromDocument(doc.data());
    return address === null ? [] : [publicModelRoute(supplierSegment, publicSegmentOf(publicModelTitle(address), doc.id))];
  });
  const categories = Object.entries(await loadCategoryIndex(companyId));
  const categoryPaths = categories.map(([id, labels]) => publicCategoryRoute(supplierSegment, publicSegmentOf(resolveLocalizedText(labels, DEFAULT_LANGUAGE), id)));
  // Ν11 στ: τα έργα του portfolio, από το ίδιο προφίλ που διαβάζει η σελίδα τους.
  const projects = (await loadSupplierProfile(companyId))?.projects ?? [];
  const projectPaths = projects.map((project) => publicProjectRoute(supplierSegment, publicSegmentOf(publicProjectTitle(project), project.projectId)));
  return [publicSupplierRoute(supplierSegment), ...categoryPaths, ...modelPaths, ...projectPaths];
}

async function loadSitemapPaths(): Promise<readonly string[]> {
  const showcases = await getAdminFirestore().collection(COLLECTIONS.SUPPLIER_SHOWCASES).limit(MAX_SITEMAP_PATHS).get();
  const paths: string[] = [];
  for (const doc of showcases.docs) {
    if (paths.length >= MAX_SITEMAP_PATHS) break;
    if (supplierShowcaseFromDocument(doc.data(), doc.id) !== null) paths.push(...(await pathsOfSupplier(doc.id, MAX_SITEMAP_PATHS - paths.length)));
  }
  if (paths.length >= MAX_SITEMAP_PATHS) logger.warn('Το sitemap της βιτρίνας έφτασε το όριο: χρειάζεται τεμαχισμός', { limit: MAX_SITEMAP_PATHS });
  return paths.slice(0, MAX_SITEMAP_PATHS);
}

/**
 * Οι δημόσιες διαδρομές για το sitemap. Μόνο από βιτρίνες που δημοσίευσε ρητά ο προμηθευτής: ο πληθυσμός είναι opt-in, όπως
 * στο `agency_profiles`, άρα η σάρωση δεν είναι απαρίθμηση χώρων. Βλάβη ρίχνει: κενό sitemap θα έσβηνε σελίδες από το ευρετήριο.
 */
export function readPublicSitemapPaths(): Promise<readonly string[]> {
  return cached(loadSitemapPaths, ['sitemap'], []);
}
