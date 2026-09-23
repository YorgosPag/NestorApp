import { withQuery } from '@/lib/workspace/route-worlds';
import { redirect } from '@/lib/workspace/server-navigation';

interface StorageDetailRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Canonical storage deep-link handler.
 *
 * Redirects `/storage/:id` → `/spaces/storage?storageId=:id`, **μέσα στον ίδιο χώρο** (ADR-875 §11).
 * Used by: AuditTimeline, OverdueAlert notifications, ShareButton.
 *
 * Pattern: temporary redirect (307) — no client bundle, pure server component.
 */
export default async function StorageDetailRedirect({ params }: StorageDetailRedirectProps) {
  const { workspace, id } = await params;
  redirect(withQuery('/spaces/storage', `storageId=${encodeURIComponent(id)}`), workspace);
}
