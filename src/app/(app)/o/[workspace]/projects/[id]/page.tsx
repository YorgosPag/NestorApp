import { withQuery } from '@/lib/workspace/route-worlds';
import { redirect } from '@/lib/workspace/server-navigation';

interface ProjectDetailRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Canonical project deep-link handler.
 * Redirects `/projects/:id` → `/projects?projectId=:id`, **μέσα στον ίδιο χώρο** (ADR-875 §11).
 */
export default async function ProjectDetailRedirect({ params }: ProjectDetailRedirectProps) {
  const { workspace, id } = await params;
  redirect(withQuery('/projects', `projectId=${encodeURIComponent(id)}`), workspace);
}
