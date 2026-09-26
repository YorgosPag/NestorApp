import 'server-only';

/**
 * @fileoverview **ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΑΙΤΗΜΑΤΑ ΘΕΑΣΗΣ** — ό,τι βλέπει ο υπεύθυνος για κάθε άνθρωπο (ADR-884 Φ0.13 · Κ3β).
 * @related `tour-access-decision.ts` (`listTourAccessRequests` — η ανάγνωση) · `server/auth/account-identities.ts`
 * @module server/spatial-tour/tour-access-inbox
 *
 * 🏆 **Google Drive δείχνει όνομα + email + μήνυμα. Εδώ επιπλέον**: η **θέση τώρα** (ενεργή · έληξε · ανακλήθηκε —
 * παράγεται, δεν αποθηκεύεται), το **ίχνος** («είδε 3 φορές, τελευταία χθες»), πόσες φορές ζήτησε, και αν έγινε
 * **επαφή CRM**. Ένα βλέμμα αρκεί για να ξέρει ο μεσίτης ποιος ενδιαφέρεται στ' αλήθεια.
 *
 * 🔑 **Η ταυτότητα από την πηγή, τη στιγμή της ανάγνωσης** — όχι αντίγραφο στο αίτημα.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { TourAccessStanding } from '@/constants/spatial-tour-vocabulary';
import { tourAccessStanding } from '@/lib/spatial-tour/tour-authority';
import { readAccountIdentities } from '@/server/auth/account-identities';

import { listTourAccessRequests } from './tour-access-decision';
import type { TourAccessRefused } from './tour-access-shared';

/** Μία γραμμή των εισερχομένων — **μόνο** ό,τι χρειάζεται η οθόνη του υπευθύνου. */
export interface TourAccessInboxRow {
  readonly requesterUid: string;
  /** `null` ⇒ ο λογαριασμός δεν διαβάστηκε (άγνωστος, όχι «χωρίς όνομα»). */
  readonly name: string | null;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly message: string | null;
  readonly standing: TourAccessStanding;
  readonly requestedAt: string;
  readonly requestCount: number;
  readonly decidedAt: string | null;
  readonly expiresAt: string | null;
  readonly viewCount: number;
  readonly lastViewedAt: string | null;
  readonly hasContact: boolean;
}

/** **Τα αιτήματα μιας κατάστασης, με πρόσωπο.** */
export async function listTourAccessInbox(
  db: Firestore,
  input: Parameters<typeof listTourAccessRequests>[1],
): Promise<{ readonly kind: 'listed'; readonly rows: readonly TourAccessInboxRow[] } | TourAccessRefused> {
  const listed = await listTourAccessRequests(db, input);
  if (listed.kind === 'refused') return listed;
  const identities = await readAccountIdentities(db, listed.requests.map((request) => request.requesterUid));
  const nowMs = Date.now();
  const rows = listed.requests.map((request): TourAccessInboxRow => {
    const identity = identities.get(request.requesterUid);
    return {
      requesterUid: request.requesterUid,
      name: identity?.displayName ?? null,
      email: identity?.email ?? null,
      emailVerified: identity?.emailVerified ?? false,
      message: request.message,
      standing: tourAccessStanding(request, nowMs),
      requestedAt: request.requestedAt,
      requestCount: request.requestCount,
      decidedAt: request.decidedAt,
      expiresAt: request.expiresAt,
      viewCount: request.viewCount,
      lastViewedAt: request.lastViewedAt,
      hasContact: request.contactId !== null,
    };
  });
  return { kind: 'listed', rows };
}

