/**
 * @fileoverview **Ο κατάλογος ΚΑΔ 2025 στον περιηγητή** — τεμπέλικη, μία-φορά φόρτωση του
 * `public/data/kad/kad-2025.json` μέσω της κοινής μηχανής (`lib/data/lazy-json-snapshot`).
 * @related hooks/useKadOptions.ts · services/kad/kad-catalog.reader.ts (ο δίδυμος του διακομιστή)
 * @module lib/kad/kad-catalog-source
 */

import { strictJsonShape } from '@/lib/data/json-shape';
import { createLazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';
import { readKadCatalog } from './kad-catalog-shape';
import { KAD_CATALOG_URL, type KadCatalog } from './kad-types';

const logger = createModuleLogger('kad-catalog-source');

/** Ο ΕΝΑΣ τεμπέλης αναγνώστης του καταλόγου — κοινός για επαφές, λογιστήριο και κάθε άλλη οθόνη. */
export const KAD_CATALOG_SOURCE = createLazyJsonSnapshot<KadCatalog>({
  url: KAD_CATALOG_URL,
  build: strictJsonShape(readKadCatalog, KAD_CATALOG_URL),
  onFailure: (error) => logger.error('Failed to load KAD catalogue', { error }),
});
