/**
 * **`/o/<χώρος>/document-expiry` — «Λήξεις εγγράφων»** (ADR-915 Φ4γ · Ε5).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link DocumentRegistryContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * Το route slice το καταχωρεί το περιεχόμενο (Client Component) — εδώ θα έγραφε σε **άλλο** στιγμιότυπο i18next.
 *
 * 🔑 **Χωρίς `policy`** (Ε5): η ανάγνωση φυλάσσεται από το `withAuth` + `ctx.companyId` του `GET /api/document-registry`.
 * ⚠️ **`<Suspense>` επειδή η προβολή ζει στη διεύθυνση** (`useSearchParams`): χωρίς όριο, το `next build` ρίχνει
 *    ολόκληρη τη διαδρομή σε απόδοση πελάτη (CHECK 3.55). Ίδιο ιδίωμα με την καρτέλα ακινήτου.
 *
 * @module app/(app)/o/[workspace]/document-expiry/page
 */

import React, { Suspense } from 'react';

import { DocumentRegistryContent } from '@/components/document-registry/DocumentRegistryContent';
import { StaticPageLoading } from '@/core/states';

export default function DocumentExpiryPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <DocumentRegistryContent />
    </Suspense>
  );
}
