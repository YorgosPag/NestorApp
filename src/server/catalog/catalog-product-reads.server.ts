import 'server-only';

/**
 * Οι **αναγνώσεις των δεδομένων** του καταλόγου μέσα στη συναλλαγή (ADR-923 §5.10): ρυθμίσεις, στιγμιότυπο
 * σχήματος, μέσα, κατηγορίες, στόχοι αναφορών. Όλες **μέσα** στη συναλλαγή, ώστε η επικύρωση να κρίνει το σχήμα
 * **όπως είναι τη στιγμή της εγγραφής** (Figma: η αλλαγή component δεν σπάει instances σιωπηλά).
 * @module server/catalog/catalog-product-reads.server
 */

import { DEFAULT_CATALOG_SETTINGS, type CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { CatalogReferenceTarget, CatalogValueHolder } from '@/subapps/catalog/types/product';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import { referenceTargetKey, type AssetLookup, type ReferenceLookup } from '@/subapps/catalog/schema/product-validation-context';
import { findVariantScheme } from '@/subapps/catalog/values/attribute-levels';
import { listSlots } from '@/subapps/catalog/values/value-shape';
import { readActiveByIds, readAttributesByIds, readMeasurementRegistry } from './catalog-library-reads.server';
import { readOwned, readSingleton, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';

export type StoredFamilyRecord = StoredCatalogRecord<CatalogFamilyDefinition>;

/** Οι ρυθμίσεις του χώρου — ή οι προεπιλογές, αν δεν αποθηκεύτηκαν ποτέ (Δ6). */
export async function readCatalogSettings(scope: CatalogTx): Promise<CatalogSettingsDefinition> {
  const { current } = await readSingleton<CatalogSettingsDefinition>(scope, 'settings');
  return current ? { channelLocales: current.channelLocales } : DEFAULT_CATALOG_SETTINGS;
}

/**
 * Το σχήμα μιας οικογένειας **τώρα**: η ίδια, οι ιδιότητές της, οι μονάδες, οι ρυθμίσεις, το σχήμα παραλλαγών.
 * Άγνωστο σχήμα ⇒ `scheme: null` — η τοποθέτηση το αναφέρει (`variantSchemeUnknown`), όχι εξαίρεση εδώ.
 */
export async function readSchemaSnapshot(
  scope: CatalogTx,
  familyId: string,
  variantSchemeCode: string | null,
): Promise<CatalogSchemaSnapshot & { readonly familyRecord: StoredFamilyRecord }> {
  const familyRecord = await readOwned<CatalogFamilyDefinition>(scope, 'family', familyId).catch((error: unknown) => {
    if (error instanceof CatalogWriteError) throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'familyId' }]);
    throw error;
  });
  const attributes = await readAttributesByIds(scope, familyRecord.attributes.map((binding) => binding.attributeId));
  const registry = await readMeasurementRegistry(scope);
  const settings = await readCatalogSettings(scope);
  const scheme = variantSchemeCode === null ? null : findVariantScheme(familyRecord.variantSchemes, variantSchemeCode) ?? null;
  return { family: familyRecord, familyRecord, attributes, registry, settings, scheme };
}

/** Όλα τα μέσα / κατηγορίες / στόχοι που αναφέρουν οι φορείς — συγκεντρωμένα, ώστε να διαβαστούν με **ένα** `getAll`. */
export interface HolderReferences {
  readonly assetIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly targets: readonly CatalogReferenceTarget[];
}

export function collectHolderReferences(holders: readonly CatalogValueHolder[]): HolderReferences {
  const assetIds = new Set<string>();
  const categoryIds = new Set<string>();
  const targets = new Map<string, CatalogReferenceTarget>();
  for (const holder of holders) {
    holder.categoryIds.forEach((id) => categoryIds.add(id));
    for (const slots of Object.values(holder.values)) {
      for (const { value } of listSlots(slots)) {
        if (value.type === 'asset') value.assetIds.forEach((id) => assetIds.add(id));
        if (value.type === 'reference') value.targets.forEach((target) => targets.set(referenceTargetKey(target), target));
      }
    }
  }
  return { assetIds: [...assetIds], categoryIds: [...categoryIds], targets: [...targets.values()] };
}

export interface ReferenceSnapshot {
  readonly assets: AssetLookup;
  readonly categories: ReadonlySet<string>;
  readonly references: ReferenceLookup;
}

/** Οι στόχοι αναφορών: υπάρχουν; σε ποια οικογένεια (κωδικό) ανήκουν; — για το `targetFamilyCodes`. */
async function readReferenceTargets(scope: CatalogTx, targets: readonly CatalogReferenceTarget[]): Promise<ReferenceLookup> {
  const idsOf = (kind: CatalogReferenceTarget['kind']) => targets.filter((target) => target.kind === kind).map((target) => target.id);
  const models = await readActiveByIds<{ readonly familyId: string }>(scope, 'productModel', idsOf('productModel'));
  const products = await readActiveByIds<{ readonly familyId: string }>(scope, 'product', idsOf('product'));
  const familyIdOf = (target: CatalogReferenceTarget) => (target.kind === 'product' ? products : models).get(target.id)?.familyId;
  const familyIds = targets.map(familyIdOf).filter((id): id is string => id !== undefined);
  const families = await readActiveByIds<CatalogFamilyDefinition>(scope, 'family', familyIds);
  const lookup = new Map<string, { readonly familyCode: string }>();
  for (const target of targets) {
    const familyId = familyIdOf(target);
    const family = familyId === undefined ? undefined : families.get(familyId);
    if (family) lookup.set(referenceTargetKey(target), { familyCode: family.code });
  }
  return lookup;
}

/** Ό,τι αναφέρουν οι τιμές, όπως είναι **τώρα** στον χώρο (ξένα/διαγραμμένα ≡ ανύπαρκτα). */
export async function readReferenceSnapshot(scope: CatalogTx, refs: HolderReferences): Promise<ReferenceSnapshot> {
  const assetRecords = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', refs.assetIds);
  const categories = await readActiveByIds<object>(scope, 'category', refs.categoryIds);
  const references = await readReferenceTargets(scope, refs.targets);
  const assets = new Map([...assetRecords].map(([id, asset]) => [id, { kind: asset.kind }] as const));
  return { assets, categories: new Set(categories.keys()), references };
}
