import { redirect } from '@/lib/workspace/server-navigation';

interface ProjectProcurementRootRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * @module /projects/[id]/procurement
 * @enterprise ADR-330 §5.1 S2 — Default sub-tab redirect (Overview), μέσα στον ίδιο χώρο (ADR-875 §11).
 */
export default async function ProjectProcurementRootRedirect({
  params,
}: ProjectProcurementRootRedirectProps) {
  const { workspace, id } = await params;
  redirect(`/projects/${encodeURIComponent(id)}/procurement/overview`, workspace);
}
