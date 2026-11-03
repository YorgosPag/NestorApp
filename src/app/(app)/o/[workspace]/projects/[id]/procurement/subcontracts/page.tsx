import { ProjectSubcontractsClient } from '@/components/projects/procurement/subcontracts/ProjectSubcontractsClient';

interface ProjectProcurementSubcontractsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement/subcontracts
 * @enterprise ADR-928 §5.14 · §5.15 · Φ3α-2 — Sub-tab Subcontracts: the project's subcontract agreements, including
 *   master agreements with a work order on this project. Tenant guard in the procurement layout.
 */
export default async function ProjectProcurementSubcontractsPage({
  params,
}: ProjectProcurementSubcontractsPageProps) {
  const { id } = await params;
  return <ProjectSubcontractsClient projectId={id} />;
}
