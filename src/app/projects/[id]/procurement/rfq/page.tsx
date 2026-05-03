import { ProjectRfqListClient } from '@/components/projects/procurement/clients/ProjectRfqListClient';

interface ProjectProcurementRfqPageProps {
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement/rfq
 * @enterprise ADR-330 §5.1 S2 — Sub-tab RFQ (project-scoped list).
 */
export default async function ProjectProcurementRfqPage({
  params,
}: ProjectProcurementRfqPageProps) {
  const { id } = await params;
  return <ProjectRfqListClient projectId={id} />;
}
