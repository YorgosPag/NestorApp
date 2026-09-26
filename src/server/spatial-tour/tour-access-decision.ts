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

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourAccessRequestState } from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { tourAccessRequestFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { tourAccessStanding, type TourActor } from '@/lib/spatial-tour/tour-authority';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import { recordAccountContactBirth } from '@/services/contact/account-contact-resolver';
import type { TourAccessRequest, TourSubject } from '@/types/spatial-tour';

import {
  contactOutcomeOf,
  prepareTourAccessContacts,
  type PreparedTourContact,
  type TourAccessContactOutcome,
} from './tour-access-contact';

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
  | {
      readonly requesterUid: string;
      readonly kind: 'decided';
      readonly state: TourAccessDecision;
      /** Τι απέγινε η επαφή CRM (Φ0.13β) — `none` σε απόρριψη ή ιδιώτη κάτοχο. */
      readonly contact: TourAccessContactOutcome;
      /** Η υποβολή που κρίθηκε — ταυτότητα της **μετάβασης** για την ειδοποίηση (ιδεμποτία). */
      readonly requestId: string;
      readonly requestCount: number;
      readonly expiresAt: string | null;
    }
  | { readonly requesterUid: string; readonly kind: 'refused'; readonly reason: TourAccessRefusal };

type DecisionSeal = { readonly state: TourAccessDecision; readonly expiresAt: string | null; readonly by: string; readonly at: string };

/**
 * Η απόφαση για **έναν** — και, σε έγκριση, η επαφή CRM **στην ίδια** συναλλαγή: ή γράφονται και τα δύο, ή κανένα.
 * Επιστρέφει την άρνηση **ή** τον αριθμό της υποβολής που κρίθηκε.
 */
async function decideOne(
  db: Firestore,
  ref: DocumentReference,
  seal: DecisionSeal,
  prepared: PreparedTourContact | undefined,
): Promise<TourAccessRefusal | { readonly requestCount: number }> {
  return db.runTransaction<TourAccessRefusal | { readonly requestCount: number }>(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), ref.id) : null;
    if (stored === null) return 'request-absent';
    // 🔴 Μόνο πάνω σε εκκρεμές — ποτέ σιωπηλή ανατροπή απόφασης (ιδεμποτία · ADR-853).
    if (stored.state !== 'pending') return 'not-pending';
    const expiresAt = seal.state === 'approved' ? seal.expiresAt : null;
    const contact = seal.state === 'approved' && prepared?.kind === 'resolved' ? prepared.contact : null;
    if (contact?.doc) tx.set(db.collection(COLLECTIONS.CONTACTS).doc(contact.contactId), contact.doc);
    tx.update(ref, {
      state: seal.state, decidedAt: seal.at, decidedBy: seal.by, expiresAt,
      ...(contact ? { contactId: contact.contactId } : {}),
    });
    return { requestCount: stored.requestCount };
  });
}

/** Οι επαφές της έγκρισης — μόνο για **εταιρικό** κάτοχο (ο ιδιώτης δεν έχει CRM). */
function contactsFor(
  db: Firestore,
  input: { readonly decision: TourAccessDecision; readonly custody: CustodyScope; readonly tourRef: DocumentReference; readonly uids: readonly string[]; readonly by: string },
): Promise<ReadonlyMap<string, PreparedTourContact>> {
  const { companyId } = input.custody;
  if (input.decision !== 'approved' || companyId === undefined) return Promise.resolve(new Map());
  return prepareTourAccessContacts(db, { tourRef: input.tourRef, uids: input.uids, companyId, deciderUid: input.by });
}

/** Το ίχνος ADR-195 για κάθε επαφή που **γεννήθηκε** — μετά τη συναλλαγή, ποτέ μέσα της. */
async function recordContactBirths(
  results: readonly TourAccessDecisionResult[],
  prepared: ReadonlyMap<string, PreparedTourContact>,
  companyId: string | undefined,
  by: string,
): Promise<void> {
  if (companyId === undefined) return;
  await Promise.all(results.map((result) => {
    const entry = prepared.get(result.requesterUid);
    if (result.kind !== 'decided' || result.contact !== 'created' || entry?.kind !== 'resolved') return undefined;
    return recordAccountContactBirth({
      contactId: entry.contact.contactId, displayName: entry.contact.displayName, companyId, performedBy: by,
      origin: { field: 'tourAccessRequestUid', value: result.requesterUid, label: 'Αίτημα θέασης περιήγησης' },
    });
  }));
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
  const by = input.actor.listing.uid;
  const seal: DecisionSeal = { state: input.decision, expiresAt: expiry?.ok ? expiry.expiresAt : null, by, at };
  const uids = [...new Set(input.requesterUids)];
  const prepared = await contactsFor(db, { decision: input.decision, custody: managed.custody, tourRef: managed.tourRef, uids, by });
  const results = await Promise.all(uids.map(async (requesterUid): Promise<TourAccessDecisionResult> => {
    const contact = prepared.get(requesterUid);
    const ref = tourAccessRequestRef(managed.tourRef, requesterUid);
    const decided = await decideOne(db, ref, seal, contact);
    return typeof decided === 'string'
      ? { requesterUid, kind: 'refused', reason: decided }
      : {
          requesterUid, kind: 'decided', state: input.decision, contact: contactOutcomeOf(contact),
          requestId: ref.id, requestCount: decided.requestCount, expiresAt: seal.expiresAt,
        };
  }));
  await recordContactBirths(results, prepared, managed.custody.companyId, by);
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
