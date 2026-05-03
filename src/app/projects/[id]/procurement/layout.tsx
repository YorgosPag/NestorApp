import { notFound } from 'next/navigation';
import { requireProjectForPage } from '@/server/auth/require-project-for-page';

interface ProjectProcurementLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

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

  return <>{children}</>;
}
