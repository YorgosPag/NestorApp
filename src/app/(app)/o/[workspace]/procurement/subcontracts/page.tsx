/**
 * **`/o/<χώρος>/procurement/subcontracts` — οι κύριες συμβάσεις υπεργολαβίας της εταιρείας** (ADR-928 §5.24).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link MasterAgreementsClient}.
 * ⚠️ **`<Suspense>`**: το φίλτρο κατάστασης ζει στη διεύθυνση (`?status=`, `useSearchParams`, CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/procurement/subcontracts/page
 */

import React, { Suspense } from 'react';

import { MasterAgreementsClient } from '@/components/procurement/subcontracts/masters/MasterAgreementsClient';
import { StaticPageLoading } from '@/core/states';

export default function SubcontractMasterAgreementsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <MasterAgreementsClient />
    </Suspense>
  );
}
