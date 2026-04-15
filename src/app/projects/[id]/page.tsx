import { redirect } from 'next/navigation';

interface ProjectDetailRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical project deep-link handler.
 * Redirects `/projects/:id` → `/projects?projectId=:id`.
 */
export default async function ProjectDetailRedirect({ params }: ProjectDetailRedirectProps) {
  const { id } = await params;
  redirect(`/projects?projectId=${id}`);
}
