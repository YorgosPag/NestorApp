import { notFound } from 'next/navigation';
import { requireProjectForPage } from '@/server/auth/require-project-for-page';
import { ProjectProcurementTabs } from '@/components/projects/procurement/ProjectProcurementTabs';
import { BackToProjectLink } from '@/components/projects/procurement/BackToProjectLink';

interface ProjectProcurementLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement (layout)
 * @enterprise ADR-330 §5.1 S1+S2
 *   S1 — RBAC tenant guard via `requireProjectForPage`.
 *   S2 — RouteTabs SSoT (4 sub-tabs) + back link to project tab strip.
 */
export default async function ProjectProcurementLayout({
  children,
  params,
}: ProjectProcurementLayoutProps) {
  const { id } = await params;

  if (!id || id.startsWith('[')) {
    notFound();
  }

  try {
    await requireProjectForPage(id, `/projects/${id}/procurement`);
  } catch {
    notFound();
  }

  return (
    <main className="container mx-auto max-w-6xl py-4 space-y-4">
      <header className="space-y-2">
        <BackToProjectLink projectId={id} />
        <ProjectProcurementTabs projectId={id} />
      </header>
      <section>{children}</section>
    </main>
  );
}
