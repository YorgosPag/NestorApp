/**
 * **`/o/<χώρος>/procurement/subcontracts/library/templates/[templateId]` — επεξεργασία προτύπου ειδικότητας**
 * (ADR-928 §5.22 · Φ3γ-0b-2).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link EditTemplateClient}.
 * ⚠️ **`<Suspense>`**: η κοινή σελίδα διαβάζει τη διεύθυνση (`useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/procurement/subcontracts/library/templates/[templateId]/page
 */

import React, { Suspense } from 'react';

import { EditTemplateClient } from '@/components/procurement/subcontracts/library/templates/EditTemplateClient';
import { StaticPageLoading } from '@/core/states';

interface EditSubcontractTemplatePageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditSubcontractTemplatePage({ params }: EditSubcontractTemplatePageProps) {
  const { templateId } = await params;
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <EditTemplateClient templateId={templateId} />
    </Suspense>
  );
}
