/**
 * `/suppliers/<ψευδώνυμο>/catalogs/s/<ράφι>` — **ο σταθερός σύνδεσμος ενός ραφιού** (ADR-923 §5.15.3): λύνεται κάθε φορά στο
 * ισχύον έντυπο του ανωνύμου. Αυτός μοιράζεται, αυτός θα τυπώνεται στο QR (Θ.4)· η έκδοση αλλάζει, ο σύνδεσμος όχι.
 *
 * 🔑 Η απάντηση έρχεται από την **ίδια** αποθηκευμένη λίστα με τον αναγνώστη (σημαδεμένη από τον κριτή `latestVisibleEdition`),
 *    ώστε η ανακατεύθυνση και ο προορισμός της να μη διαφωνούν ποτέ· τα tags της δημοσίευσης/απόσυρσης την ανανεώνουν αμέσως.
 * 🔑 Προσωρινή ανακατεύθυνση (307), ποτέ 308: ο προορισμός **αλλάζει** με κάθε νέα έκδοση.
 * 🔒 Ράφι χωρίς ισχύον έντυπο, ξένο ή ανύπαρκτο ⇒ ίδιο 404. ⛔ Το `redirect` πετά: μένει εκτός κάθε `try`.
 *
 * @module app/(light)/suppliers/[alias]/catalogs/s/[shelf]/page
 */

import { notFound, redirect } from 'next/navigation';

import { readPublicCatalogEditions } from '@/server/catalog/editions/catalog-edition-reads.server';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import {
  publicCatalogEditionRoute,
  publicCatalogEditionSegmentOf,
  publicCatalogShelfRoute,
  publicIdOfSegment,
} from '@/subapps/catalog/public/public-catalog-routes';

export const dynamic = 'force-dynamic';

interface ShelfLinkProps {
  readonly params: Promise<{ readonly alias: string; readonly shelf: string }>;
}

export default async function CatalogShelfLink({ params }: ShelfLinkProps): Promise<never> {
  const { alias, shelf } = await params;
  const supplier = await requirePublicSupplier(alias, (canonical) => publicCatalogShelfRoute(canonical, shelf));
  // Μόνο μορφή id: τιμή του επισκέπτη δεν γίνεται ποτέ ελεύθερο κλειδί σύγκρισης.
  if (publicIdOfSegment(shelf) !== shelf) notFound();
  const editions = await orSupplierCatalogUnavailable(() => readPublicCatalogEditions(supplier.companyId));
  const current = editions.find((edition) => edition.shelfKey === shelf && edition.current);
  if (current === undefined) notFound();
  redirect(publicCatalogEditionRoute(alias, publicCatalogEditionSegmentOf(current)));
}
