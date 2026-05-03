import { redirect } from 'next/navigation';

interface ProjectProcurementRootRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement
 * @enterprise ADR-330 §5.1 S2 — Default sub-tab redirect (Overview).
 */
export default async function ProjectProcurementRootRedirect({
  params,
}: ProjectProcurementRootRedirectProps) {
  const { id } = await params;
  redirect(`/projects/${id}/procurement/overview`);
}
