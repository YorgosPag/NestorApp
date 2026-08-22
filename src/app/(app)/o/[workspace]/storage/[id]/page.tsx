import { redirect } from 'next/navigation';

interface StorageDetailRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical storage deep-link handler.
 *
 * Redirects `/storage/:id` → `/spaces/storage?storageId=:id`.
 * Used by: AuditTimeline, OverdueAlert notifications, ShareButton.
 *
 * Pattern: permanent redirect (308) — no client bundle, pure server component.
 */
export default async function StorageDetailRedirect({ params }: StorageDetailRedirectProps) {
  const { id } = await params;
  redirect(`/spaces/storage?storageId=${id}`);
}
