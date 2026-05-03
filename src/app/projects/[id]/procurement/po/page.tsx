import { ProjectPoListClient } from '@/components/projects/procurement/clients/ProjectPoListClient';

interface ProjectProcurementPoPageProps {
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement/po
 * @enterprise ADR-330 §5.1 S2 — Sub-tab Purchase Orders (project-scoped list).
 */
export default async function ProjectProcurementPoPage({
  params,
}: ProjectProcurementPoPageProps) {
  const { id } = await params;
  return <ProjectPoListClient projectId={id} />;
}
