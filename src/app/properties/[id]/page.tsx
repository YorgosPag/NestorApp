import { redirect } from 'next/navigation';

interface PropertyDetailRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical property deep-link handler.
 *
 * Redirects `/properties/:id` → `/properties?propertyId=:id`.
 * Used by: ShareButton, AuditTimeline, OverdueAlert notifications.
 *
 * Pattern: permanent redirect (308) — link equity preserved, bookmarks updated.
 * No client bundle — pure server component.
 */
export default async function PropertyDetailRedirect({ params }: PropertyDetailRedirectProps) {
  const { id } = await params;
  redirect(`/properties?propertyId=${id}`);
}
