import 'server-only';

/**
 * @fileoverview **ΠΡΟΣΚΛΗΣΗ ΦΩΤΟΓΡΑΦΟΥ — Η ΠΛΕΥΡΑ ΤΟΥ ΦΩΤΟΓΡΑΦΟΥ**: αποδοχή (γεννά την άδεια λήψης) · άρνηση.
 * @related ADR-884 Φ0.5 · Κ2β · ADR-853 §20 (κοινός πυρήνας) · `tour-capture-invitation.ts` (ο υπεύθυνος)
 * @module server/spatial-tour/tour-capture-invitation-redeem
 *
 * 🔑 **Το είδος «φωτογράφος» πάνω στον κοινό πυρήνα.** Η κλειδαριά (υπογραφή · λήξη δύο φορές · nonce ·
 * δέσμευση παραλήπτη · απόδειξη γραμματοκιβωτίου · συναλλαγή που ξαναρωτά τα πάντα) είναι η **ίδια** με των
 * προσκλήσεων χώρου. Εδώ ζουν μόνο:
 * - **πού** ζει η πρόσκληση: ο locator του token είναι η **ρίζα** (είδος, id) ⇒ η περιήγηση ξαναβρίσκεται με
 *   `locateSpatialTour`, ποτέ από `tourId` του πελάτη. Αν η αγγελία άλλαξε κάτοχο, η πρόσκληση του παλιού
 *   υπευθύνου **δεν βρίσκεται** (`invitation-unknown`) — δεν δίνει άδεια στον χώρο κάποιου άλλου.
 * - **τι γράφει η αποδοχή**: `tour_capture_grants/{uid}` στην **ίδια** συναλλαγή με το `pending → accepted`.
 *
 * ⛔ **Κανένας έλεγχος μέλους** (`decideMembership`): ο φωτογράφος **δεν** γίνεται μέλος χώρου (Φ0.5 · CHECK 3.58).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { isPlaceSource } from '@/constants/place-sources';
import { evaluateScopedGrant } from '@/lib/auth/scoped-grant';
import { nowISO } from '@/lib/date-local';
import { tourCaptureInvitationFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import {
  redeemInvitation,
  type InvitationKind,
  type InvitationLocation,
  type InvitationRedeemer,
  type InvitationRedeemOutcome,
  type InvitationResolution,
} from '@/server/invitations/invitation-redeem';
import type { InvitationDocumentCore } from '@/types/invitation-core';
import type { TourCaptureGrant, TourCaptureInvitation } from '@/types/spatial-tour';

import { TOUR_CAPTURE_INVITE_SECRET_ENV } from './tour-capture-invitation';
import { locateSpatialTour } from './tour-locate';

const logger = createModuleLogger('tour-capture-invitation-redeem');

/** Το εύρος που δίνει μια πρόσκληση φωτογράφου — σταθερό (Φ0.5). */
const CAPTURE_SCOPES = ['tour:capture:upload'] as const;

/** Ο σύνδεσμος και ο **συνδεδεμένος** φωτογράφος (email **στο Auth** — το εγγυάται το σύνορο HTTP, Κ3). */
interface TourCaptureRedeemInput {
  readonly token: string;
  readonly identity: InvitationRedeemer;
}

/** Η έκβαση για τον φωτογράφο — `unavailable` μόνο για «δεν μπόρεσα» (μυστικό · Auth · αλλοιωμένο έγγραφο). */
export type TourCaptureRedeemOutcome = InvitationRedeemOutcome<TourCaptureInvitation, never, 'secret-missing'>;

/**
 * **Πού ζει η πρόσκληση** — η περιήγηση της ρίζας **όπως είναι τώρα**, και η υποσυλλογή της.
 * `null` ⇒ `invitation-unknown`: ρίζα που δεν υπάρχει, χωρίς περιήγηση, ή locator που δεν διαβάζεται.
 * 🔴 **`belongs`: ο κάτοχος της έκδοσης ΠΡΕΠΕΙ να είναι ο κάτοχος τώρα** — αλλιώς η αγγελία άλλαξε χέρια και η
 * πρόσκληση του παλιού υπευθύνου δεν δίνει τίποτα στον χώρο του νέου (ίδιος κριτής: `isOwnedByCustody`).
 */
async function locateTourCaptureInvitation(
  db: Firestore,
  invitationId: string,
  locator: readonly string[],
): Promise<InvitationLocation | null> {
  const [kind, id] = locator;
  if (!isPlaceSource(kind) || id === undefined) return null;
  const location = await locateSpatialTour(db, { kind, id });
  if (location.kind !== 'found' || location.tour === null) return null;
  return {
    ref: location.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_INVITATIONS).doc(invitationId),
    belongs: (stored) => isOwnedByCustody(stored, location.custody),
  };
}

/**
 * Το έγγραφο στο σχήμα του είδους, με την επίλυση — `null` ⇒ `invitation-corrupt`, **πριν** από κάθε γραφή.
 *
 * 🔴 **Belt-and-suspenders**: η πρόσκληση λήγει ≤ της άδειας (έκδοση), άρα στην αποδοχή η άδεια **είναι**
 * ενεργή. Αν ποτέ δεν είναι (αλλοιωμένο έγγραφο), η αποδοχή **δεν** γράφεται καθόλου — ούτε `accepted` χωρίς
 * άδεια, ούτε άδεια που γεννιέται νεκρή. Ο ίδιος κριτής με το ανέβασμα (`evaluateScopedGrant`).
 */
function tourCaptureInvitationRecord(
  stored: InvitationDocumentCore,
  resolution: InvitationResolution,
): TourCaptureInvitation | null {
  const record = tourCaptureInvitationFromDocument({ ...stored, ...resolution }, stored.id);
  const alive = record !== null && (resolution.state !== 'accepted'
    || evaluateScopedGrant(grantOf(record, resolution.resolvedByUid), 'tour:capture:upload', Date.parse(resolution.resolvedAt)) === 'granted');
  if (record === null || !alive) {
    logger.error('Πρόσκληση φωτογράφου που δεν εξαργυρώνεται — αδιάβαστη ή με ανενεργή άδεια', { invitationId: stored.id });
    return null;
  }
  return record;
}

/**
 * **Η άδεια που γεννά η αποδοχή.** 🔑 Ο δημιουργός είναι ο **προσκαλών** (ADR-853 Ε4 — «ποιος την έδωσε»),
 * όχι ο φωτογράφος που απλώς δέχτηκε. Νέα αποδοχή **αντικαθιστά** παλιότερη άδεια του ίδιου ανθρώπου: οι
 * όροι είναι όσοι όρισε ο υπεύθυνος **τώρα**.
 */
function grantOf(record: TourCaptureInvitation, granteeUid: string): TourCaptureGrant {
  return {
    granteeUid,
    tourId: record.tourId,
    scopes: CAPTURE_SCOPES,
    expiresAt: record.grantExpiresAt,
    revokedAt: null,
    revokedBy: null,
    createdAt: record.resolvedAt ?? record.createdAt,
    createdBy: record.invitedByUid,
    reason: record.reason,
    invitationId: record.id,
  };
}

const TOUR_CAPTURE_INVITATION_KIND: InvitationKind<
  InvitationDocumentCore,
  TourCaptureInvitation,
  InvitationRedeemer,
  never,
  'secret-missing'
> = {
  secretEnv: TOUR_CAPTURE_INVITE_SECRET_ENV,
  secretMissing: 'secret-missing',
  locatorCount: 2,
  locate: locateTourCaptureInvitation,
  recordOf: tourCaptureInvitationRecord,
  onAccept: (tx, { ref, record, identity }) => {
    // Η άδεια ζει **δίπλα** στην πρόσκληση: ίδια περιήγηση, ίδιο διαμέρισμα — καμία δεύτερη αναζήτηση.
    // Ο γονέας μιας υποσυλλογής υπάρχει πάντα· το `null` του τύπου αφορά μόνο κορυφαίες συλλογές.
    const tourRef = ref.parent.parent;
    if (tourRef === null) throw new Error(`Tour capture invitation outside a tour: ${ref.path}`);
    tx.set(tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS).doc(identity.uid), grantOf(record, identity.uid));
  },
};

/**
 * **Αποδοχή** — ατομική: `pending → accepted` **και** `tour_capture_grants/{uid}`, αδιαίρετα. Δύο ταυτόχρονα
 * κλικ ⇒ **μία** άδεια (η δεύτερη συναλλαγή βρίσκει `accepted` ⇒ `already-used`).
 */
export async function acceptTourCaptureInvitation(db: Firestore, input: TourCaptureRedeemInput): Promise<TourCaptureRedeemOutcome> {
  return redeemInvitation(db, TOUR_CAPTURE_INVITATION_KIND, { ...input, target: 'accepted', nowValue: nowISO() });
}

/** **Άρνηση** — ίδια κλειδαριά, καμία άδεια· ο υπεύθυνος βλέπει «απορρίφθηκε» αντί για σιωπηλή λήξη. */
export async function declineTourCaptureInvitation(db: Firestore, input: TourCaptureRedeemInput): Promise<TourCaptureRedeemOutcome> {
  return redeemInvitation(db, TOUR_CAPTURE_INVITATION_KIND, { ...input, target: 'declined', nowValue: nowISO() });
}
