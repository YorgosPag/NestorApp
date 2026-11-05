'use client';

/**
 * Μια κύρια σύμβαση **στο πλαίσιο της εταιρείας** (ADR-928 §5.24). Λεπτός φάκελος: route slice της εταιρείας + η κοινή
 * σελίδα (`SubcontractAgreementDetail`, `projectId: null` ⇒ κάθε κρίση πέφτει στην εταιρεία, «πίσω» στις κύριες).
 */

import { SubcontractAgreementDetail } from '@/components/procurement/subcontracts/SubcontractAgreementDetail';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts__agreementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function MasterAgreementDetailClient({ agreementId }: { readonly agreementId: string }) {
  return <SubcontractAgreementDetail projectId={null} agreementId={agreementId} />;
}
