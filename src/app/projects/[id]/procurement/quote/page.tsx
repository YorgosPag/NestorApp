import { ProjectQuoteListClient } from '@/components/projects/procurement/clients/ProjectQuoteListClient';

interface ProjectProcurementQuotePageProps {
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement/quote
 * @enterprise ADR-330 §5.1 S2 — Sub-tab Quote (project-scoped list).
 *   Comparison panel deferred to a follow-up session — click navigates to
 *   the project-scoped review URL via `getQuoteDetailUrl` (S1 SSoT helper).
 */
export default async function ProjectProcurementQuotePage({
  params,
}: ProjectProcurementQuotePageProps) {
  const { id } = await params;
  return <ProjectQuoteListClient projectId={id} />;
}
