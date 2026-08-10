import { redirect } from 'next/navigation';

interface BuildingDetailRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical building deep-link handler.
 * Redirects `/buildings/:id` → `/buildings?buildingId=:id`.
 */
export default async function BuildingDetailRedirect({ params }: BuildingDetailRedirectProps) {
  const { id } = await params;
  redirect(`/buildings?buildingId=${id}`);
}
