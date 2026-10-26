/**
 * **`/o/<χώρος>/catalog/products` — προϊόντα: ενιαίο πλέγμα + επεξεργαστής** (ADR-923 §5.10.4 Β2/Β3).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ProductsContent}.
 * ⚠️ **`<Suspense>`**: η επιλογή ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/catalog/products/page
 */

import React, { Suspense } from 'react';

import { ProductsContent } from '@/components/catalog/products/ProductsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogProductsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <ProductsContent />
    </Suspense>
  );
}
