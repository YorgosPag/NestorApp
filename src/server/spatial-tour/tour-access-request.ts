import 'server-only';

/**
 * @fileoverview **ΑΙΤΗΜΑ ΘΕΑΣΗΣ ΠΕΡΙΗΓΗΣΗΣ** (`on-request`) — η πλευρά του **αιτούντος**.
 * @related ADR-884 Φ0.13 · πρότυπο `server/auth/workspace-access-request.ts` (ADR-853) · `tour-access-decision.ts`
 * @module server/spatial-tour/tour-access-request
 *
 * Πρότυπο **Google Drive «Request access»**: λογαριασμός υποχρεωτικός, ο υπεύθυνος βλέπει **ποιος** ζήτησε,
 * η έγκριση δένεται στον **λογαριασμό** — προωθημένος σύνδεσμος δεν δίνει τίποτα σε τρίτον.
 *
 * 🏆 **Πέρα από το Drive**: η έγκριση **λήγει υποχρεωτικά**, και η λήξη **δεν γράφεται ποτέ** — το εγκεκριμένο
 * αίτημα είναι άδεια `tour:view` και το «ισχύει;» το απαντά ο **ένας** κριτής αδειών (`tourAccessStanding`).
 * Κανένα cron, κανένα «approved» που ισχύει μετά τη λήξη του.
 *
 * 🔑 **Ντετερμινιστικό έγγραφο ανά (περιήγηση, άνθρωπο)**: το δεύτερο αίτημα **είναι** το πρώτο — idempotent,
 * και ο υπεύθυνος δεν βλέπει ποτέ δέκα αιτήματα του ίδιου ανθρώπου (βλέπει `requestCount`).
 *
 * 🔴 **Εγγραφή μόνο στον διακομιστή** — οι κανόνες είναι `read, write: if false` (Φ0.9). Διαδρομές:
 * `app/api/spatial-tours/[kind]/[subjectId]/my-access` (Κ3β)· ίχνος: `tour-view-trace.ts`· επαφή: `tour-access-decision.ts`.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { TourAccessStanding } from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { tourAccessRequestFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { tourAccessStanding } from '@/lib/spatial-tour/tour-authority';
import type { TourAccessRequest, TourSubject } from '@/types/spatial-tour';

import {
  locateExistingTour,
  refuseTourAccess,
  tourAccessRequestRef,
  type TourAccessRefused,
} from './tour-access-shared';

/** Το μήνυμα του αιτούντος — αρκετό για «ποιος είμαι και γιατί», όχι για επισύναψη. */
export const TOUR_ACCESS_MESSAGE_MAX = 1000;

interface RequesterInput {
  readonly subject: TourSubject;
  readonly requesterUid: string;
}

export type TourAccessRequestOutcome =
  | { readonly kind: 'requested' | 'already-pending' | 'already-active'; readonly request: TourAccessRequest }
  | TourAccessRefused;

/**
 * Το νέο/ανανεωμένο εκκρεμές — ό,τι αποφασίστηκε πριν **σβήνει**· η ιστορία μένει στο `requestCount`, στο
 * **ίχνος θέασης** και στην **επαφή CRM** (ο άνθρωπος είναι ο ίδιος, Κ3β).
 */
function pendingDocument(
  tourId: string, uid: string, message: string | null, at: string, stored: TourAccessRequest | null,
) {
  return {
    tourId, requesterUid: uid, message, state: 'pending' as const, requestedAt: at,
    requestCount: (stored?.requestCount ?? 0) + 1,
    decidedAt: null, decidedBy: null, expiresAt: null, revokedAt: null, revokedBy: null,
    viewCount: stored?.viewCount ?? 0, lastViewedAt: stored?.lastViewedAt ?? null, contactId: stored?.contactId ?? null,
  };
}

/** Κενό ή μόνο κενά ⇒ `null`· αλλιώς περικομμένο στο όριο. */
function normalizeMessage(message: string | null): string | null {
  const trimmed = message?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed.slice(0, TOUR_ACCESS_MESSAGE_MAX);
}

/**
 * **«Αφήστε με να δω.»** — μόνο σε δημοσιευμένη περιήγηση `on-request`. Ξανα-αίτημα μετά από απόρριψη,
 * απόσυρση, ανάκληση ή λήξη ανοίγει ξανά το **ίδιο** έγγραφο· σε εκκρεμές ή ενεργό **δεν γράφει** τίποτα.
 */
export async function requestTourAccess(
  db: Firestore,
  input: RequesterInput & { readonly message: string | null },
): Promise<TourAccessRequestOutcome> {
  const located = await locateExistingTour(db, input.subject);
  if (located.kind === 'refused') return located;
  const { tour, tourRef } = located;
  if (tour.visibility !== 'on-request' || tour.lifecycle !== 'published') return refuseTourAccess('not-requestable');

  const ref = tourAccessRequestRef(tourRef, input.requesterUid);
  const message = normalizeMessage(input.message);
  const at = nowISO();
  return db.runTransaction<TourAccessRequestOutcome>(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), ref.id) : null;
    const standing = stored === null ? null : tourAccessStanding(stored, Date.parse(at));
    if (stored !== null && standing === 'pending') return { kind: 'already-pending', request: stored };
    if (stored !== null && standing === 'active') return { kind: 'already-active', request: stored };

    const doc = pendingDocument(tour.id, input.requesterUid, message, at, stored);
    tx.set(ref, doc);
    return { kind: 'requested', request: { id: ref.id, ...doc } };
  });
}

/** **Απόσυρση** — μόνο εκκρεμούς, μόνο από τον ίδιο (το έγγραφο είναι δικό του κατά κατασκευή του id). */
export async function withdrawTourAccessRequest(
  db: Firestore,
  input: RequesterInput,
): Promise<{ readonly kind: 'withdrawn' } | TourAccessRefused> {
  const located = await locateExistingTour(db, input.subject);
  if (located.kind === 'refused') return located;
  const ref = tourAccessRequestRef(located.tourRef, input.requesterUid);
  return db.runTransaction<{ readonly kind: 'withdrawn' } | TourAccessRefused>(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), ref.id) : null;
    if (stored === null) return refuseTourAccess('request-absent');
    if (stored.state !== 'pending') return refuseTourAccess('not-pending');
    tx.update(ref, { state: 'withdrawn', decidedAt: nowISO(), decidedBy: input.requesterUid });
    return { kind: 'withdrawn' };
  });
}

/** Η θέση **και** το αίτημα του ανθρώπου — ό,τι χρειάζονται η οθόνη του (λήξη, μήνυμα) και η πύλη θέασης (id). */
export interface MyTourAccess {
  readonly standing: TourAccessStanding | 'none';
  readonly request: TourAccessRequest | null;
}

/** **Πού βρίσκεται το αίτημά μου;** — `none` όταν δεν ζήτησε ποτέ (ή η περιήγηση δεν υπάρχει). */
export async function readMyTourAccess(db: Firestore, input: RequesterInput): Promise<MyTourAccess> {
  const located = await locateExistingTour(db, input.subject);
  if (located.kind === 'refused') return { standing: 'none', request: null };
  const snap = await tourAccessRequestRef(located.tourRef, input.requesterUid).get();
  const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), snap.id) : null;
  return stored === null
    ? { standing: 'none', request: null }
    : { standing: tourAccessStanding(stored, Date.now()), request: stored };
}

/** Μόνο η θέση — ο στενός δρόμος του {@link readMyTourAccess}. */
export async function readTourViewStanding(
  db: Firestore,
  input: RequesterInput,
): Promise<TourAccessStanding | 'none'> {
  return (await readMyTourAccess(db, input)).standing;
}
