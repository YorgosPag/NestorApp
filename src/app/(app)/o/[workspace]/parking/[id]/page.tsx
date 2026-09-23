import { withQuery } from '@/lib/workspace/route-worlds';
import { redirect } from '@/lib/workspace/server-navigation';

interface ParkingDetailRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Canonical parking deep-link handler.
 *
 * Redirects `/parking/:id` → `/spaces/parking?parkingId=:id`, **μέσα στον ίδιο χώρο** (ADR-875 §11).
 * Used by: AuditTimeline, OverdueAlert notifications.
 *
 * Pattern: temporary redirect (307) — no client bundle, pure server component.
 */
export default async function ParkingDetailRedirect({ params }: ParkingDetailRedirectProps) {
  const { workspace, id } = await params;
  redirect(withQuery('/spaces/parking', `parkingId=${encodeURIComponent(id)}`), workspace);
}
