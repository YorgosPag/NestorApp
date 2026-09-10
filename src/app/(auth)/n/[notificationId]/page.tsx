/**
 * @fileoverview **Ο ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ** — ό,τι πατά ο άνθρωπος μέσα στο email.
 * @related ADR-848 · server/notifications/notification-permalink.ts
 * @module app/(auth)/n/[notificationId]/page
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΡΟΗ, ΚΑΙ ΓΙΑΤΙ ΚΑΘΕ ΒΗΜΑ ΕΙΝΑΙ ΕΚΕΙ ΠΟΥ ΕΙΝΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Ανώνυμος ⇒ σύνδεση, ΠΡΙΝ από κάθε ανάγνωση βάσης** — με `?next=` πίσω εδώ. Ούτε
 *    ο χρόνος απόκρισης δεν προδίδει αν η ειδοποίηση υπάρχει. Και ένας σαρωτής
 *    συνδέσμων (Safe Links) καταλήγει εδώ: **δεν γράφεται τίποτα**.
 * 2. **Δική σου ⇒ «διαβάστηκε» + ανακατεύθυνση** στον προορισμό, μέσα στον **δικό σου**
 *    χώρο — λυμένο τώρα, όχι όταν στάλθηκε το email.
 * 3. **Ξένη ή ανύπαρκτη ⇒ η ΙΔΙΑ οθόνη.**
 *
 * 🔴 **ΓΙΑΤΙ ΣΤΟ `(auth)`**: ο άνθρωπος φτάνει από email, συχνά αποσυνδεδεμένος — ίδια
 * δήλωση με τα `mandate/[token]` · `auth/action` (`.shell-boundary.json`: `wearsShell:
 * false`). Το κέλυφος της εφαρμογής θα φορτωνόταν για μια σελίδα που **ανακατευθύνει**.
 *
 * ⚠️ **`force-dynamic`** (ανά αίτημα, CHECK 3.55) · **`noindex`** · **`no-referrer`**:
 * ο σύνδεσμος ονομάζει ειδοποίηση ανθρώπου και δεν πρέπει να διαρρέει ως `Referer`.
 */

import 'server-only';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationPermalinkUnavailable } from '@/components/notifications/NotificationPermalinkUnavailable';
import { notificationPermalinkHref } from '@/lib/notifications/notification-permalink-route';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { loginHref } from '@/lib/routes/return-path';
import { readPageIdentity } from '@/server/auth/page-identity';
import { openNotificationPermalink } from '@/server/notifications/notification-permalink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function NotificationPermalinkPage({
  params,
}: {
  params: Promise<{ notificationId: string }>;
}): Promise<React.ReactElement> {
  const { notificationId: raw } = await params;
  const notificationId = decodeRouteParam(raw);

  const identity = await readPageIdentity();
  if (!identity.ok) redirect(loginHref(notificationPermalinkHref(notificationId)));

  const verdict = await openNotificationPermalink(notificationId, identity);
  if (verdict.kind === 'redirect') redirect(verdict.to);

  return <NotificationPermalinkUnavailable />;
}
