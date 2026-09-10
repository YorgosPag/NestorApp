import { redirect } from 'next/navigation';

import { workspacePath } from '@/lib/workspace/workspace-path';

interface ContactDetailRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Canonical contact deep-link handler.
 *
 * Redirects `/o/<χώρος>/contacts/:id` → `/o/<χώρος>/contacts?contactId=:id`.
 * Used by: AuditTimeline, notifications, ShareButton.
 *
 * Pattern: `redirect()` (307) — no client bundle, pure server component.
 *
 * ⚠️ **ΜΕΣΑ ΣΤΟΝ ΙΔΙΟ ΧΩΡΟ** (ADR-843 §10.19): έγραφε σκέτο `/contacts?…`, δηλαδή ένα
 * περιττό άλμα μέσω του διχτυού — και από 2026-09-04 ως 2026-09-10, όσο το `/contacts`
 * ανήκε στις ιδιωτικές επαφές του `(me)`, κατέληγε σε **λάθος σελίδα**. Το
 * `params.workspace` είναι ήδη εδώ: server redirect κάτω από το `o/[workspace]` καλεί
 * το `workspacePath` **απευθείας** (σύμβαση του συνόρου, `navigation-boundary/contract.js`).
 */
export default async function ContactDetailRedirect({ params }: ContactDetailRedirectProps) {
  const { workspace, id } = await params;
  redirect(workspacePath(workspace, `/contacts?contactId=${encodeURIComponent(id)}`));
}
