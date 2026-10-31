/**
 * **`/o/<χώρος>/catalog/imports` — «Εισαγωγή»** (ADR-923 §5.5).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ImportsContent}, γιατί ένα component δοκιμάζεται, ένα `page.tsx` όχι.
 * ⚠️ `<Suspense>` επειδή η επιλεγμένη παρτίδα ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 * @module app/(app)/o/[workspace]/catalog/imports/page
 */

import React, { Suspense } from 'react';

import { ImportsContent } from '@/components/catalog/imports/ImportsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogImportsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ImportsContent />
    </Suspense>
  );
}
