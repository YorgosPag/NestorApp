/**
 * **`/o/<χώρος>/catalog/measurements` — «Μονάδες μέτρησης» του καταλόγου προϊόντων** (ADR-923 Φάση 1γ).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link MeasurementsContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * ⚠️ **`<Suspense>` επειδή η επιλογή ζει στη διεύθυνση** (`useSearchParams`): χωρίς όριο, το `next build` ρίχνει
 *    ολόκληρη τη διαδρομή σε απόδοση πελάτη (CHECK 3.55). Ίδιο ιδίωμα με το `/document-expiry`.
 * 🔑 Η ανάγνωση φυλάσσεται από τους κανόνες Firestore (`isInternalUserOfCompany`)· η εγγραφή από το
 *    `catalog:schema:manage` του γραφέα. Το μενού κρύβει τον σύνδεσμο χωρίς `catalog:schema:view` (UX, όχι ασφάλεια).
 *
 * @module app/(app)/o/[workspace]/catalog/measurements/page
 */

import React, { Suspense } from 'react';

import { MeasurementsContent } from '@/components/catalog/measurements/MeasurementsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogMeasurementsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <MeasurementsContent />
    </Suspense>
  );
}
