import 'server-only';

/**
 * @fileoverview **Ο κατάλογος ΚΑΔ 2025 από τον διακομιστή** — το ΙΔΙΟ `public/data/kad/kad-2025.json`
 * που κατεβάζει ο περιηγητής, με τον ΙΔΙΟ αναγνώστη σχήματος (`lib/kad/kad-catalog-shape`).
 * @related lib/kad/kad-catalog-source.ts (ο δίδυμος του περιηγητή) · lib/data/server-json-file.ts
 * @module services/kad/kad-catalog.reader
 *
 * ⚠️ `null` = «δεν μπόρεσα να ρωτήσω», ΠΟΤΕ «ο κωδικός δεν υπάρχει» — ο καλών οφείλει να αρνηθεί
 * με «ο κατάλογος δεν είναι διαθέσιμος», όχι με «άκυρος ΚΑΔ».
 */

import { strictJsonShape } from '@/lib/data/json-shape';
import { createServerJsonFile, warnOnJsonFailure } from '@/lib/data/server-json-file';
import { readKadCatalog } from '@/lib/kad/kad-catalog-shape';
import { KAD_CATALOG_PUBLIC_PATH, KAD_CATALOG_URL, type KadCatalog } from '@/lib/kad/kad-types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('kad-catalog.reader');

const KAD_CATALOG_FILE = createServerJsonFile<KadCatalog>({
  publicPath: KAD_CATALOG_PUBLIC_PATH,
  build: strictJsonShape(readKadCatalog, KAD_CATALOG_URL),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκε ο κατάλογος ΚΑΔ 2025'),
});

/** Ο κατάλογος, ή `null` αν δεν διαβάστηκε. */
export function readKadCatalogOnServer(): Promise<KadCatalog | null> {
  return KAD_CATALOG_FILE.read();
}
