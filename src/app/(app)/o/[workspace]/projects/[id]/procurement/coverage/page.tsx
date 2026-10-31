import { ProjectBuyoutClient } from '@/components/projects/procurement/buyout/ProjectBuyoutClient';

interface ProjectProcurementCoveragePageProps {
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement/coverage
 * @enterprise ADR-330 §5.1 S3.2 — Sub-tab Coverage (Buyout): counted BOQ lines vs PO / open-RFQ coverage.
 */
export default async function ProjectProcurementCoveragePage({
  params,
}: ProjectProcurementCoveragePageProps) {
  const { id } = await params;
  return <ProjectBuyoutClient projectId={id} />;
}
