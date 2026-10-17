import 'server-only';

/**
 * @fileoverview ADR-915 §28 Η-Β1 · Η-Β5 · Η-Β6 — **ο σύνδεσμος, από την πλευρά του ανθρώπου**: όψη (GET, χωρίς εγγραφή) και
 *   απάντηση (POST) — έγκριση/άρνηση του υπευθύνου ή αποδοχή/άρνηση του επαγγελματία, **χωρίς λογαριασμό**.
 * @related server/invitations/invitation-link-redeem.ts (η κλειδαριά) · services/document-registry/issuance-assignments.server.ts
 *   (ο ΙΔΙΟΣ γραφέας, ο ΙΔΙΟΣ μειωτής) · issuance-answer-notifier.ts
 * @module server/issuance-invitations/issuance-invitation-answer
 *
 * 🔑 **Ο σύνδεσμος ισχύει όσο είναι ο ΤΡΕΧΩΝ**: η ανάθεση θυμάται ποιο `invitationId` περιμένει απάντηση (`currentLinkAudience`)
 *    και σε ποιο στάδιο. Νέα αποστολή, νέα πρόταση, ακύρωση ή καταγραφή από το γραφείο ⇒ `superseded`, από **κατασκευή**.
 *    Η όψη το λέει πριν πατήσει ο άνθρωπος· η συναλλαγή το **ξανακρίνει** μέσω του μειωτή (`actor-refused`).
 * 🔑 **Ο υπεύθυνος ξανακρίνεται**: αν άλλαξε από την αποστολή (§26), ο παλιός δεν αποφασίζει πια (`lead-changed`).
 * ⚠️ **Καμία εγγραφή στην όψη**, εκτός από το «ανοίχτηκε» (ένδειξη, μη μπλοκάρον, μετά την απάντηση).
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  currentLinkAudience,
  issuanceKeyOf,
  issuanceStateOf,
  type IssuanceAssignmentRecord,
  type IssuanceStage,
} from '@/lib/document-validity/issuance-assignment';
import {
  LINK_ANSWER_AUDIENCE,
  linkAnswerActionOf,
  type IssuanceAudience,
  type IssuanceLinkAnswerBody,
} from '@/lib/document-validity/issuance-request';
import { nowISO } from '@/lib/date-local';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { createModuleLogger } from '@/lib/telemetry';
import { redeemInvitationByLink, type InvitationLinkKind } from '@/server/invitations/invitation-link-redeem';
import { markInvitationOpenedAt } from '@/server/invitations/invitation-lifecycle';
import { readInvitationByToken } from '@/server/invitations/invitation-redeem';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import type { DocumentRegistryResponse, RegistryPropertyLabel } from '@/services/document-registry/document-registry.types';
import { stageIssuanceAction, type StagedIssuanceWrite } from '@/services/document-registry/issuance-assignments.server';
import type { InvitationCoreRefusal, InvitationDocumentCore } from '@/types/invitation-core';
import type { IssuanceInvitation, IssuanceLinkRefusal, IssuanceLinkView } from '@/types/issuance-invitation';

import { announceIssuanceAnswer } from './issuance-answer-notifier';
import { ISSUANCE_INVITATION_LOCATOR, issuanceInvitationsCollection, parseIssuanceInvitation } from './issuance-invitation-kind';

const logger = createModuleLogger('issuance-invitation-answer');

/** Σε ποιο στάδιο απαντά κάθε ακροατήριο — ο ιδιοκτήτης πριν την απόφαση, ο επαγγελματίας αφού ενημερωθεί. */
const ANSWERABLE_FROM: Readonly<Record<IssuanceAudience, IssuanceStage>> = { owner: 'proposed', professional: 'sent' };

export type LinkRefusal = InvitationCoreRefusal | IssuanceLinkRefusal;
type LinkUnavailable = 'secret-missing' | 'invitation-corrupt';

interface ResolvedLink {
  readonly invitation: IssuanceInvitation;
  readonly registry: DocumentRegistryResponse;
  readonly label: RegistryPropertyLabel;
  readonly record: IssuanceAssignmentRecord;
  readonly latestIssuedOn: string | null;
}

type Resolution = { readonly ok: true; readonly link: ResolvedLink } | { readonly ok: false; readonly refusal: LinkRefusal } | { readonly ok: false; readonly unavailable: LinkUnavailable };

/** Ισχύει ακόμη; — τρέχων σύνδεσμος, σωστό στάδιο, και (για έγκριση) ο ίδιος υπεύθυνος. */
function stillCurrent(invitation: IssuanceInvitation, label: RegistryPropertyLabel, record: IssuanceAssignmentRecord | null, latestIssuedOn: string | null): IssuanceLinkRefusal | null {
  const state = issuanceStateOf(record, latestIssuedOn);
  if (state.kind !== 'open' || currentLinkAudience(state.record, invitation.id) !== invitation.audience) return 'superseded';
  if (state.stage !== ANSWERABLE_FROM[invitation.audience]) return 'superseded';
  if (invitation.audience !== 'owner') return null;
  const lead = label.obligorLead;
  return lead?.kind === 'designated' && lead.contactId === invitation.contactId ? null : 'lead-changed';
}

/** Token → σύνδεσμος → η ανάθεση **όπως τη βλέπει η οθόνη του γραφείου** (ο ίδιος αναγνώστης). */
async function resolveLink(db: Firestore, token: string, now: Date): Promise<Resolution> {
  const found = await readInvitationByToken(db, ISSUANCE_INVITATION_LOCATOR, { token, nowValue: now.toISOString(), recipientEmail: null });
  if (found.kind === 'secret-missing') return { ok: false, unavailable: 'secret-missing' };
  if (found.kind === 'refused') return { ok: false, refusal: found.reason };
  const invitation = parseIssuanceInvitation(found.stored, found.invitationId);
  if (invitation === null) return { ok: false, unavailable: 'invitation-corrupt' };
  const registry = await readDocumentRegistry(db, invitation.companyId, now);
  const issuance = registry.issuance[issuanceKeyOf(invitation.propertyId, invitation.documentKind)];
  const label = registry.properties[invitation.propertyId];
  if (!registry.issuanceKnown || issuance === undefined || label === undefined) return { ok: false, refusal: 'superseded' };
  const refusal = stillCurrent(invitation, label, issuance.record, issuance.latestIssuedOn);
  if (refusal !== null || issuance.record === null) return { ok: false, refusal: refusal ?? 'superseded' };
  return { ok: true, link: { invitation, registry, label, record: issuance.record, latestIssuedOn: issuance.latestIssuedOn } };
}

async function viewOf(link: ResolvedLink): Promise<IssuanceLinkView> {
  const { invitation, registry, record } = link;
  const officeName = trimmedStringOrNull(await readWorkspaceName(invitation.companyId).catch(() => ''));
  const request = invitation.audience === 'owner' ? record.approvalRequest : record.notice;
  return {
    audience: invitation.audience,
    recipientName: registry.people[invitation.contactId]?.name ?? null,
    officeName,
    propertyLabel: link.label.name,
    documentKind: invitation.documentKind,
    professional: invitation.audience === 'owner'
      ? { name: registry.people[record.professionalContactId]?.name ?? null, ...record.credential }
      : null,
    note: request?.note ?? null,
    expiresAt: invitation.expiresAt,
  };
}

export type LinkViewOutcome =
  | { readonly kind: 'view'; readonly view: IssuanceLinkView; readonly markOpened: () => Promise<void> }
  | { readonly kind: 'refused'; readonly reason: LinkRefusal }
  | { readonly kind: 'unavailable' };

/** **Η όψη — ΧΩΡΙΣ πράξη.** Τα Safe Links ανοίγουν τη σελίδα πριν τον άνθρωπο· εδώ δεν γράφεται τίποτα. */
export async function viewIssuanceLink(db: Firestore, token: string, now: Date): Promise<LinkViewOutcome> {
  const resolved = await resolveLink(db, token, now);
  if (!resolved.ok) return 'refusal' in resolved ? { kind: 'refused', reason: resolved.refusal } : { kind: 'unavailable' };
  const { link } = resolved;
  const ref = issuanceInvitationsCollection(db).doc(link.invitation.id);
  return { kind: 'view', view: await viewOf(link), markOpened: () => markInvitationOpenedAt(db, ref, nowISO()) };
}

/** Το είδος για την κλειδαριά: η απάντηση γράφεται με τον **ίδιο** γραφέα, μέσα στη **ίδια** συναλλαγή με τη σφράγιση. */
function linkKind(db: Firestore, link: ResolvedLink, answer: IssuanceLinkAnswerBody, nowIso: string): InvitationLinkKind<InvitationDocumentCore, IssuanceInvitation, LinkRefusal, LinkUnavailable, StagedIssuanceWrite> {
  return {
    ...ISSUANCE_INVITATION_LOCATOR,
    secretMissing: 'secret-missing',
    recordOf: (stored) => parseIssuanceInvitation(stored, link.invitation.id),
    async onResolve(tx, { record: invitation }) {
      const staged = await stageIssuanceAction(tx, db, {
        companyId: invitation.companyId,
        writer: { kind: 'link', invitationId: invitation.id, name: link.registry.people[invitation.contactId]?.name ?? null },
        property: { id: invitation.propertyId, scope: link.label.scope, name: link.label.name },
        documentKind: invitation.documentKind,
        latestIssuedOn: link.latestIssuedOn,
        action: linkAnswerActionOf(answer, invitation.contactId),
        names: Object.fromEntries(Object.entries(link.registry.people).map(([id, person]) => [id, person.name])),
        nowIso,
      });
      // Ο μειωτής αρνήθηκε (παλιός σύνδεσμος · άλλο στάδιο) ⇒ η πρόσκληση μένει `pending`, **καμία** γραφή.
      if (!staged.outcome.ok) return { kind: 'refused', reason: 'superseded' };
      return { kind: 'commit', write: () => { staged.commit(); return staged; } };
    },
  };
}

export type LinkAnswerOutcome =
  | { readonly kind: 'answered'; readonly answer: IssuanceLinkAnswerBody['answer'] }
  | { readonly kind: 'refused'; readonly reason: LinkRefusal }
  | { readonly kind: 'unavailable' };

function recipientUidsOf(link: ResolvedLink): readonly string[] {
  const sentBy = link.invitation.audience === 'owner' ? link.record.approvalRequest?.byUid : link.record.notice?.byUid;
  return [link.record.proposedByUid, ...(sentBy === undefined ? [] : [sentBy])];
}

/** **Η απάντηση** — μόνο από POST. Ένα κλικ ⇒ ένα αποτέλεσμα· δύο κλικ ⇒ `already-used`. */
export async function answerIssuanceLink(db: Firestore, token: string, answer: IssuanceLinkAnswerBody, now: Date): Promise<LinkAnswerOutcome> {
  const resolved = await resolveLink(db, token, now);
  if (!resolved.ok) return 'refusal' in resolved ? { kind: 'refused', reason: resolved.refusal } : { kind: 'unavailable' };
  const { link } = resolved;
  if (LINK_ANSWER_AUDIENCE[answer.answer] !== link.invitation.audience) return { kind: 'refused', reason: 'answer-mismatch' };
  const target = answer.answer === 'approve' || answer.answer === 'accept' ? 'accepted' : 'declined';
  const outcome = await redeemInvitationByLink(db, linkKind(db, link, answer, now.toISOString()), { token, target, nowValue: now.toISOString() });
  if (outcome.kind === 'unavailable') {
    logger.error('Ο σύνδεσμος ανάθεσης δεν εξαργυρώθηκε', { invitationId: link.invitation.id, reason: outcome.reason });
    return { kind: 'unavailable' };
  }
  if (outcome.kind === 'refused') return outcome;
  await outcome.effect.audit();
  await announceIssuanceAnswer({
    companyId: link.invitation.companyId, assignmentId: link.invitation.assignmentId, invitationId: link.invitation.id,
    answer: answer.answer, recipientUids: recipientUidsOf(link), propertyName: link.label.name,
    respondentName: link.registry.people[link.invitation.contactId]?.name ?? null,
  });
  return { kind: 'answered', answer: answer.answer };
}
