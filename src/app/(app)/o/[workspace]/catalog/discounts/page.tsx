/**
 * **`/o/<χώρος>/catalog/discounts` — «Εκπτώσεις»** (ADR-923 §5.11 «3δ» Τμήμα 2).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link DiscountsContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * ⚠️ **`<Suspense>` επειδή καρτέλα, συνθήκη και ομάδα ζουν στη διεύθυνση** (`useSearchParams`): χωρίς όριο, το `next build`
 *    ρίχνει ολόκληρη τη διαδρομή σε απόδοση πελάτη (CHECK 3.55). Ίδιο ιδίωμα με το `catalog/price-lists`.
 * 🔑 Οι εκπτώσεις διαβάζονται **μόνο** από τον διακομιστή (απόφαση Ζ: κριτής `pricingView`)· το μενού κρύβει τον σύνδεσμο
 *    χωρίς `catalog:pricing:view` (UX, όχι ασφάλεια).
 *
 * @module app/(app)/o/[workspace]/catalog/discounts/page
 */

import React, { Suspense } from 'react';

import { DiscountsContent } from '@/components/catalog/pricing/DiscountsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogDiscountsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <DiscountsContent />
    </Suspense>
  );
}
