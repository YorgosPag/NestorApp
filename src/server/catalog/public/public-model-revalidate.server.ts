import 'server-only';

/**
 * **Η ακύρωση μνήμης μετά το commit** (ADR-923 §5.13 Δ4). Ποτέ δεν ρίχνει την πράξη: το έγγραφο έχει ήδη γραφτεί, και το
 * χειρότερο που μένει είναι μια σελίδα ως το τέλος του παραθύρου ISR.
 *
 * 🔑 Καλείται **αμέσως μετά το commit και πριν από το ίχνος ιστορικού**: αποτυχία του ιχνηλάτη δεν κρατά ζωντανή μια
 *    αποσυρμένη σελίδα.
 *
 * ⚠️ Ανεπαλήθευτο ζωντανά, ανοιχτό στο §5.13: `revalidateTag` μέσα σε `after()` και από τον cron dispatcher.
 *
 * @module server/catalog/public/public-model-revalidate.server
 */

import { revalidateTag } from 'next/cache';

import { createModuleLogger } from '@/lib/telemetry';
import { isAppFeatureEnabled } from '@/config/feature-flags';
import { publicCatalogCompanyTag, publicCatalogEditionsTag, publicCatalogModelTag, publicCatalogPricesTag } from './public-catalog-cache-tag';

const logger = createModuleLogger('PublicModelRevalidate');

function revalidateTags(tags: readonly string[], scope: Readonly<Record<string, string>>): void {
  try {
    tags.forEach((tag) => revalidateTag(tag));
  } catch (error) {
    logger.warn('Η ακύρωση μνήμης της βιτρίνας απέτυχε', { ...scope, error: error instanceof Error ? error.message : String(error) });
  }
}

export function revalidatePublicModel(companyId: string, modelId: string): void {
  revalidateTags([publicCatalogModelTag(modelId), publicCatalogCompanyTag(companyId)], { companyId, modelId });
}

/** Όλες οι σελίδες του προμηθευτή: ανάκληση επιβεβαίωσης, δημοσίευση, αλλαγή στοιχείων βιτρίνας (§4.5). */
export function revalidatePublicCompany(companyId: string): void {
  revalidateTags([publicCatalogCompanyTag(companyId)], { companyId });
}

/**
 * Οι τιμές της βιτρίνας ενός προμηθευτή (ADR-923 §5.13 Σ6), μετά από γραφή τιμολόγησης. Με κλειστό διακόπτη δεν κάνει τίποτα:
 * καμία καταχώριση δεν φέρει το tag, και η βιτρίνα μένει όπως πριν.
 */
export function revalidatePublicPrices(companyId: string): void {
  if (!isAppFeatureEnabled('PUBLIC_SHOWCASE_PRICES')) return;
  revalidateTags([publicCatalogPricesTag(companyId)], { companyId });
}

/** Τα έντυπα της βιτρίνας ενός προμηθευτή (ADR-923 §5.15), μετά από δημοσίευση ή απόσυρση. */
export function revalidatePublicEditions(companyId: string): void {
  revalidateTags([publicCatalogEditionsTag(companyId)], { companyId });
}
