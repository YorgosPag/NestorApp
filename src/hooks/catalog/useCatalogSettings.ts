'use client';
/**
 * **Οι ρυθμίσεις του καταλόγου** — κανάλια × γλώσσες (ADR-923 §5.10 Δ6, §5.10.4 Β5).
 *
 * Singleton ανά χώρο. Όταν **δεν** έχει αποθηκευτεί ποτέ, η αλήθεια είναι οι **προεπιλογές**
 * (`DEFAULT_CATALOG_SETTINGS` — τις ίδιες διαβάζει ο διακομιστής στο `readCatalogSettings`) και η βάση CAS είναι
 * **0** («διάβασα τις προεπιλογές»): έτσι δύο ταυτόχρονες «πρώτες» αποθηκεύσεις δεν περνούν και οι δύο.
 *
 * @module hooks/catalog/useCatalogSettings
 */

import { useMemo } from 'react';

import type { CatalogSettingsRecord } from '@/services/catalog/catalog-api.client';
import { DEFAULT_CATALOG_SETTINGS, type CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';

import { useCatalogCollection, type CatalogLoadState } from './useCatalogCollection';

export interface CatalogSettingsLoad {
  readonly state: CatalogLoadState;
  readonly definition: CatalogSettingsDefinition;
  /** Η βάση CAS — **0** όταν δεν υπάρχει αποθηκευμένο έγγραφο. */
  readonly revision: number;
  readonly record: CatalogSettingsRecord | null;
  /** Οι εγγραφές (0 ή 1) — για το `useCatalogOptimistic`, χωρίς **δεύτερο** ακροατή στο ίδιο ερώτημα. */
  readonly records: readonly CatalogSettingsRecord[];
}

export function useCatalogSettings(): CatalogSettingsLoad {
  const load = useCatalogCollection('CATALOG_SETTINGS');
  const record = load.items[0] ?? null;
  return useMemo(() => ({
    state: load.state,
    definition: record ? { channelLocales: record.channelLocales } : DEFAULT_CATALOG_SETTINGS,
    revision: record?.revision ?? 0,
    record,
    records: load.items,
  }), [load.state, load.items, record]);
}
