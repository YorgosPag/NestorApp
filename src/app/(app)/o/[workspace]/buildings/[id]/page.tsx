import { withQuery } from '@/lib/workspace/route-worlds';
import { redirect } from '@/lib/workspace/server-navigation';

interface BuildingDetailRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Canonical building deep-link handler.
 * Redirects `/buildings/:id` → `/buildings?buildingId=:id`, **μέσα στον ίδιο χώρο** (ADR-875 §11).
 */
export default async function BuildingDetailRedirect({ params }: BuildingDetailRedirectProps) {
  const { workspace, id } = await params;
  redirect(withQuery('/buildings', `buildingId=${encodeURIComponent(id)}`), workspace);
}
