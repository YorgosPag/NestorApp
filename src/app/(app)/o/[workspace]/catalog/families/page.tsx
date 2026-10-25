/**
 * **`/o/<χώρος>/catalog/families` — «Οικογένειες προϊόντων» του καταλόγου** (ADR-923 Φάση 1γ).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link FamiliesContent}.
 * ⚠️ **`<Suspense>`**: η επιλογή ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/catalog/families/page
 */

import React, { Suspense } from 'react';

import { FamiliesContent } from '@/components/catalog/families/FamiliesContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogFamiliesPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <FamiliesContent />
    </Suspense>
  );
}
