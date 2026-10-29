/**
 * **`/o/<χώρος>/catalog/price-lists` — «Τιμοκατάλογοι»** (ADR-923 §5.11 «3δ» Τμήμα 1).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link PriceListsContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * ⚠️ **`<Suspense>` επειδή η επιλογή ζει στη διεύθυνση** (`useSearchParams`): χωρίς όριο, το `next build` ρίχνει
 *    ολόκληρη τη διαδρομή σε απόδοση πελάτη (CHECK 3.55). Ίδιο ιδίωμα με το `catalog/measurements`.
 * 🔑 Οι τιμές διαβάζονται **μόνο** από τον διακομιστή (απόφαση Ζ: κριτής `pricingView`, οι 8 συλλογές `read: false`)·
 *    το μενού κρύβει τον σύνδεσμο χωρίς `catalog:pricing:view` (UX, όχι ασφάλεια).
 *
 * @module app/(app)/o/[workspace]/catalog/price-lists/page
 */

import React, { Suspense } from 'react';

import { PriceListsContent } from '@/components/catalog/pricing/PriceListsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogPriceListsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PriceListsContent />
    </Suspense>
  );
}
