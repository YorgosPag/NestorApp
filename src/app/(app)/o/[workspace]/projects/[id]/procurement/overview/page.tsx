/**
 * @module /projects/[id]/procurement/overview
 * @enterprise ADR-330 §5.1 S3 — Overview 5 KPIs (replaces S2 stub).
 */

import { ProjectProcurementOverview } from '@/components/projects/procurement/overview/ProjectProcurementOverview';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectProcurementOverviewPage({ params }: Props) {
  const { id } = await params;
  return <ProjectProcurementOverview projectId={id} />;
}
