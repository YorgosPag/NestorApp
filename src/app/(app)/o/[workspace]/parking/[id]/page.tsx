import { redirect } from 'next/navigation';

interface ParkingDetailRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical parking deep-link handler.
 *
 * Redirects `/parking/:id` → `/spaces/parking?parkingId=:id`.
 * Used by: AuditTimeline, OverdueAlert notifications.
 *
 * Pattern: permanent redirect (308) — no client bundle, pure server component.
 */
export default async function ParkingDetailRedirect({ params }: ParkingDetailRedirectProps) {
  const { id } = await params;
  redirect(`/spaces/parking?parkingId=${id}`);
}
