import { withQuery } from '@/lib/workspace/route-worlds';
import { redirect } from '@/lib/workspace/server-navigation';

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
 * ανήκε στις ιδιωτικές επαφές του `(me)`, κατέληγε σε **λάθος σελίδα**.
 * 🔴 Η πρώτη διόρθωση κάλεσε το `workspacePath` με το χέρι: σωστή εδώ, αλλά ήταν η
 * **μία στις δεκατέσσερις** που το θυμήθηκε. Η κλάση κλείνει με το σύνορο του
 * διακομιστή και την πύλη 3.61 (ADR-875 §11).
 */
export default async function ContactDetailRedirect({ params }: ContactDetailRedirectProps) {
  const { workspace, id } = await params;
  redirect(withQuery('/contacts', `contactId=${encodeURIComponent(id)}`), workspace);
}
