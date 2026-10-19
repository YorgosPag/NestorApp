import 'server-only';

/**
 * @fileoverview **ΤΟ ΕΙΔΟΣ «ΠΡΟΣΚΛΗΣΗ ΑΓΟΡΑΣΤΗ»** — μυστικό · συλλογή · εντοπισμός · ζωντανές · γέννηση (ADR-916 Φ-Β).
 * @related server/invitations/* (ο κοινός πυρήνας) · `issuance-invitation-kind.ts` (το πρότυπο) ·
 *          services/property-handover/property-handover-invitation-stage.ts (ο εκδότης — μέσα στη συναλλαγή της παράδοσης)
 * @module server/property-handover-invitations/handover-invitation-kind
 *
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό** με άλλο είδος (`invitation-token.ts`): η υπογραφή δεν ξέρει σε ποια πύλη ανήκει·
 *    με κοινό μυστικό, ένας σύνδεσμος αγοραστή θα διαβαζόταν ως πρόσκληση σε χώρο ή υπόθεση.
 * 🔑 **Μία ζωντανή ανά παράδοση**: νέα έκδοση (άλλαξε το email · ήρθε η ολοκλήρωση) ανακαλεί την προηγούμενη ατομικά.
 */

import type { Firestore, Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { handoverInvitationExpiryMs } from '@/config/property-handover-invitation-policy';
import { propertyHandoverInvitationFromDocument } from '@/lib/property-handover/property-handover-invitation-schema';
import { newPendingInvitationCore } from '@/server/invitations/invitation-lifecycle';
import type { InvitationLocator } from '@/server/invitations/invitation-redeem';
import { mintInvitationToken } from '@/server/invitations/invitation-token';
import { generatePropertyHandoverInvitationId } from '@/services/enterprise-id.service';
import type { InvitationDocumentCore } from '@/types/invitation-core';
import type { PropertyHandoverInvitationOccasion } from '@/types/property-handover';
import type { PropertyHandoverInvitation } from '@/types/property-handover-invitation';

/** Το μυστικό υπογραφής των συνδέσμων αγοραστή — **μόνο** αυτού του είδους. */
export const PROPERTY_HANDOVER_INVITE_SECRET_ENV = 'PROPERTY_HANDOVER_INVITE_SECRET';

export function propertyHandoverInvitationsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.PROPERTY_HANDOVER_INVITATIONS);
}

/**
 * **Πού ζει** μια πρόσκληση αγοραστή — top-level, το id αρκεί (κανένας locator στο token).
 * `belongs` = το έγγραφο διαβάζεται στο σχήμα του είδους· η «ζωντάνια» της **πώλησης** κρίνεται στην αποδοχή,
 * μέσα στη συναλλαγή (`handover-closed`).
 */
export const PROPERTY_HANDOVER_INVITATION_LOCATOR: InvitationLocator<InvitationDocumentCore> = {
  secretEnv: PROPERTY_HANDOVER_INVITE_SECRET_ENV,
  locatorCount: 0,
  async locate(db, invitationId) {
    return {
      ref: propertyHandoverInvitationsCollection(db).doc(invitationId),
      belongs: (stored) => propertyHandoverInvitationFromDocument(stored, invitationId) !== null,
    };
  },
};

/** «Οι ζωντανές της ίδιας παράδοσης» — μόνο ισότητες ⇒ κανένας σύνθετος δείκτης (οι μονοπεδικοί συγχωνεύονται). */
export function liveHandoverInvitationsQuery(db: Firestore, handoverId: string): Query {
  return propertyHandoverInvitationsCollection(db)
    .where('handoverId', '==', handoverId)
    .where('state', '==', 'pending');
}

export interface HandoverInvitationDraft {
  readonly companyId: string;
  readonly propertyId: string;
  readonly handoverId: string;
  readonly contactId: string;
  readonly email: string;
  readonly occasion: PropertyHandoverInvitationOccasion;
  /** uid του δρώντα που προκάλεσε τη συμφιλίωση — `'system'` για το δίχτυ. */
  readonly actorUid: string;
  readonly nowValue: string;
}

/** Νέα πρόσκληση: το έγγραφο + το ωμό token (ωμό **μόνο** στο email). */
export interface MintedHandoverInvitation {
  readonly invitation: PropertyHandoverInvitation;
  readonly token: string;
}

/** **Γέννηση** — καμία εγγραφή εδώ. Πετά αν λείπει το μυστικό: ο καλών **δεν** γράφει τότε πρόσκληση χωρίς σύνδεσμο. */
export async function mintHandoverInvitation(draft: HandoverInvitationDraft): Promise<MintedHandoverInvitation> {
  const id = generatePropertyHandoverInvitationId();
  const expiresAtMs = handoverInvitationExpiryMs(draft.nowValue);
  const { token, nonceHash } = await mintInvitationToken(PROPERTY_HANDOVER_INVITE_SECRET_ENV, { id, expiresAtMs, locator: [] });
  const invitation: PropertyHandoverInvitation = {
    ...newPendingInvitationCore({ id, email: draft.email, actorUid: draft.actorUid, nonceHash, createdAt: draft.nowValue, expiresAtMs }),
    companyId: draft.companyId,
    propertyId: draft.propertyId,
    handoverId: draft.handoverId,
    contactId: draft.contactId,
    occasion: draft.occasion,
  };
  return { invitation, token };
}
