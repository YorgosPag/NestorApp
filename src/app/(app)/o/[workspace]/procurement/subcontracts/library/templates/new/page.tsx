/**
 * **`/o/<χώρος>/procurement/subcontracts/library/templates/new` — νέο πρότυπο ειδικότητας** (ADR-928 §5.22 · Φ3γ-0b-2).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link NewTemplateClient}. Νέο πρότυπο = αντίγραφο του `?from=<id>`.
 * ⚠️ **`<Suspense>`**: η αφετηρία ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/procurement/subcontracts/library/templates/new/page
 */

import React, { Suspense } from 'react';

import { NewTemplateClient } from '@/components/procurement/subcontracts/library/templates/NewTemplateClient';
import { StaticPageLoading } from '@/core/states';

export default function NewSubcontractTemplatePage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <NewTemplateClient />
    </Suspense>
  );
}
