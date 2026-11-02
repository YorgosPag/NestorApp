import 'server-only';

/**
 * **Η ακύρωση μνήμης μετά το commit** (ADR-923 §5.13 Δ4). Ποτέ δεν ρίχνει την πράξη: το έγγραφο έχει ήδη γραφτεί, και το
 * χειρότερο που μένει είναι μια σελίδα ως το τέλος του παραθύρου ISR.
 *
 * ⚠️ Ανεπαλήθευτο ζωντανά, ανοιχτό στο §5.13: `revalidateTag` μέσα σε `after()` και από τον cron dispatcher.
 *
 * @module server/catalog/public/public-model-revalidate.server
 */

import { revalidateTag } from 'next/cache';

import { createModuleLogger } from '@/lib/telemetry';
import { publicCatalogCompanyTag, publicCatalogModelTag } from './public-catalog-cache-tag';

const logger = createModuleLogger('PublicModelRevalidate');

export function revalidatePublicModel(companyId: string, modelId: string): void {
  try {
    revalidateTag(publicCatalogModelTag(modelId));
    revalidateTag(publicCatalogCompanyTag(companyId));
  } catch (error) {
    logger.warn('Η ακύρωση μνήμης της βιτρίνας απέτυχε', { companyId, modelId, error: error instanceof Error ? error.message : String(error) });
  }
}
