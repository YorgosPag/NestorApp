import 'server-only';

/**
 * **Από τη διεύθυνση στον προμηθευτή** (ADR-923 §5.13 Σ4): το κοινό πρώτο βήμα των τριών δημόσιων σελίδων.
 *
 * 🔒 Ανύπαρκτος, αδημοσίευτος και ανακλημένος δίνουν το ίδιο 404: η σελίδα δεν είναι μαντείο «υπάρχει τέτοια εταιρεία;».
 * 🔑 «Δεν μπόρεσα να ρωτήσω» είναι 5xx με `digest`, ποτέ 404.
 * 🔑 Μία κανονική διεύθυνση: `/suppliers/comp_<uuid>` στέλνει 308 στο ψευδώνυμο, μόνο αφού το επιβεβαιώσει η αυθεντία. Έτσι το
 *    `canonical` κάθε σελίδας δείχνει ένα μέρος. Η ανακατεύθυνση έρχεται μετά την πύλη: το ψευδώνυμο ανακλημένου δεν αποκαλύπτεται.
 * ⛔ Τα `notFound` και `permanentRedirect` εκτός `try`: πετούν, και ένα `catch` θα τα έκανε 5xx.
 *
 * @module services/public-catalog/public-supplier-route
 */

import { notFound, permanentRedirect } from 'next/navigation';

import { throwBackendUnavailable } from '@/lib/errors/backend-unavailable';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import { publishedCanonicalSegment } from '@/lib/workspace/published-canonical-segment';
import { publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import { readPublicSupplier, type PublicSupplier } from './public-catalog.reader';

const logger = createModuleLogger('public-supplier-route');

/** Τρέχει μια ανάγνωση της βιτρίνας: βλάβη ⇒ δηλωμένο 5xx. */
export async function orSupplierCatalogUnavailable<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    logger.warn('Η δημόσια βιτρίνα δεν διαβάστηκε', { error: error instanceof Error ? error.message : String(error) });
    return throwBackendUnavailable('supplier-catalog');
  }
}

/** `routeFor` φτιάχνει την ίδια σελίδα κάτω από το κανονικό τμήμα: η ανακατεύθυνση κρατά κατηγορία ή μοντέλο. */
export async function requirePublicSupplier(segment: string, routeFor: (canonical: string) => string = publicSupplierRoute): Promise<PublicSupplier> {
  const resolution = await resolveAlias(segment);
  if (resolution.outcome === 'unknown') throwBackendUnavailable('supplier-catalog');
  if (resolution.outcome === 'not-found') notFound();
  const supplier = await orSupplierCatalogUnavailable(() => readPublicSupplier(resolution.companyId));
  if (supplier === null) notFound();
  const canonical = await publishedCanonicalSegment(resolution, supplier.alias);
  if (canonical !== null && canonical !== segment) permanentRedirect(routeFor(canonical));
  return supplier;
}
