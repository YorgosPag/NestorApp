import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
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
  redirect(ENTITY_ROUTES.buildings.withId(id), workspace);
}
