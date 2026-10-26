/**
 * **`/o/<χώρος>/catalog/assets` — «Βιβλιοθήκη μέσων» του καταλόγου** (ADR-923 §5.10.4).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link AssetsContent}.
 * ⚠️ **`<Suspense>`**: η επιλογή ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/catalog/assets/page
 */

import React, { Suspense } from 'react';

import { AssetsContent } from '@/components/catalog/assets/AssetsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogAssetsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <AssetsContent />
    </Suspense>
  );
}
