/**
 * @fileoverview **ΟΙ ΠΡΟΤΙΜΗΣΕΙΣ EMAIL ΜΕ ΕΙΣΙΤΗΡΙΟ** — ο σύνδεσμος του υποσέλιδου κάθε ειδοποίησης.
 * @related ADR-848 · services/notifications/email-subscription-token.service.ts
 * @module app/(auth)/email/preferences/[token]/page
 *
 * 🔑 **Χωρίς σύνδεση, επίτηδες** — η διαγραφή από email δεν επιτρέπεται να ζητά κωδικό
 * (Google, bulk sender guidelines). Η άδεια είναι το **υπογεγραμμένο** token: ένας
 * άνθρωπος, ένας σκοπός, μυστικό που ζει μόνο στον διακομιστή. Ίδιο σχήμα με το
 * `mandate/[token]`, στο ίδιο `(auth)` — **χωρίς** το κέλυφος της εφαρμογής.
 *
 * ⚠️ **Το GET ΔΕΝ ΓΡΑΦΕΙ ΤΙΠΟΤΑ.** Η σελίδα διαβάζει και δείχνει· κάθε αλλαγή είναι
 * POST πίσω από κουμπί. Οι σαρωτές συνδέσμων (Safe Links) την ανοίγουν χωρίς συνέπεια.
 *
 * ⚠️ **`force-dynamic`** (ανά token, CHECK 3.55) · **`noindex`** (το token είναι, στην
 * ουσία, διαπιστευτήριο) · **`no-referrer`** (να μη διαρρέει ως `Referer`).
 */

import 'server-only';

import type { Metadata } from 'next';

import { EmailPreferencesPanel } from '@/components/notifications/EmailPreferencesPanel';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { readEmailSubscriptionState } from '@/server/notifications/email-subscription';
import { readEmailSubscriptionToken } from '@/services/notifications/email-subscription-token.service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function EmailPreferencesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token: raw } = await params;
  const token = decodeRouteParam(raw);
  const verdict = readEmailSubscriptionToken(token);

  // 🔑 Η άρνηση **πριν** από κάθε ανάγνωση βάσης — πλαστό token δεν κοστίζει τίποτα.
  if (!verdict.ok) {
    const reason = verdict.reason === 'server-config' ? 'service-unavailable' : 'link-invalid';
    return <EmailPreferencesPanel view={{ kind: 'refused', reason }} />;
  }

  const state = await readEmailSubscriptionState(verdict.uid);
  return <EmailPreferencesPanel view={{ kind: 'ready', token, state }} />;
}
