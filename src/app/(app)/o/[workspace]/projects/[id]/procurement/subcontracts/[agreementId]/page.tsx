import { SubcontractAgreementDetailClient } from '@/components/projects/procurement/subcontracts/SubcontractAgreementDetailClient';

interface ProjectSubcontractAgreementPageProps {
  params: Promise<{ id: string; agreementId: string }>;
}

/**
 * @module /projects/[id]/procurement/subcontracts/[agreementId]
 * @enterprise ADR-928 Φ3γ — One subcontract agreement: the editor (form | live preview) while it is a draft, the
 *   document read-only afterwards; lifecycle actions, deviations. Tenant guard in the procurement layout.
 */
export default async function ProjectSubcontractAgreementPage({ params }: ProjectSubcontractAgreementPageProps) {
  const { id, agreementId } = await params;
  return <SubcontractAgreementDetailClient projectId={id} agreementId={agreementId} />;
}
