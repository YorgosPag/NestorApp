import 'server-only';

/**
 * @fileoverview ADR-915 §28 — **το είδος** «σύνδεσμος ανάθεσης έκδοσης»: συλλογή · μυστικό · σχήμα · εντοπισμός · έκδοση.
 * @related server/invitations/* (ο κοινός πυρήνας) · issuance-invitation-send.ts · issuance-invitation-answer.ts
 * @module server/issuance-invitations/issuance-invitation-kind
 *
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό** με άλλο είδος (`invitation-token.ts`): η υπογραφή δεν ξέρει σε ποια πύλη ανήκει·
 *    με κοινό μυστικό, ένας σύνδεσμος έγκρισης θα διαβαζόταν ως πρόσκληση σε χώρο ή υπόθεση.
 * 🔑 **Μία ζωντανή ανά (ανάθεση, ακροατήριο)**: νέα αποστολή ανακαλεί την προηγούμενη ατομικά (supersede). Και πέρα από
 *    αυτό, ο μειωτής δέχεται μόνο το `invitationId` που θυμάται η ανάθεση — δύο φραγμοί για τον παλιό σύνδεσμο.
 */

import type { Firestore, Query } from 'firebase-admin/firestore';
import { z } from 'zod';

import { COLLECTIONS } from '@/config/firestore-collections';
import { DOCUMENT_KINDS, type DocumentKind } from '@/config/document-validity/document-validity';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { ISSUANCE_AUDIENCES, type IssuanceAudience } from '@/lib/document-validity/issuance-request';
import type { InvitationLocator } from '@/server/invitations/invitation-redeem';
import { defaultInvitationExpiryMs, mintInvitationToken } from '@/server/invitations/invitation-token';
import { generateDocumentIssuanceInvitationId } from '@/services/enterprise-id.service';
import type { IssuanceInvitation } from '@/types/issuance-invitation';
import { INVITATION_STATES, type InvitationDocumentCore } from '@/types/invitation-core';

/** Το μυστικό υπογραφής των συνδέσμων ανάθεσης — **μόνο** αυτού του είδους. */
export const ISSUANCE_INVITE_SECRET_ENV = 'ISSUANCE_INVITE_SECRET';

export function issuanceInvitationsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS);
}

const nonEmpty = z.string().min(1);

const invitationSchema = z.object({
  id: nonEmpty,
  inviteeEmail: nonEmpty,
  invitedByUid: nonEmpty,
  nonceHash: nonEmpty,
  state: z.enum(INVITATION_STATES),
  createdAt: nonEmpty,
  expiresAt: nonEmpty,
  openedAt: nonEmpty.nullable(),
  resolvedAt: nonEmpty.nullable(),
  resolvedByUid: nonEmpty.nullable(),
  mailboxProvenAt: nonEmpty.nullable(),
  companyId: nonEmpty,
  propertyId: nonEmpty,
  documentKind: z.enum(DOCUMENT_KINDS),
  assignmentId: nonEmpty,
  audience: z.enum(ISSUANCE_AUDIENCES),
  contactId: nonEmpty,
});

/** Ωμό έγγραφο → σύνδεσμος, fail-closed: ό,τι δεν καταλαβαίνουμε **δεν** απαντά τίποτα. */
export function parseIssuanceInvitation(raw: unknown, expectedId: string): IssuanceInvitation | null {
  const parsed = invitationSchema.safeParse(raw);
  return parsed.success && parsed.data.id === expectedId ? parsed.data : null;
}

/** **Πού ζει** ένας σύνδεσμος — top-level, το id αρκεί (κανένας locator στο token). */
export const ISSUANCE_INVITATION_LOCATOR: InvitationLocator<InvitationDocumentCore> = {
  secretEnv: ISSUANCE_INVITE_SECRET_ENV,
  locatorCount: 0,
  async locate(db, invitationId) {
    return {
      ref: issuanceInvitationsCollection(db).doc(invitationId),
      belongs: (stored) => parseIssuanceInvitation(stored, invitationId) !== null,
    };
  },
};

/** «Οι ζωντανές της ίδιας ανάθεσης, προς το ίδιο ακροατήριο» — μόνο ισότητες ⇒ κανένας σύνθετος δείκτης. */
export function liveIssuanceInvitationsQuery(db: Firestore, assignmentId: string, audience: IssuanceAudience): Query {
  return issuanceInvitationsCollection(db)
    .where('assignmentId', '==', assignmentId)
    .where('audience', '==', audience)
    .where('state', '==', 'pending');
}

export interface IssuanceInvitationDraft {
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly assignmentId: string;
  readonly audience: IssuanceAudience;
  readonly contactId: string;
  readonly email: string;
  readonly actorUid: string;
  readonly nowValue: string;
}

/** **Νέος σύνδεσμος** — το έγγραφο + το ωμό token (ωμό **μόνο** στο email). Πετά αν λείπει το μυστικό. */
export async function mintIssuanceInvitation(draft: IssuanceInvitationDraft): Promise<{ readonly invitation: IssuanceInvitation; readonly token: string }> {
  const id = generateDocumentIssuanceInvitationId();
  const expiresAtMs = defaultInvitationExpiryMs(draft.nowValue);
  const { token, nonceHash } = await mintInvitationToken(ISSUANCE_INVITE_SECRET_ENV, { id, expiresAtMs, locator: [] });
  const invitation: IssuanceInvitation = {
    id,
    inviteeEmail: normaliseChannelEmail(draft.email),
    invitedByUid: draft.actorUid,
    nonceHash,
    state: 'pending',
    createdAt: draft.nowValue,
    expiresAt: new Date(expiresAtMs).toISOString(),
    openedAt: null,
    resolvedAt: null,
    resolvedByUid: null,
    mailboxProvenAt: null,
    companyId: draft.companyId,
    propertyId: draft.propertyId,
    documentKind: draft.documentKind,
    assignmentId: draft.assignmentId,
    audience: draft.audience,
    contactId: draft.contactId,
  };
  return { invitation, token };
}
