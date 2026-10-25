/**
 * **`/o/<χώρος>/catalog/attributes` — «Ιδιότητες» του καταλόγου προϊόντων** (ADR-923 Φάση 1γ).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link AttributesContent}.
 * ⚠️ **`<Suspense>`**: η επιλογή ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/catalog/attributes/page
 */

import React, { Suspense } from 'react';

import { AttributesContent } from '@/components/catalog/attributes/AttributesContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogAttributesPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <AttributesContent />
    </Suspense>
  );
}
