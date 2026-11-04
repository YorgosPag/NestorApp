/**
 * **`/o/<χώρος>/procurement/subcontracts/library` — η βιβλιοθήκη ρητρών και προτύπων υπεργολαβίας** (ADR-928 §5.19).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link SubcontractLibraryContent}.
 * ⚠️ **`<Suspense>`**: η επιλογή (καρτέλα · ρήτρα · πρότυπο) ζει στη διεύθυνση (`useSearchParams`, CHECK 3.55).
 * Ο φάκελος `procurement/subcontracts/` κρατά χώρο για μελλοντική λίστα όλων των συμφωνητικών της εταιρείας.
 *
 * @module app/(app)/o/[workspace]/procurement/subcontracts/library/page
 */

import React, { Suspense } from 'react';

import { SubcontractLibraryContent } from '@/components/procurement/subcontracts/library/SubcontractLibraryContent';
import { StaticPageLoading } from '@/core/states';

export default function SubcontractLibraryPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SubcontractLibraryContent />
    </Suspense>
  );
}
