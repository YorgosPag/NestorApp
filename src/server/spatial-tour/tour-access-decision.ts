import 'server-only';

/**
 * @fileoverview **ΑΙΤΗΜΑ ΘΕΑΣΗΣ ΠΕΡΙΗΓΗΣΗΣ** — η πλευρά του **υπευθύνου**: απόφαση (και μαζική), ανάκληση, λίστα.
 * @related ADR-884 Φ0.13 · Φ0.3 · `tour-access-request.ts` (ο αιτών)
 * @module server/spatial-tour/tour-access-decision
 *
 * 🔑 **Η έγκριση ΖΗΤΑ λήξη** — ποτέ προεπιλογή εδώ. Η πρόταση «μέχρι τη λήξη της εντολής» είναι της οθόνης (Κ3)·
 * ο διακομιστής δέχεται **μόνο** ρητή, μελλοντική στιγμή εντός ορίζοντα (`checkTourGrantExpiry`).
 *
 * 🔑 **Κάθε αίτημα σε δική του συναλλαγή** — η μαζική απόφαση επιστρέφει αποτέλεσμα **ανά άνθρωπο**: ένα
 * αίτημα που αποσύρθηκε στο μεταξύ δεν ρίχνει τα άλλα είκοσι (το Gmail κάνει το ίδιο στις μαζικές ενέργειες).
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourAccessRequestState } from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { tourAccessRequestFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { tourAccessStanding, type TourActor } from '@/lib/spatial-tour/tour-authority';
import type { TourAccessRequest, TourSubject } from '@/types/spatial-tour';

import {
  checkTourGrantExpiry,
  locateManagedTour,
  refuseTourAccess,
  tourAccessRequestRef,
  type TourAccessRefusal,
  type TourAccessRefused,
} from './tour-access-shared';

/** Όσα αιτήματα διαβάζει μια λίστα υπευθύνου — φραγμένο ρητά. */
const LIST_LIMIT = 200;

interface ManagerInput {
  readonly subject: TourSubject;
  readonly actor: TourActor;
}

// =============================================================================
// 1. ΑΠΟΦΑΣΗ — και μαζική
// =============================================================================

export type TourAccessDecision = 'approved' | 'declined';

export type TourAccessDecisionResult =
  | { readonly requesterUid: string; readonly kind: 'decided'; readonly state: TourAccessDecision }
  | { readonly requesterUid: string; readonly kind: 'refused'; readonly reason: TourAccessRefusal };

async function decideOne(
  db: Firestore,
  ref: DocumentReference,
  seal: { readonly state: TourAccessDecision; readonly expiresAt: string | null; readonly by: string; readonly at: string },
): Promise<TourAccessRefusal | null> {
  return db.runTransaction<TourAccessRefusal | null>(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), ref.id) : null;
    if (stored === null) return 'request-absent';
    // 🔴 Μόνο πάνω σε εκκρεμές — ποτέ σιωπηλή ανατροπή απόφασης (ιδεμποτία · ADR-853).
    if (stored.state !== 'pending') return 'not-pending';
    const expiresAt = seal.state === 'approved' ? seal.expiresAt : null;
    tx.update(ref, { state: seal.state, decidedAt: seal.at, decidedBy: seal.by, expiresAt });
    return null;
  });
}

/**
 * **Έγκριση ή απόρριψη** ενός ή πολλών αιτημάτων — αποτέλεσμα ανά αιτούντα. Η λήξη ελέγχεται **μία** φορά,
 * πριν από οποιαδήποτε εγγραφή: άκυρη λήξη σε έγκριση ⇒ **καμία** αλλαγή.
 */
export async function decideTourAccessRequests(
  db: Firestore,
  input: ManagerInput & {
    readonly requesterUids: readonly string[];
    readonly decision: TourAccessDecision;
    readonly expiresAt: string | null;
  },
): Promise<{ readonly kind: 'decided'; readonly results: readonly TourAccessDecisionResult[] } | TourAccessRefused> {
  const at = nowISO();
  const expiry = input.decision === 'approved' ? checkTourGrantExpiry(input.expiresAt, Date.parse(at)) : null;
  if (expiry !== null && !expiry.ok) return refuseTourAccess(expiry.reason);

  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const seal = { state: input.decision, expiresAt: expiry?.ok ? expiry.expiresAt : null, by: input.actor.listing.uid, at };
  const uids = [...new Set(input.requesterUids)];
  const results = await Promise.all(uids.map(async (requesterUid): Promise<TourAccessDecisionResult> => {
    const reason = await decideOne(db, tourAccessRequestRef(managed.tourRef, requesterUid), seal);
    return reason === null
      ? { requesterUid, kind: 'decided', state: input.decision }
      : { requesterUid, kind: 'refused', reason };
  }));
  return { kind: 'decided', results };
}

// =============================================================================
// 2. ΑΝΑΚΛΗΣΗ — πράξη ανθρώπου, νικά τη λήξη
// =============================================================================

/** **Ανάκληση** ενεργής έγκρισης — η πρόσβαση κόβεται αμέσως στο έγγραφο (και το κουπόνι λήγει ≤ 15′, Φ0.4). */
export async function revokeTourAccess(
  db: Firestore,
  input: ManagerInput & { readonly requesterUid: string },
): Promise<{ readonly kind: 'revoked' } | TourAccessRefused> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const ref = tourAccessRequestRef(managed.tourRef, input.requesterUid);
  const at = nowISO();
  return db.runTransaction<{ readonly kind: 'revoked' } | TourAccessRefused>(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), ref.id) : null;
    if (stored === null) return refuseTourAccess('request-absent');
    if (tourAccessStanding(stored, Date.parse(at)) !== 'active') return refuseTourAccess('not-active');
    tx.update(ref, { revokedAt: at, revokedBy: input.actor.listing.uid });
    return { kind: 'revoked' };
  });
}

// =============================================================================
// 3. ΛΙΣΤΑ
// =============================================================================

/**
 * **Τα αιτήματα αυτής της περιήγησης σε μία κατάσταση**, νεότερα πρώτα. Η υποσυλλογή ζει **κάτω** από την
 * περιήγηση, άρα το ερώτημα είναι δομικά περιορισμένο στον κάτοχό της — κανένα `companyId` δεν χρειάζεται.
 * Έγγραφα που δεν διαβάζονται **παραλείπονται** (το σύνορο τα λέει `null`)· δεν μαντεύεται κατάσταση.
 */
export async function listTourAccessRequests(
  db: Firestore,
  input: ManagerInput & { readonly state: TourAccessRequestState },
): Promise<{ readonly kind: 'listed'; readonly requests: readonly TourAccessRequest[] } | TourAccessRefused> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση, που εντοπίστηκε από τη ρίζα της και κρίθηκε με
  //   `mayManageTour` — ο κάτοχος είναι ο ΓΟΝΕΑΣ· το προσωπικό διαμέρισμα δεν έχει καν companyId (ADR-884 Φ0.9).
  const snap = await managed.tourRef
    .collection(SUBCOLLECTIONS.TOUR_ACCESS_REQUESTS)
    .where('state', '==', input.state)
    .orderBy('requestedAt', 'desc')
    .limit(LIST_LIMIT)
    .get();
  const requests = snap.docs
    .map((doc) => tourAccessRequestFromDocument(doc.data(), doc.id))
    .filter((request): request is TourAccessRequest => request !== null);
  return { kind: 'listed', requests };
}
