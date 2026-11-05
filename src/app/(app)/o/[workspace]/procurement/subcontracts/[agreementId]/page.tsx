import { MasterAgreementDetailClient } from '@/components/procurement/subcontracts/masters/MasterAgreementDetailClient';

interface SubcontractMasterAgreementPageProps {
  params: Promise<{ agreementId: string }>;
}

/**
 * @module /procurement/subcontracts/[agreementId]
 * @enterprise ADR-928 §5.24 — One master subcontract agreement in the company context: the editor while it is a draft,
 *   the document afterwards; lifecycle actions, deviations, work orders. Every decision falls to the company (no
 *   project role is borrowed). Tenant guard in the procurement layout; unknown or foreign ⇒ «not found» (ADR-742).
 */
export default async function SubcontractMasterAgreementPage({ params }: SubcontractMasterAgreementPageProps) {
  const { agreementId } = await params;
  return <MasterAgreementDetailClient agreementId={agreementId} />;
}
