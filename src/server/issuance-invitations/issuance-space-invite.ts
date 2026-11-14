import 'server-only';

/**
 * @fileoverview ADR-915 §39 — **«Νέος σύνδεσμος εισόδου»**: το γραφείο ξαναστέλνει την πρόσκληση στον χώρο της ανάθεσης
 *   (μοτίβο Procore «Re-invite»: ο νέος σύνδεσμος **ακυρώνει** τον παλιό, ατομικά — supersede).
 * @related issuance-space-bridge.ts (το ΙΔΙΟ σχέδιο με το «Αναλαμβάνω») · engagement-invitation-issue.ts (η ΜΙΑ μηχανή) ·
 *   api/document-registry/issuance-assignments/space-invitation (η πόρτα)
 * @module server/issuance-invitations/issuance-space-invite
 *
 * 🔑 **Μόνο σε αναληφθείσα ανάθεση**, και **μόνο όσο ο επαγγελματίας δεν έχει μπει** — αλλιώς ονομασμένη άρνηση.
 * 🔑 **Πού πάει**: στη διεύθυνση που **απέδειξε** ο ίδιος, απαντώντας στον σύνδεσμο της ανάθεσης· αν η ανάληψη
 *    καταγράφηκε από το γραφείο (τηλεφωνικά), στο κύριο email της επαφής **στο βιβλίο του γραφείου**. Ποτέ από το αίτημα.
 * 🔑 **Ίχνος** στο βιβλίο του ακινήτου (ADR-195) και **email** στη γλώσσα του παραλήπτη (ο ΚΟΙΝΟΣ αποστολέας).
 * ⛔ Ποτέ αυτόματη αποστολή: εκτελεί μόνο ό,τι πάτησε άνθρωπος του γραφείου (η αυτόματη υπενθύμιση πάει στο γραφείο).
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { COLLECTIONS } from '@/config/firestore-collections';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { issuanceStageOf } from '@/lib/document-validity/issuance-assignment';
import { issuanceSpaceStatusOf, canResendSpaceInvitation } from '@/lib/document-validity/issuance-space';
import { issueEngagementInvitation, latestIssuanceSpaceInvitations } from '@/server/engagement-invitations/engagement-invitation-issue';
import { notifyEngagementInvitation } from '@/server/engagement-invitations/engagement-invitation-notice';
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { issuanceAssignmentIdOf, parseIssuanceAssignment, type DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';
import { EntityAuditService } from '@/services/entity-audit.service';

import { issuanceInvitationsCollection, parseIssuanceInvitation } from './issuance-invitation-kind';
import { planIssuanceSpace } from './issuance-space-bridge';

/** Ποιος στέλνει — από το token του αιτήματος (`withAuth`), ποτέ από το σώμα. */
export interface SpaceInviteSender {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

/**
 * - `absent`       — καμία τέτοια ανάθεση σε αυτό το γραφείο (ξένη ≡ ανύπαρκτη)
 * - `not-accepted` — η ανάθεση δεν είναι αναληφθείσα (πριν το «Αναλαμβάνω», ή ακυρώθηκε)
 * - `entered`      — ο επαγγελματίας **είναι ήδη** στον χώρο
 * - `no-project` · `no-authority` — ο χώρος δεν μπορεί να υπάρξει (βλ. γέφυρα)
 * - `no-email`     — καμία διεύθυνση: ούτε αποδεδειγμένη από τον σύνδεσμο ούτε στην επαφή
 * - `unknown`      — δεν μπόρεσα να διαβάσω αν έχει ήδη μπει (ποτέ αποστολή «στα τυφλά»)
 */
export type SpaceInviteRefusal = 'absent' | 'not-accepted' | 'entered' | 'no-project' | 'no-authority' | 'no-email' | 'unknown';

export type SpaceInviteOutcome =
  | { readonly ok: true; readonly delivery: InvitationNoticeOutcome; readonly expiresAt: string }
  | { readonly ok: false; readonly refusal: SpaceInviteRefusal };

async function readOwnAssignment(db: Firestore, companyId: string, propertyId: string, kind: DocumentKind): Promise<DocumentIssuanceAssignment | null> {
  const id = issuanceAssignmentIdOf(companyId, propertyId, kind);
  const assignment = parseIssuanceAssignment((await db.collection(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS).doc(id).get()).data());
  return assignment && assignment.companyId === companyId && assignment.id === id ? assignment : null;
}

/** Η διεύθυνση: πρώτα όποια **απέδειξε** ο ίδιος στον σύνδεσμο της ανάθεσης, μετά η κύρια της επαφής του γραφείου. */
async function inviteeEmailOf(db: Firestore, assignment: DocumentIssuanceAssignment): Promise<string | null> {
  const linkId = assignment.response?.basis === 'professional-link' ? assignment.response.invitationId : null;
  if (linkId !== null) {
    const link = parseIssuanceInvitation((await issuanceInvitationsCollection(db).doc(linkId).get()).data(), linkId);
    if (link && link.companyId === assignment.companyId) return link.inviteeEmail;
  }
  const contact = (await readOwnedContactDocs(db, assignment.companyId, [assignment.professionalContactId])).get(assignment.professionalContactId);
  return contact ? primaryEmailOf(Array.isArray(contact.emails) ? contact.emails : undefined) : null;
}

/** Έχει ήδη μπει; — η ΙΔΙΑ παραγωγή με την κάρτα (`issuanceSpaceStatusOf`). `null` ⇒ δεν διαβάστηκε. */
async function mayResend(db: Firestore, assignment: DocumentIssuanceAssignment, nowIso: string): Promise<boolean | null> {
  const { byAssignment, truncated } = await latestIssuanceSpaceInvitations(db, assignment.companyId, nowIso);
  if (truncated) return null;
  return canResendSpaceInvitation(issuanceSpaceStatusOf(byAssignment.get(assignment.id) ?? null));
}

async function recordSpaceInviteAudit(assignment: DocumentIssuanceAssignment, sender: SpaceInviteSender, email: string): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: assignment.scope === 'property' ? 'property' : 'owner_property',
    entityId: assignment.propertyId,
    entityName: null,
    action: 'updated',
    changes: [{ field: 'issuanceSpaceInvitation', oldValue: null, newValue: `invited:${email}` }],
    performedBy: sender.uid,
    performedByName: sender.name,
    companyId: assignment.companyId,
  });
}

/** **Νέος σύνδεσμος εισόδου στον χώρο της ανάθεσης.** Η πρόσκληση γράφεται πρώτα (await)· το email μετά, με ονομασμένη έκβαση. */
export async function inviteIssuanceProfessionalToSpace(
  db: Firestore,
  sender: SpaceInviteSender,
  target: { readonly propertyId: string; readonly documentKind: DocumentKind },
  now: Date,
): Promise<SpaceInviteOutcome> {
  const assignment = await readOwnAssignment(db, sender.companyId, target.propertyId, target.documentKind);
  if (!assignment) return { ok: false, refusal: 'absent' };
  if (issuanceStageOf(assignment) !== 'accepted') return { ok: false, refusal: 'not-accepted' };
  const allowed = await mayResend(db, assignment, now.toISOString());
  if (allowed === null) return { ok: false, refusal: 'unknown' };
  if (!allowed) return { ok: false, refusal: 'entered' };
  const email = await inviteeEmailOf(db, assignment);
  if (email === null) return { ok: false, refusal: 'no-email' };
  const plan = await planIssuanceSpace(db, {
    companyId: assignment.companyId, propertyId: assignment.propertyId, assignmentId: assignment.id,
    documentKind: assignment.documentKind, contactId: assignment.professionalContactId, inviteeEmail: email,
    qualification: assignment.credential.qualification, registryNumber: assignment.credential.registryNumber,
    actorUid: sender.uid,
  }, now.getTime());
  if (plan.kind !== 'ready') return { ok: false, refusal: plan.kind };
  const issued = await issueEngagementInvitation(db, plan.input);
  await recordSpaceInviteAudit(assignment, sender, issued.invitation.inviteeEmail);
  return { ok: true, delivery: await notifyEngagementInvitation(db, issued), expiresAt: issued.invitation.expiresAt };
}
