/**
 * **`/o/<χώρος>/catalog/categories` — «Κατηγορίες» του καταλόγου προϊόντων** (ADR-923 Φάση 1γ).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link CategoriesContent}.
 * ⚠️ **`<Suspense>`**: η επιλογή ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/catalog/categories/page
 */

import React, { Suspense } from 'react';

import { CategoriesContent } from '@/components/catalog/categories/CategoriesContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogCategoriesPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <CategoriesContent />
    </Suspense>
  );
}
