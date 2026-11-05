'use client';

/**
 * SubcontractAgreementDetailClient — η σελίδα ενός συμφωνητικού υπεργολαβίας **στο πλαίσιο ενός έργου** (ADR-928 Φ3γ
 * απόφαση 5). Λεπτός φάκελος: route slice του έργου + η κοινή σελίδα (`SubcontractAgreementDetail`), που ζει και στο
 * πλαίσιο της εταιρείας (κύριες συμβάσεις, §5.24).
 */

import { SubcontractAgreementDetail } from '@/components/procurement/subcontracts/SubcontractAgreementDetail';
import routeSlice from '@/i18n/generated/routes/o__workspace__projects__id__procurement__subcontracts__agreementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

interface Props {
  readonly projectId: string;
  readonly agreementId: string;
}

export function SubcontractAgreementDetailClient({ projectId, agreementId }: Props) {
  return <SubcontractAgreementDetail projectId={projectId} agreementId={agreementId} />;
}
