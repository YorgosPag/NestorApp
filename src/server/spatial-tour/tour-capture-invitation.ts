import 'server-only';

/**
 * @fileoverview **ΠΡΟΣΚΛΗΣΗ ΦΩΤΟΓΡΑΦΟΥ — Η ΠΛΕΥΡΑ ΤΟΥ ΥΠΕΥΘΥΝΟΥ**: έκδοση · ανάκληση πρόσκλησης · λίστα ·
 * ανάκληση άδειας λήψης.
 * @related ADR-884 Φ0.5 · Κ2β · ADR-853 §20 (κοινός πυρήνας) · `tour-capture-invitation-redeem.ts` (ο φωτογράφος)
 * @module server/spatial-tour/tour-capture-invitation
 *
 * 🔑 **Όχι ρόλος, όχι μέλος χώρου** (Φ0.5): ο φωτογράφος παίρνει **άδεια ανά περιήγηση** με λήξη. Ο μηχανισμός
 * πρόσκλησης είναι ο **κοινός πυρήνας** (`server/invitations/*`) — ίδιο token, ίδιες αρνήσεις, ίδιο supersede
 * με τις προσκλήσεις χώρου· εδώ ζει μόνο ό,τι είναι περιήγησης. Κάθε πράξη περνά από την **πόρτα του
 * υπευθύνου** (`locateManagedTour` → `mayManageTour`): καμία νέα αρχή εξουσιοδότησης (Φ0.3).
 *
 * 🏆 **Η πρόσκληση λήγει το αργότερο όταν θα έληγε η άδεια που υπόσχεται** — άρα είναι **δομικά αδύνατο** να
 * γίνει δεκτή πρόσκληση που γεννά ήδη ληγμένη άδεια (το «ναι» του φωτογράφου δεν καταλήγει ποτέ σε «δεν μπορείς»).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { evaluateScopedGrant } from '@/lib/auth/scoped-grant';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { nowISO } from '@/lib/date-local';
import { tourCaptureGrantFromDocument, tourCaptureInvitationFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyOnly, type CustodyScope } from '@/lib/workspace/custody-scope';
import {
  presentedInvitationState,
  revokeInvitationAt,
  writeInvitationWithSupersede,
  type RevokeInvitationOutcome,
} from '@/server/invitations/invitation-lifecycle';
import { defaultInvitationExpiryMs, mintInvitationToken } from '@/server/invitations/invitation-token';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { TourCaptureInvitation, TourSubject } from '@/types/spatial-tour';

import {
  checkTourGrantExpiry,
  locateManagedTour,
  refuseTourAccess,
  type TourAccessRefused,
} from './tour-access-shared';

const logger = createModuleLogger('tour-capture-invitation');

/**
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό με τις προσκλήσεις χώρου**: η υπογραφή δεν ξέρει σε ποια πύλη ανήκει·
 * με κοινό μυστικό, σύνδεσμος φωτογράφου με τα σωστά πεδία θα περνούσε για πρόσκληση σε γραφείο.
 */
export const TOUR_CAPTURE_INVITE_SECRET_ENV = 'TOUR_CAPTURE_INVITE_SECRET';

/** Όσες ζωντανές προσκλήσεις διαβάζει η λίστα του υπευθύνου — φραγμένο ρητά. */
const LIST_LIMIT = 200;

interface ManagerInput {
  readonly subject: TourSubject;
  readonly actor: TourActor;
}

// =============================================================================
// 1. ΕΚΔΟΣΗ
// =============================================================================

export interface IssueTourCaptureInvitationInput extends ManagerInput {
  /** Ωμό όπως το πληκτρολόγησε ο υπεύθυνος — κανονικοποιείται **εδώ**. */
  readonly inviteeEmailRaw: string;
  /** Η λήξη της **άδειας** — υποχρεωτική, μελλοντική, εντός ορίζοντα (`checkTourGrantExpiry`). */
  readonly grantExpiresAt: string | null;
  /** Γιατί δίνεται η άδεια — το βλέπει ο φωτογράφος και μένει στο ίχνος. */
  readonly reason: string;
}

export type IssueTourCaptureInvitationOutcome =
  | {
      readonly kind: 'issued';
      readonly invitation: TourCaptureInvitation;
      /** Ωμό **μόνο εδώ και στο email** — στη βάση ζει μόνο το `sha256` του nonce. */
      readonly token: string;
      readonly supersededCount: number;
    }
  | TourAccessRefused;

/**
 * **Νέα πρόσκληση φωτογράφου** — γράφει το έγγραφο και ανακαλεί κάθε προηγούμενη ζωντανή προς τον **ίδιο**
 * άνθρωπο στην **ίδια** περιήγηση, ατομικά. Επαναποστολή = νέα έκδοση (νέο token, νέα λήξη).
 * ⚠️ Οι έλεγχοι εισόδου τρέχουν **πριν** από κάθε ανάγνωση βάσης: άκυρη λήξη ⇒ καμία ερώτηση στη βάση.
 */
export async function issueTourCaptureInvitation(
  db: Firestore,
  input: IssueTourCaptureInvitationInput,
): Promise<IssueTourCaptureInvitationOutcome> {
  const nowValue = nowISO();
  const expiry = checkTourGrantExpiry(input.grantExpiresAt, Date.parse(nowValue));
  if (!expiry.ok) return refuseTourAccess(expiry.reason);
  const reason = input.reason.trim();
  if (reason.length === 0) return refuseTourAccess('reason-required');

  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;

  const { invitation, token } = await mintTourCaptureInvitation({
    custody: managed.custody,
    tourId: managed.tourRef.id,
    subject: input.subject,
    inviteeEmail: normaliseChannelEmail(input.inviteeEmailRaw),
    invitedByUid: input.actor.listing.uid,
    grantExpiresAt: expiry.expiresAt,
    reason,
    nowValue,
  });

  const collection = managed.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_INVITATIONS);
  // Χωρίς companyId: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση, εντοπισμένη από τη ρίζα της και κριμένη με
  //   `mayManageTour` — ο κάτοχος είναι ο ΓΟΝΕΑΣ· το προσωπικό διαμέρισμα δεν έχει καν companyId (ADR-884 Φ0.9).
  const liveQuery = collection
    .where('inviteeEmail', '==', invitation.inviteeEmail)
    .where('state', '==', 'pending');
  const supersededCount = await writeInvitationWithSupersede(db, {
    collection, invitation, liveQuery, actorUid: input.actor.listing.uid, nowValue,
  });

  logger.info('Εκδόθηκε πρόσκληση φωτογράφου', { invitationId: invitation.id, tourId: invitation.tourId, supersededCount });
  return { kind: 'issued', invitation, token, supersededCount };
}

/** Το έγγραφο και ο σύνδεσμος — ο locator του token είναι η **ρίζα**, ώστε η αποδοχή να ξαναβρεί την περιήγηση. */
async function mintTourCaptureInvitation(input: {
  readonly custody: CustodyScope;
  readonly tourId: string;
  readonly subject: TourSubject;
  readonly inviteeEmail: string;
  readonly invitedByUid: string;
  readonly grantExpiresAt: string;
  readonly reason: string;
  readonly nowValue: string;
}): Promise<{ readonly invitation: TourCaptureInvitation; readonly token: string }> {
  const id = enterpriseIdService.generateTourCaptureInvitationId();
  // 🏆 min(7 μέρες, λήξη άδειας) — η πρόσκληση δεν ζει ποτέ περισσότερο από ό,τι υπόσχεται.
  const expiresAtMs = Math.min(defaultInvitationExpiryMs(input.nowValue), Date.parse(input.grantExpiresAt));
  const { token, nonceHash } = await mintInvitationToken(TOUR_CAPTURE_INVITE_SECRET_ENV, {
    id,
    expiresAtMs,
    locator: [input.subject.kind, input.subject.id],
  });
  const invitation: TourCaptureInvitation = {
    // 🔴 Ο κάτοχος **της έκδοσης** — η αποδοχή τον συγκρίνει με τον κάτοχο **τώρα** (δες τον τύπο).
    ...custodyOnly(input.custody),
    id,
    tourId: input.tourId,
    subject: input.subject,
    inviteeEmail: input.inviteeEmail,
    invitedByUid: input.invitedByUid,
    nonceHash,
    state: 'pending',
    createdAt: input.nowValue,
    expiresAt: new Date(expiresAtMs).toISOString(),
    grantExpiresAt: input.grantExpiresAt,
    reason: input.reason,
    openedAt: null,
    resolvedAt: null,
    resolvedByUid: null,
    mailboxProvenAt: null,
  };
  return { invitation, token };
}

// =============================================================================
// 2. ΑΝΑΚΛΗΣΗ ΠΡΟΣΚΛΗΣΗΣ · ΛΙΣΤΑ
// =============================================================================

/**
 * **Ανάκληση πρόσκλησης** — μόνο πάνω σε `pending`. Η ιδιοκτησία είναι **δομική**: το έγγραφο αναζητείται
 * **κάτω** από την περιήγηση που ο δράστης διαχειρίζεται, άρα ξένη πρόσκληση είναι απλώς `absent`.
 */
export async function revokeTourCaptureInvitation(
  db: Firestore,
  input: ManagerInput & { readonly invitationId: string },
): Promise<RevokeInvitationOutcome | TourAccessRefused> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const ref = managed.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_INVITATIONS).doc(input.invitationId);
  return revokeInvitationAt(db, ref, {
    isOwned: () => true,
    revokedByUid: input.actor.listing.uid,
    nowValue: nowISO(),
  });
}

/**
 * **Οι ζωντανές προσκλήσεις φωτογράφου αυτής της περιήγησης.** Η ληγμένη `pending` επιστρέφεται ως `expired`
 * (παράγεται — ο υπεύθυνος πρέπει να τη δει για να ξαναστείλει). Χωρίς `orderBy` ⇒ κανένας σύνθετος δείκτης·
 * η οθόνη ταξινομεί στη μνήμη. Έγγραφο που δεν διαβάζεται **παραλείπεται** — δεν μαντεύεται.
 */
export async function listPendingTourCaptureInvitations(
  db: Firestore,
  input: ManagerInput,
): Promise<{ readonly kind: 'listed'; readonly invitations: readonly TourCaptureInvitation[] } | TourAccessRefused> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const nowValue = nowISO();
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση, κριμένη με `mayManageTour` (ADR-884 Φ0.9).
  const snap = await managed.tourRef
    .collection(SUBCOLLECTIONS.TOUR_CAPTURE_INVITATIONS)
    .where('state', '==', 'pending')
    .limit(LIST_LIMIT)
    .get();
  const invitations = snap.docs.flatMap((doc) => {
    const invitation = tourCaptureInvitationFromDocument(doc.data(), doc.id);
    return invitation === null ? [] : [{ ...invitation, state: presentedInvitationState(invitation, nowValue) }];
  });
  return { kind: 'listed', invitations };
}

// =============================================================================
// 3. ΑΝΑΚΛΗΣΗ ΑΔΕΙΑΣ ΛΗΨΗΣ — πράξη ανθρώπου, νικά τη λήξη
// =============================================================================

/**
 * **Ανάκληση της άδειας ενός φωτογράφου** — κόβει το ανέβασμα αμέσως (`mayUploadTourCapture` ⇒ `revoked`).
 * Μόνο πάνω σε **ενεργή** άδεια· ληγμένη ή ήδη ανακλημένη ⇒ `not-active`, καμία γραφή.
 */
export async function revokeTourCaptureGrant(
  db: Firestore,
  input: ManagerInput & { readonly granteeUid: string },
): Promise<{ readonly kind: 'revoked' } | TourAccessRefused> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const ref = managed.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS).doc(input.granteeUid);
  const at = nowISO();
  return db.runTransaction<{ readonly kind: 'revoked' } | TourAccessRefused>(async (tx) => {
    const snap = await tx.get(ref);
    const grant = snap.exists ? tourCaptureGrantFromDocument(snap.data(), ref.id) : null;
    if (grant === null) return refuseTourAccess('grant-absent');
    if (evaluateScopedGrant(grant, 'tour:capture:upload', Date.parse(at)) !== 'granted') {
      return refuseTourAccess('not-active');
    }
    tx.update(ref, { revokedAt: at, revokedBy: input.actor.listing.uid });
    return { kind: 'revoked' };
  });
}
