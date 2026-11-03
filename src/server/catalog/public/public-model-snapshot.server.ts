import 'server-only';

/**
 * **Ό,τι χρειάζεται η προβολή ενός μοντέλου** (ADR-923 §5.13 Σ3): ένα συνεπές στιγμιότυπο, σε συναλλαγή μόνο ανάγνωσης,
 * χωρίς δρώντα, αφού το καλεί ο αδειαστής.
 *
 * 🔑 Φέρνει τα μέσα **όλων** των φορέων και κρατά μόνο όσα περνούν το `isPublicAsset`. Ποια θα μπουν τελικά το λέει η καθαρή
 *    προβολή, ώστε ο κανόνας «ποια ιδιότητα δημοσιεύεται» να μη γραφτεί δεύτερη φορά.
 * 🔒 Αρχείο που δεν ανήκει στον χώρο δεν γίνεται πηγή, ακόμη κι αν το δείχνει μέσο του χώρου.
 *
 * @module server/catalog/public/public-model-snapshot.server
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import type { FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import type { LocalizedText } from '@/i18n/localized-text';
import { isPublicAsset } from '@/subapps/catalog/public/public-asset-eligibility';
import type { PublicProjectionInput } from '@/subapps/catalog/public/project-public-model';
import { chainOf, type StoredModel, type StoredProduct } from '@/subapps/catalog/publishing/publication-chapters';
import type { CatalogRenditions } from '@/subapps/catalog/renditions/catalog-renditions';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import { quoteIntakeAccepts } from '@/subapps/catalog/schema/validate-supplier-profile';
import { storedQuoteIntakeOf } from '@/subapps/catalog/schema/zod/supplier-profile.schema';
import type { CatalogQuoteIntake, CatalogSupplierProfileDefinition, CatalogSupplierProfileStored } from '@/subapps/catalog/types/supplier-profile';
import type { CatalogValueHolderKind } from '@/subapps/catalog/types/product';
import type { StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import { readActiveByIds } from '../catalog-library-reads.server';
import { collectHolderReferences, readSchemaSnapshot } from '../catalog-product-reads.server';
import { readOwnedOrNull, runForeignCatalogRead, type CatalogReadScope, type StoredCatalogRecord } from '../catalog-store.server';
import { ancestryOfChain, readVisibilityRules } from '../visibility-reads.server';

/** Ένα μέσο που επιτρέπεται να φύγει: μόνο η απόδοση web, ποτέ το πρωτότυπο. */
export interface PublicAssetFacts {
  readonly assetId: string;
  readonly labels: LocalizedText;
  readonly storagePath: string;
  readonly storagePlacement?: FileStoragePlacement;
}

export interface PublicModelSnapshot {
  readonly projection: Omit<PublicProjectionInput, 'media' | 'atMs'>;
  readonly assets: ReadonlyMap<string, PublicAssetFacts>;
}

interface StoredRendition {
  readonly companyId?: string;
  readonly storagePath?: string;
  readonly storagePlacement?: FileStoragePlacement;
  readonly catalogRenditions?: CatalogRenditions;
}

interface ModelTree {
  readonly kind: CatalogValueHolderKind;
  readonly code: string;
  readonly familyId: string;
  readonly variantSchemeCode: string | null;
  readonly models: ReadonlyMap<string, StoredModel>;
  readonly products: readonly StoredProduct[];
}

async function readModelTree(scope: CatalogReadScope, root: StoredCatalogRecord<StoredCatalogProductModelDefinition>): Promise<ModelTree> {
  const entries = Object.entries(root.derived?.descendants ?? {});
  const idsOf = (kind: CatalogValueHolderKind) => entries.filter(([, entry]) => entry.kind === kind).map(([id]) => id);
  const subModels = await readActiveByIds<StoredModel>(scope, 'productModel', idsOf('productModel'));
  const products = await readActiveByIds<StoredProduct>(scope, 'product', idsOf('product'));
  return {
    kind: 'productModel',
    code: root.code,
    familyId: root.familyId,
    variantSchemeCode: root.variantSchemeCode,
    models: new Map<string, StoredModel>([[root.id, root], ...subModels]),
    products: [...products.values()],
  };
}

/** Η ρίζα και οι απόγονοί της. Υπο-μοντέλο, SKU με γονέα ή ανύπαρκτο ⇒ `null`: δεν έχουν δικό τους έγγραφο. */
async function readTree(scope: CatalogReadScope, rootId: string): Promise<ModelTree | null> {
  const model = await readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', rootId);
  if (model !== null) return model.parentId === null ? readModelTree(scope, model) : null;
  const product = await readOwnedOrNull<StoredProduct>(scope, 'product', rootId);
  if (product === null || product.modelId !== null) return null;
  const code = product.derived.identifier ?? product.id;
  return { kind: 'product', code, familyId: product.familyId, variantSchemeCode: null, models: new Map(), products: [product] };
}

async function readFilesOf(scope: CatalogReadScope, assets: readonly StoredCatalogRecord<CatalogAssetDefinition>[]) {
  const fileIds = assets.flatMap((asset) => asset.fileId ?? []);
  if (fileIds.length === 0) return new Map<string, StoredRendition>();
  const files = scope.db.collection(COLLECTIONS[FILE_COLLECTION.company]);
  const snaps = await scope.tx.getAll(...fileIds.map((id) => files.doc(id)));
  return new Map(snaps.map((snap) => [snap.id, (snap.data() ?? {}) as StoredRendition]));
}

function assetFactsOf(asset: StoredCatalogRecord<CatalogAssetDefinition>, file: StoredRendition | undefined, companyId: string, nowMs: number): PublicAssetFacts | null {
  if (file === undefined || file.companyId !== companyId || !file.storagePath) return null;
  if (!isPublicAsset(asset, file.catalogRenditions, nowMs)) return null;
  return { assetId: asset.id, labels: asset.labels, storagePath: file.storagePath, storagePlacement: file.storagePlacement };
}

/** Η μία πόρτα των μέσων προς το κοινό: ό,τι δεν περνά το `isPublicAsset` λείπει από τον χάρτη. Την μοιράζονται μοντέλο και προφίλ. */
export async function readPublicAssetFacts(scope: CatalogReadScope, assetIds: readonly string[], nowMs: number): Promise<ReadonlyMap<string, PublicAssetFacts>> {
  const assets = [...(await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', assetIds)).values()];
  const files = await readFilesOf(scope, assets);
  const facts = assets.flatMap((asset) => assetFactsOf(asset, asset.fileId === null ? undefined : files.get(asset.fileId), scope.ctx.companyId, nowMs) ?? []);
  return new Map(facts.map((fact) => [fact.assetId, fact]));
}

async function snapshotOfTree(scope: CatalogReadScope, rootId: string, tree: ModelTree, nowMs: number): Promise<PublicModelSnapshot> {
  const schema = await readSchemaSnapshot(scope, tree.familyId, tree.variantSchemeCode);
  const chains = tree.products.map((product) => ({ product, chain: chainOf(product, tree.models) }));
  const categoryIds = [...tree.models.values(), ...tree.products].flatMap((holder) => holder.categoryIds);
  const categories = await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', categoryIds);
  const variants = chains.map(({ product, chain }) => ({
    id: product.id,
    code: product.derived.identifier,
    label: product.derived.label,
    chain,
    ancestry: ancestryOfChain(product.id, chain, categories),
  }));
  const { kind, code, familyId } = tree;
  const categoryLabels = new Map([...categories].map(([id, category]) => [id, category.labels]));
  return {
    projection: { companyId: scope.ctx.companyId, rootId, kind, code, familyId, schema, locales: schema.settings.channelLocales.storefront, categoryLabels, variants, rules: await readVisibilityRules(scope) },
    assets: await readPublicAssetFacts(scope, collectHolderReferences([...tree.models.values(), ...tree.products]).assetIds, nowMs),
  };
}

export interface PublicProfileSnapshot {
  readonly definition: CatalogSupplierProfileDefinition;
  /** Μόνο για να κριθεί το «δέχεται» (§5.13 Ε6β). Το email δεν περνά στην προβολή. */
  readonly quoteIntake: CatalogQuoteIntake;
  readonly assets: ReadonlyMap<string, PublicAssetFacts>;
}

/**
 * Το στιγμιότυπο του προφίλ παρόχου (ADR-923 §22 Υ8). Ζει εδώ επειδή αυτό το αρχείο είναι ο ένας δηλωμένος αναγνώστης ξένου
 * καταλόγου χωρίς δρώντα (CHECK 3.106), και τα μέσα περνούν από την ίδια πόρτα. `null` ⇒ ο χώρος δεν έχει (πια) προφίλ.
 */
export function readPublicProfileSnapshot(companyId: string, nowMs: number): Promise<PublicProfileSnapshot | null> {
  return runForeignCatalogRead(companyId, async (scope) => {
    const id = generateDeterministicCatalogSupplierProfileId(companyId);
    const stored = await readOwnedOrNull<CatalogSupplierProfileStored>(scope, 'supplierProfile', id);
    if (stored === null) return null;
    const definition: CatalogSupplierProfileDefinition = { description: stored.description, projects: stored.projects };
    const quoteIntake = storedQuoteIntakeOf(stored.quoteIntake);
    return { definition, quoteIntake, assets: await readPublicAssetFacts(scope, stored.projects.flatMap((project) => project.assetIds), nowMs) };
  });
}

/**
 * **«Δέχεται αιτήματα προσφοράς;»** μέσα στη συναλλαγή του καλούντα (ADR-923 §5.13 Ε6β, Τ4): το κλείσιμο του opt-in κερδίζει
 * κάθε αγώνα με τη δημιουργία RFQ. Ζει εδώ για τον ίδιο λόγο με το προφίλ: ο ένας δηλωμένος αναγνώστης του ιδιωτικού
 * `supplierProfile` ξένου χώρου (CHECK 3.106). 🔒 Επιστρέφει **μόνο** το ναι/όχι: το email δεν φεύγει από εδώ.
 * Ανύπαρκτο, διαγραμμένο ή χαλασμένο προφίλ ⇒ «όχι» (`storedQuoteIntakeOf`: η αμφιβολία κλείνει την πόρτα).
 */
export async function supplierAcceptsQuotesInTx(tx: Transaction, db: Firestore, supplierCompanyId: string): Promise<boolean> {
  const scope: CatalogReadScope = { db, tx, ctx: { companyId: supplierCompanyId }, now: nowISO() };
  const id = generateDeterministicCatalogSupplierProfileId(supplierCompanyId);
  const stored = await readOwnedOrNull<CatalogSupplierProfileStored>(scope, 'supplierProfile', id);
  return stored !== null && quoteIntakeAccepts(storedQuoteIntakeOf(stored.quoteIntake));
}

/** `null` ⇒ δεν υπάρχει (πια) δημοσιεύσιμη ρίζα με αυτό το id: ο αδειαστής σβήνει το έγγραφο. */
export function readPublicModelSnapshot(companyId: string, rootId: string, nowMs: number): Promise<PublicModelSnapshot | null> {
  return runForeignCatalogRead(companyId, async (scope) => {
    const tree = await readTree(scope, rootId);
    return tree === null ? null : snapshotOfTree(scope, rootId, tree, nowMs);
  });
}
