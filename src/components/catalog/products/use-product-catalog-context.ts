'use client';
/**
 * **Ό,τι χρειάζεται η σελίδα προϊόντων** — βιβλιοθήκη · οικογένειες · ρυθμίσεις · μέσα · αρχεία μέσων (ADR-923 §5.10.4).
 *
 * **Ένας** συνθέτης για λίστα **και** επεξεργαστή: κάθε συλλογή ανοίγει **έναν** ακροατή, όσες οθόνες κι αν τη
 * ζητούν. Τα ίδια στιγμιότυπα τρέφουν και την κρίση πριν από την αποστολή (`judgeAggregate`, Β4) — η οθόνη κρίνει με
 * ό,τι θα έβλεπε ο διακομιστής.
 *
 * @module components/catalog/products/use-product-catalog-context
 */

import { useMemo } from 'react';

import { useCatalogAssetFiles, type CatalogAssetFiles } from '@/hooks/catalog/useCatalogAssetFiles';
import { useCatalogCollection, type CatalogLoadState } from '@/hooks/catalog/useCatalogCollection';
import { combineLoadStates, useCatalogLibrary, type CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import { useCatalogSettings, type CatalogSettingsLoad } from '@/hooks/catalog/useCatalogSettings';
import type { AssetRecord, CategoryRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';

import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

export interface ProductCatalogContext {
  readonly state: CatalogLoadState;
  readonly library: CatalogLibrary;
  readonly families: readonly FamilyRecord[];
  readonly familyById: ReadonlyMap<string, FamilyRecord>;
  readonly settings: CatalogSettingsLoad;
  readonly assets: readonly AssetRecord[];
  readonly assetById: ReadonlyMap<string, AssetRecord>;
  readonly categories: readonly CategoryRecord[];
  readonly files: CatalogAssetFiles;
}

const byId = <T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> => new Map(items.map((item) => [item.id, item]));

export function useProductCatalogContext(): ProductCatalogContext {
  const notice = useCatalogFailureNotice();
  const library = useCatalogLibrary(notice);
  const families = useCatalogCollection('CATALOG_FAMILIES');
  const assets = useCatalogCollection('CATALOG_ASSETS');
  const categories = useCatalogCollection('CATALOG_CATEGORIES');
  const settings = useCatalogSettings();
  const files = useCatalogAssetFiles();
  const familyById = useMemo(() => byId(families.items), [families.items]);
  const assetById = useMemo(() => byId(assets.items), [assets.items]);
  const state = combineLoadStates([library.state, families.state, assets.state, categories.state, settings.state]);
  return useMemo(() => ({
    state, library, families: families.items, familyById, settings, assets: assets.items, assetById, categories: categories.items, files,
  }), [state, library, families.items, familyById, settings, assets.items, assetById, categories.items, files]);
}
