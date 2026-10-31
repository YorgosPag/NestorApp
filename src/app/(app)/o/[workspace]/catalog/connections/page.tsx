/**
 * **`/o/<χώρος>/catalog/connections` — «Συνδέσεις»** (ADR-923 §5.12): οι πελάτες μου · οι προμηθευτές μου.
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ConnectionsContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * ⚠️ **`<Suspense>` επειδή η καρτέλα ζει στη διεύθυνση** (`useSearchParams`): χωρίς όριο, το `next build` ρίχνει ολόκληρη τη
 *    διαδρομή σε απόδοση πελάτη (CHECK 3.55). Ίδιο ιδίωμα με το `catalog/discounts`.
 *
 * @module app/(app)/o/[workspace]/catalog/connections/page
 */

import React, { Suspense } from 'react';

import { ConnectionsContent } from '@/components/catalog/supply/ConnectionsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogConnectionsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ConnectionsContent />
    </Suspense>
  );
}
