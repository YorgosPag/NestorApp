import { redirect } from 'next/navigation';

interface ContactDetailRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical contact deep-link handler.
 *
 * Redirects `/contacts/:id` → `/contacts?contactId=:id`.
 * Used by: AuditTimeline, notifications, ShareButton.
 *
 * Pattern: permanent redirect (308) — no client bundle, pure server component.
 */
export default async function ContactDetailRedirect({ params }: ContactDetailRedirectProps) {
  const { id } = await params;
  redirect(`/contacts?contactId=${id}`);
}
