/**
 * **`/o/<χώρος>/catalog/publications` — «Εκδόσεις καταλόγου»** (ADR-923 §5.6.1).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link PublicationsContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * ⚠️ **`<Suspense>` επειδή η επιλογή ζει στη διεύθυνση** (`useSearchParams`): χωρίς όριο, το `next build` ρίχνει
 *    ολόκληρη τη διαδρομή σε απόδοση πελάτη (CHECK 3.55). Ίδιο ιδίωμα με το `catalog/price-lists`.
 * 🔑 Η όψη διαβάζεται **μόνο** από τον διακομιστή (κριτής `pricingView`)· το μενού κρύβει τον σύνδεσμο χωρίς
 *    `catalog:pricing:view` (UX, όχι ασφάλεια).
 *
 * @module app/(app)/o/[workspace]/catalog/publications/page
 */

import React, { Suspense } from 'react';

import { PublicationsContent } from '@/components/catalog/publishing/PublicationsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogPublicationsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PublicationsContent />
    </Suspense>
  );
}
