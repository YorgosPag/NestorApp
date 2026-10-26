'use client';

/**
 * @fileoverview **Η ζωντανή ανάγνωση μιας συλλογής του καταλόγου** — ένας μηχανισμός για όλες (ADR-923 §5.9 · §5.10.4).
 * @related services/firestore/firestore-query.service.ts (ADR-355 SSoT · ADR-361 equality guard) · lib/stale-cache.ts
 *   (ADR-300) · hooks/procurement/useFrameworkAgreements.ts (το ιδίωμα)
 * @module hooks/catalog/useCatalogCollection
 *
 * 🔑 **Ο πελάτης διαβάζει απευθείας** (κανόνες: `isInternalUserOfCompany`)· γράφει **μόνο** ο διακομιστής. Το
 *    `companyId` το βάζει η υπηρεσία (tenant-config, προεπιλογή) — κανένα χειρόγραφο φίλτρο ενοικιαστή εδώ.
 * 🔑 **Stale-while-revalidate ανά χώρο**: η κρυφή μνήμη έχει κλειδί τον χώρο, ώστε η αλλαγή χώρου να μη δείξει
 *    ποτέ για μια στιγμή τον κατάλογο του προηγούμενου (κλειδί χωρίς χώρο = διαρροή ανάμεσα σε ενοικιαστές στην οθόνη).
 * 🔑 **Κλειδί συλλογής → τύπος εγγραφής** σε **έναν** χάρτη: ο τύπος ρέει από το κλειδί, χωρίς cast στον καταναλωτή.
 * ⚠️ Οι διαγραμμένες εγγραφές (soft delete) **δεν** ζητούνται καν: `isDeleted == false` στο ερώτημα.
 */

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';

import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache, type StaleCache } from '@/lib/stale-cache';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type {
  AssetRecord,
  AttributeGroupRecord,
  AttributeRecord,
  CatalogSettingsRecord,
  CategoryRecord,
  FamilyRecord,
  MeasurementFamilyRecord,
} from '@/services/catalog/catalog-api.client';

const logger = createModuleLogger('useCatalogCollection');

/** Οι συλλογές που διαβάζει η οθόνη ολόκληρες (σχήμα + βιβλιοθήκη μέσων) και ο τύπος εγγραφής της καθεμιάς. */
export interface CatalogCollectionItems {
  readonly CATALOG_ATTRIBUTES: AttributeRecord;
  readonly CATALOG_ATTRIBUTE_GROUPS: AttributeGroupRecord;
  readonly CATALOG_MEASUREMENT_FAMILIES: MeasurementFamilyRecord;
  readonly CATALOG_CATEGORIES: CategoryRecord;
  readonly CATALOG_FAMILIES: FamilyRecord;
  /** Βιβλιοθήκη μέσων (ADR-923 §5.10.4) — μόνο ισότητες ⇒ κανένας σύνθετος δείκτης. */
  readonly CATALOG_ASSETS: AssetRecord;
  /** Ρυθμίσεις (singleton, ADR-923 §5.10.4 Β5) — 0 ή 1 έγγραφο· το διαβάζει το `useCatalogSettings`. */
  readonly CATALOG_SETTINGS: CatalogSettingsRecord;
}

export type CatalogCollectionKey = keyof CatalogCollectionItems;

export type CatalogLoadState = 'loading' | 'ready' | 'failed';

export interface CatalogLoad<T> {
  readonly state: CatalogLoadState;
  readonly items: readonly T[];
}

type CatalogCaches = { readonly [K in CatalogCollectionKey]: StaleCache<readonly CatalogCollectionItems[K][]> };

const CACHES: CatalogCaches = {
  CATALOG_ATTRIBUTES: createStaleCache('catalog:attributes'),
  CATALOG_ATTRIBUTE_GROUPS: createStaleCache('catalog:attribute-groups'),
  CATALOG_MEASUREMENT_FAMILIES: createStaleCache('catalog:measurement-families'),
  CATALOG_CATEGORIES: createStaleCache('catalog:categories'),
  CATALOG_FAMILIES: createStaleCache('catalog:families'),
  CATALOG_ASSETS: createStaleCache('catalog:assets'),
  CATALOG_SETTINGS: createStaleCache('catalog:settings'),
};

function initialLoad<T>(cache: StaleCache<readonly T[]>, companyId: string | null): CatalogLoad<T> {
  const cached = companyId && cache.hasLoaded(companyId) ? cache.get(companyId) : null;
  return cached ? { state: 'ready', items: cached } : { state: 'loading', items: [] };
}

/** Ζωντανή λίστα των **ενεργών** εγγραφών της συλλογής, για τον χώρο του συνδεδεμένου. */
export function useCatalogCollection<K extends CatalogCollectionKey>(key: K): CatalogLoad<CatalogCollectionItems[K]> {
  type Item = CatalogCollectionItems[K];
  const { user, loading: authLoading } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;
  const cache: StaleCache<readonly Item[]> = CACHES[key];
  const [load, setLoad] = useState<CatalogLoad<Item>>(() => initialLoad(cache, companyId));

  useEffect(() => {
    if (authLoading) return;
    if (!user || !companyId) {
      setLoad({ state: 'failed', items: [] });
      return;
    }
    setLoad(initialLoad(cache, companyId));
    return firestoreQueryService.subscribe<Item & Record<string, unknown>>(
      key,
      (result) => {
        cache.set(result.documents, companyId);
        setLoad({ state: 'ready', items: result.documents });
      },
      (error) => {
        logger.error('Η ζωντανή ανάγνωση του καταλόγου απέτυχε', { key, error: error.message });
        setLoad((prev) => ({ state: 'failed', items: prev.items }));
      },
      { constraints: [where('isDeleted', '==', false)] },
    );
  }, [authLoading, user, companyId, key, cache]);

  return load;
}
