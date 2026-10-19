import 'server-only';

/**
 * @fileoverview **ΤΑ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΑΓΟΡΑΣΤΗ** — πρώτη αποστολή · επανάληψη αποτυχίας · υπενθύμιση (ADR-916 Φ-Β).
 * @related server/invitations/invitation-notice.ts (ο ΚΟΙΝΟΣ αποστολέας — From ADR-857) · `invitation-lifecycle.ts`
 *          (`mintInvitationLinkReissue`) · lib/property-handover/handover-invitation-plan.ts (`handoverInvitationFollowUpOf`)
 * @module server/property-handover-invitations/handover-invitation-delivery
 *
 * ```
 * commit (παράδοση + πρόσκληση) ─► email ─► έκβαση στο κάτοπτρο (CAS: μόνο αν είναι ΑΚΟΜΗ η ίδια πρόσκληση)
 * δίχτυ ─► [συναλλαγή: νέος σύνδεσμος για την ΙΔΙΑ πρόσκληση] ─► email ─► έκβαση
 * ```
 * 🔑 **Η έκβαση γράφεται, δεν μαντεύεται**: το γραφείο βλέπει «έφυγε / ο πάροχος αρνήθηκε / χωρίς email» (Φ-Δ), και το
 *    δίχτυ ξαναδοκιμάζει **μόνο** ό,τι δεν έγινε δεκτό — ποτέ δεύτερο email για ό,τι έφυγε.
 * 🔴 **Ο σύνδεσμος της επανάληψης γράφεται ΠΡΙΝ φύγει το email** — αλλιώς θα έστελνε σύνδεσμο που δεν δουλεύει.
 * ⚠️ **ΠΟΤΕ ΔΕΝ ΠΕΤΑ**: η πώληση έχει ήδη γραφτεί· μια αποτυχία email είναι γραμμή στο κάτοπτρο, όχι σφάλμα διαδρομής.
 * ⛔ Το ωμό token **δεν** καταγράφεται ποτέ.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { HANDOVER_INVITATION_DELIVERY_CAP } from '@/config/property-handover-invitation-policy';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { handoverInvitationFollowUpOf } from '@/lib/property-handover/handover-invitation-plan';
import { propertyHandoverInvitationFromDocument } from '@/lib/property-handover/property-handover-invitation-schema';
import { createModuleLogger } from '@/lib/telemetry';
import { mintInvitationLinkReissue } from '@/server/invitations/invitation-lifecycle';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { buildPropertyHandoverInvitationEmail } from '@/services/email-templates/property-handover-invitation-email';
import type { PropertyHandover, PropertyHandoverInvitationDelivery } from '@/types/property-handover';
import type { PropertyHandoverInvitation } from '@/types/property-handover-invitation';

import { describeHandoverInvitation } from './handover-invitation-description';
import {
  PROPERTY_HANDOVER_INVITE_SECRET_ENV,
  propertyHandoverInvitationsCollection,
  type MintedHandoverInvitation,
} from './handover-invitation-kind';

const logger = createModuleLogger('handover-invitation-delivery');

/** Το λεξιλόγιο του αποστολέα **είναι** το λεξιλόγιο του κατόπτρου — καμία μετάφραση στη μέση. */
function deliveryOf(outcome: InvitationNoticeOutcome): PropertyHandoverInvitationDelivery {
  return outcome satisfies PropertyHandoverInvitationDelivery;
}

/**
 * **Ποιος γράφει την έκβαση στο κάτοπτρο** — ο ΕΝΑΣ γραφέας της παράδοσης (`recordHandoverInvitationDelivery`), που
 * δίνεται από τον καλούντα: αυτό το αρχείο στέλνει email, **δεν** γράφει παραδόσεις (καμία δεύτερη διαδρομή προς τη
 * συλλογή — και κανένας κύκλος εισαγωγών με τον γραφέα που το καλεί).
 */
export type HandoverDeliveryRecorder = (input: {
  readonly handoverId: string;
  readonly invitationId: string;
  readonly delivery: PropertyHandoverInvitationDelivery;
  readonly reminded: boolean;
}) => Promise<void>;

/** **Ένα email** — η περιγραφή διαβάζεται **τώρα**, από τον ίδιο αναγνώστη με την όψη. Ποτέ δεν πετά. */
async function sendEmail(
  db: Firestore,
  invitation: PropertyHandoverInvitation,
  token: string,
  reminder: boolean,
): Promise<InvitationNoticeOutcome> {
  return deliverInvitationEmail({
    invitationId: invitation.id,
    kind: 'property-handover',
    inviteeEmail: invitation.inviteeEmail,
    inviterUid: invitation.invitedByUid,
    compose: async (language) => buildPropertyHandoverInvitationEmail({
      language,
      ...(await describeHandoverInvitation(db, invitation)),
      occasion: invitation.occasion,
      reminder,
      expiresAt: invitation.expiresAt,
      token,
    }),
  });
}

async function deliverAndRecord(
  db: Firestore,
  sent: { readonly invitation: PropertyHandoverInvitation; readonly token: string; readonly reminder: boolean },
  record: HandoverDeliveryRecorder,
): Promise<void> {
  const { invitation, token, reminder } = sent;
  const outcome = await sendEmail(db, invitation, token, reminder);
  try {
    await record({ handoverId: invitation.handoverId, invitationId: invitation.id, delivery: deliveryOf(outcome), reminded: reminder });
  } catch (error) {
    // Το email έφυγε (ή όχι)· το κάτοπτρο θα δείξει `pending` και το δίχτυ θα το ξαναδοκιμάσει — ποτέ σιωπηλό.
    logger.error('Η έκβαση του email πρόσκλησης δεν καταγράφηκε', { invitationId: invitation.id, error: getErrorMessage(error) });
  }
}

/** **Τα πρώτα email** των προσκλήσεων που μόλις εκδόθηκαν — **μετά** το commit. Ποτέ δεν πετά. */
export async function deliverIssuedHandoverInvitations(
  db: Firestore,
  issued: readonly MintedHandoverInvitation[],
  record: HandoverDeliveryRecorder,
): Promise<void> {
  await Promise.all(issued.map(({ invitation, token }) => deliverAndRecord(db, { invitation, token, reminder: false }, record)));
}

/** **Νέος σύνδεσμος για την ΙΔΙΑ πρόσκληση**, γραμμένος πριν από το email. `null` ⇒ δεν ζει πια / όριο / μυστικό. */
async function reissueLink(db: Firestore, invitationId: string): Promise<{ readonly invitation: PropertyHandoverInvitation; readonly token: string } | null> {
  const ref = propertyHandoverInvitationsCollection(db).doc(invitationId);
  return db.runTransaction(async (tx) => {
    const invitation = propertyHandoverInvitationFromDocument((await tx.get(ref)).data(), invitationId);
    if (invitation === null) return null;
    const reissue = await mintInvitationLinkReissue(invitation, {
      secretEnv: PROPERTY_HANDOVER_INVITE_SECRET_ENV, locator: [], cap: HANDOVER_INVITATION_DELIVERY_CAP, nowValue: nowISO(),
    });
    if (!reissue.ok) return null;
    tx.update(ref, { reissuedNonceHashes: reissue.reissuedNonceHashes });
    return { invitation, token: reissue.token };
  });
}

/**
 * **Το δίχτυ των email** για μία παράδοση — επανάληψη αποτυχίας ή η μία υπενθύμιση (`handoverInvitationFollowUpOf`).
 * Επιστρέφει αν στάλθηκε κάτι. Ποτέ δεν πετά.
 */
export async function followUpHandoverInvitation(
  db: Firestore,
  handover: PropertyHandover,
  record: HandoverDeliveryRecorder,
): Promise<boolean> {
  const verdict = handoverInvitationFollowUpOf(handover, nowISO());
  if (verdict === 'none' || handover.invitation?.status !== 'issued') return false;
  try {
    const reissued = await reissueLink(db, handover.invitation.invitationId);
    if (reissued === null) return false;
    await deliverAndRecord(db, { ...reissued, reminder: verdict === 'remind' }, record);
    return true;
  } catch (error) {
    logger.error('Το δίχτυ της πρόσκλησης αγοραστή απέτυχε', { handoverId: handover.id, error: getErrorMessage(error) });
    return false;
  }
}
