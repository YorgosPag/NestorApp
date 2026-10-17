import 'server-only';

/**
 * @fileoverview ADR-915 §28 Η-Β4 · Η-Β7 · Η-Β8 — **προεπισκόπηση και αποστολή** του μηνύματος ανάθεσης, με ΕΝΑ πάτημα.
 * @related issuance-invitation-draft.ts (το πρόχειρο) · services/document-registry/issuance-assignments.server.ts (ο γραφέας) ·
 *   server/invitations/* (ο πυρήνας) · services/email-templates/issuance-invitation-email.ts (ο συνθέτης)
 * @module server/issuance-invitations/issuance-invitation-send
 *
 * ```
 * πρόχειρο ─► [συναλλαγή: ανάθεση (ο ΙΔΙΟΣ μειωτής, CAS) + πρόσκληση με supersede] ─► ιστορικό ─► email ─► παράδοση
 * ```
 * 🔴 **Μία συναλλαγή για ανάθεση και πρόσκληση**: η ανάθεση θυμάται το `invitationId` **μόνο** αν η πρόσκληση γράφτηκε, και
 *    το αντίστροφο. Χωρίς αυτό, ένα σφάλμα ανάμεσα θα άφηνε ανάθεση που «περιμένει» σύνδεσμο που δεν υπάρχει.
 * 🔴 **Το email φεύγει ΜΟΝΟ μετά το commit** — ποτέ μήνυμα για αίτημα που δεν καταγράφηκε. Καμία αυτόματη αποστολή: τη
 *    διαδρομή την καλεί **μόνο** το κουμπί «Αποστολή» του γραφείου (§18.5).
 * 🔒 **Συνιδιοκτήτες: ένα μήνυμα ανά πρόσωπο, ποτέ cc**, χωρίς σύνδεσμο πράξης — κανείς δεν βλέπει το email του άλλου.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceAction, IssuanceDelivery, IssuanceDeliveryOutcome, IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { documentRequestLocation, DOCUMENT_REQUEST_PATH } from '@/lib/document-validity/document-request-link';
import type { IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { publicUrl } from '@/lib/http/public-origin';
import { createModuleLogger } from '@/lib/telemetry';
import { stageInvitationWithSupersede } from '@/server/invitations/invitation-lifecycle';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { defaultInvitationExpiryMs } from '@/server/invitations/invitation-token';
import {
  recordIssuanceDelivery,
  stageIssuanceAction,
  type IssuanceWriteOutcome,
} from '@/services/document-registry/issuance-assignments.server';
import { buildIssuanceEmail } from '@/services/email-templates/issuance-invitation-email';
import type { IssuanceInvitation, IssuancePreview } from '@/types/issuance-invitation';

import { draftIssuanceMessage, type DraftPerson, type DraftRefusal, type IssuanceSendDraft } from './issuance-invitation-draft';
import { issuanceInvitationsCollection, liveIssuanceInvitationsQuery, mintIssuanceInvitation } from './issuance-invitation-kind';

const logger = createModuleLogger('issuance-invitation-send');

/** Το λεξιλόγιο του αποστολέα **είναι** το λεξιλόγιο που αποθηκεύεται — καμία μετάφραση στη μέση. */
function deliveryOutcomeOf(outcome: InvitationNoticeOutcome): IssuanceDeliveryOutcome {
  return outcome satisfies IssuanceDeliveryOutcome;
}

export interface IssuanceSender {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

export type SendRefusal = DraftRefusal | 'secret-missing' | Extract<IssuanceWriteOutcome, { ok: false }>['refusal'];

export type PreviewResult = { readonly ok: true; readonly preview: IssuancePreview } | { readonly ok: false; readonly refusal: DraftRefusal };

export type SendResult =
  | { readonly ok: true; readonly stage: IssuanceStage; readonly delivery: IssuanceDelivery }
  | { readonly ok: false; readonly refusal: SendRefusal };

function coOwnerNames(draft: IssuanceSendDraft): string[] {
  return draft.informed.flatMap((person) => (person.name === null ? [] : [person.name]));
}

/** Το μήνυμα προς τον παραλήπτη — `link` απόλυτο (αποστολή) ή η διαδρομή χωρίς κλειδί (προεπισκόπηση). */
function recipientEmailOf(draft: IssuanceSendDraft, language: unknown, link: string, expiresAt: string) {
  return draft.audience === 'owner'
    ? buildIssuanceEmail({ kind: 'approval', language, facts: draft.facts, coOwnerNames: coOwnerNames(draft), expiresAt, link })
    : buildIssuanceEmail({ kind: 'professional', language, facts: draft.facts, expiresAt, link });
}

function coOwnerEmailOf(draft: IssuanceSendDraft, language: unknown) {
  return buildIssuanceEmail({ kind: 'co-owner', language, facts: draft.facts, leadName: draft.leadName });
}

/** **Η προεπισκόπηση** — στα ελληνικά του γραφείου, με σημείο θέσης στη θέση του προσωπικού συνδέσμου. Δεν γράφει τίποτα. */
export async function previewIssuanceMessage(db: Firestore, sender: IssuanceSender, body: IssuanceSendBody, now: Date): Promise<PreviewResult> {
  const drafted = await draftIssuanceMessage(db, sender.companyId, body, now);
  if (!drafted.ok) return drafted;
  const { draft } = drafted;
  const placeholderLink = publicUrl(DOCUMENT_REQUEST_PATH) ?? DOCUMENT_REQUEST_PATH;
  // Η λήξη που **θα** πάρει ο σύνδεσμος αν σταλεί τώρα — ο ίδιος κανόνας με την έκδοση.
  const expiresAt = new Date(defaultInvitationExpiryMs(now.toISOString())).toISOString();
  const email = recipientEmailOf(draft, 'el', placeholderLink, expiresAt);
  const notice = draft.informed.length === 0 ? null : coOwnerEmailOf(draft, 'el');
  return {
    ok: true,
    preview: {
      audience: draft.audience,
      recipient: { contactId: draft.recipient.contactId, name: draft.recipient.name, email: draft.recipient.email },
      subject: email.subject,
      text: email.text,
      coOwners: draft.coOwners.map((person) => ({ contactId: person.contactId, name: person.name, reachable: person.email !== null })),
      coOwnerMessage: notice === null ? null : { subject: notice.subject, text: notice.text },
    },
  };
}

function actionOf(draft: IssuanceSendDraft, invitationId: string, note: string | null): IssuanceAction {
  return draft.audience === 'owner'
    ? { kind: 'request-approval', invitationId, ownerContactId: draft.recipient.contactId, note }
    : { kind: 'notify', channel: 'email', invitationId, note };
}

/** Ανάθεση + πρόσκληση σε **μία** συναλλαγή — ή καμία από τις δύο. */
async function commitSend(db: Firestore, sender: IssuanceSender, body: IssuanceSendBody, draft: IssuanceSendDraft, invitation: IssuanceInvitation) {
  const staged = await db.runTransaction(async (tx) => {
    const assignment = await stageIssuanceAction(tx, db, {
      companyId: sender.companyId,
      writer: { kind: 'office', uid: sender.uid, name: sender.name, expectedStage: body.expectedStage },
      property: draft.property,
      documentKind: body.documentKind,
      latestIssuedOn: draft.latestIssuedOn,
      action: actionOf(draft, invitation.id, body.note),
      names: draft.names,
      nowIso: invitation.createdAt,
    });
    if (!assignment.outcome.ok) return assignment;
    const live = await stageInvitationWithSupersede(tx, {
      collection: issuanceInvitationsCollection(db),
      invitation,
      liveQuery: liveIssuanceInvitationsQuery(db, draft.assignmentId, draft.audience),
      actorUid: sender.uid,
      nowValue: invitation.createdAt,
    });
    assignment.commit();
    live.commit();
    return assignment;
  });
  await staged.audit();
  return staged.outcome;
}

async function deliverTo(person: DraftPerson & { readonly email: string }, invitation: IssuanceInvitation, compose: (language: unknown) => ReturnType<typeof buildIssuanceEmail> | null, kind: string) {
  const outcome = await deliverInvitationEmail({
    invitationId: invitation.id,
    kind,
    inviteeEmail: person.email,
    inviterUid: invitation.invitedByUid,
    compose: async (language) => compose(language),
  });
  return deliveryOutcomeOf(outcome);
}

/** Τα email — **μετά** το commit· κάθε συνιδιοκτήτης χωριστά. Ποτέ δεν πετά. */
async function deliverAll(draft: IssuanceSendDraft, invitation: IssuanceInvitation, token: string): Promise<IssuanceDelivery> {
  const link = publicUrl(documentRequestLocation(token));
  const recipient = await deliverTo(draft.recipient, invitation, (language) => (link === null ? null : recipientEmailOf(draft, language, link, invitation.expiresAt)), 'document-issuance');
  const coOwners = await Promise.all(draft.informed.flatMap((person) => (person.email === null ? [] : [
    deliverTo({ ...person, email: person.email }, invitation, (language) => coOwnerEmailOf(draft, language), 'document-issuance-notice')
      .then((outcome) => [person.contactId, outcome] as const),
  ])));
  return { recipient, coOwners: Object.fromEntries(coOwners) };
}

/** **Η αποστολή, με ένα πάτημα.** Πρόχειρο → μία συναλλαγή → email → παράδοση. */
export async function sendIssuanceMessage(db: Firestore, sender: IssuanceSender, body: IssuanceSendBody, now: Date): Promise<SendResult> {
  const drafted = await draftIssuanceMessage(db, sender.companyId, body, now);
  if (!drafted.ok) return drafted;
  const { draft } = drafted;
  let minted: Awaited<ReturnType<typeof mintIssuanceInvitation>>;
  try {
    minted = await mintIssuanceInvitation({
      companyId: sender.companyId, propertyId: body.propertyId, documentKind: body.documentKind, assignmentId: draft.assignmentId,
      audience: draft.audience, contactId: draft.recipient.contactId, email: draft.recipient.email, actorUid: sender.uid, nowValue: now.toISOString(),
    });
  } catch {
    logger.error('Λείπει το μυστικό των συνδέσμων ανάθεσης — ΔΕΝ στάλθηκε τίποτα');
    return { ok: false, refusal: 'secret-missing' };
  }
  const outcome = await commitSend(db, sender, body, draft, minted.invitation);
  if (!outcome.ok) return outcome;
  const delivery = await deliverAll(draft, minted.invitation, minted.token);
  await recordIssuanceDelivery(db, { companyId: sender.companyId, propertyId: body.propertyId, documentKind: body.documentKind, invitationId: minted.invitation.id }, delivery);
  return { ok: true, stage: outcome.stage, delivery };
}
