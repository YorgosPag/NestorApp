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
 * 🔑 **§29 — κωδικός σε δεύτερο κανάλι**: σύνδεσμος με κωδικό δείχνει πριν από αυτόν μόνο την πύλη (σε ποιον · ποιο γραφείο)·
 *    το ξεκλείδωμα και η απάντηση κρίνουν τον κωδικό **κάθε φορά** (`issuance-link-access.ts`), και ο μειωτής ξανακρίνει.
 * 🔑 **§30 — απόδειξη**: κάθε απάντηση φέρνει email στη διεύθυνση του συνδέσμου (`issuance-answer-receipt.ts`).
 */

import { professionalReferenceOf } from '@/lib/document-validity/issuance-professional';
import type { Firestore } from 'firebase-admin/firestore';

import {
  currentLinkAudience,
  issuanceKeyOf,
  issuanceStateOf,
  type IssuanceAssignmentRecord,
  type IssuanceStage,
  type LinkVerification,
} from '@/lib/document-validity/issuance-assignment';
import type { IssuanceOwnerAttestation } from '@/lib/document-validity/issuance-owner-attestation';
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
import { officeLedger } from '@/services/document-registry/issuance-ledger';
import type { IssuanceEmailFacts, IssuanceSpaceLink } from '@/services/email-templates/issuance-invitation-email';
import type { InvitationCoreRefusal, InvitationDocumentCore } from '@/types/invitation-core';
import type {
  IssuanceAdvancePaymentView,
  IssuanceInvitation,
  IssuanceLinkLanding,
  IssuanceLinkRefusal,
  IssuanceLinkView,
  IssuanceSpaceView,
} from '@/types/issuance-invitation';

import { advancePaymentLinkOf, viewIssuanceAdvance } from './issuance-advance-checkout';
import { announceIssuanceAnswer, type IssuanceLinkEvent } from './issuance-answer-notifier';
import { sendIssuanceAnswerReceipt } from './issuance-answer-receipt';
import { ISSUANCE_INVITATION_LOCATOR, isAdvanceLink, isIssuanceLinkLocked, issuanceInvitationsCollection, parseIssuanceInvitation } from './issuance-invitation-kind';
import { checkIssuanceAccessCode, issuanceGateViewOf, type IssuanceAccessCheck } from './issuance-link-access';
import { resolveOwnerAttestation } from './issuance-link-owners';
import { quoteFacetsOf } from './issuance-link-view';
import { engageApprovedProfessional } from './issuance-space-invite';
import {
  issuanceSpaceLinkOf,
  issuanceSpaceViewOf,
  planIssuanceSpace,
  stageIssuanceSpace,
  type IssuanceSpaceOutcome,
  type IssuanceSpacePlan,
} from './issuance-space-bridge';

const logger = createModuleLogger('issuance-invitation-answer');

/**
 * Σε ποιο στάδιο απαντά κάθε ακροατήριο (§42): ο επαγγελματίας στο αίτημα προσφοράς (ή, σε παλιά ανάθεση, στην ενημέρωση)·
 * ο υπεύθυνος **στην προσφορά** — ποτέ πριν υπάρξει τιμή. Σύνδεσμος έγκρισης παλιάς ανάθεσης (§27, από `proposed`) δεν
 * απαντά πια: «superseded», και το γραφείο ζητά προσφορά.
 */
const ANSWERABLE_FROM: Readonly<Record<IssuanceAudience, IssuanceStage>> = { owner: 'quoted', professional: 'sent' };

export type LinkRefusal = InvitationCoreRefusal | IssuanceLinkRefusal;
type LinkUnavailable = 'secret-missing' | 'invitation-corrupt';

/** Μια άρνηση προς τη σελίδα — `remaining` μόνο στις αρνήσεις κωδικού (§29: «απομένουν Ν προσπάθειες»). */
export type LinkRefused = { readonly kind: 'refused'; readonly reason: LinkRefusal; readonly remaining?: number };

export interface ResolvedLink {
  readonly invitation: IssuanceInvitation;
  readonly registry: DocumentRegistryResponse;
  readonly label: RegistryPropertyLabel;
  readonly record: IssuanceAssignmentRecord;
  readonly latestIssuedOn: string | null;
}

export type Resolution = { readonly ok: true; readonly link: ResolvedLink } | { readonly ok: false; readonly refusal: LinkRefusal } | { readonly ok: false; readonly unavailable: LinkUnavailable };

/** Ισχύει ακόμη; — τρέχων σύνδεσμος, σωστό στάδιο, και (για έγκριση) ο ίδιος υπεύθυνος. */
function stillCurrent(invitation: IssuanceInvitation, label: RegistryPropertyLabel, record: IssuanceAssignmentRecord | null, latestIssuedOn: string | null): IssuanceLinkRefusal | null {
  const state = issuanceStateOf(record, latestIssuedOn);
  if (state.kind !== 'open' || currentLinkAudience(state.record, invitation.id) !== invitation.audience) return 'superseded';
  if (state.stage !== ANSWERABLE_FROM[invitation.audience]) return 'superseded';
  if (invitation.audience !== 'owner') return null;
  const lead = label.obligorLead;
  return lead?.kind === 'designated' && lead.contactId === invitation.contactId ? null : 'lead-changed';
}

/**
 * Σύνδεσμος → η ανάθεση **όπως τη βλέπει η οθόνη του γραφείου** (ο ίδιος αναγνώστης) — και αν ο σύνδεσμος ισχύει ακόμη.
 * §31: η **ίδια** κρίση αποφασίζει και αν αξίζει υπενθύμιση — καμία υπενθύμιση για σύνδεσμο που η σελίδα θα αρνιόταν.
 */
export async function resolveIssuanceInvitation(db: Firestore, invitation: IssuanceInvitation, now: Date): Promise<Resolution> {
  const registry = await readDocumentRegistry(db, invitation.companyId, now);
  const issuance = registry.issuance[issuanceKeyOf(invitation.propertyId, invitation.documentKind)];
  const label = registry.properties[invitation.propertyId];
  if (!registry.issuanceKnown || issuance === undefined || label === undefined) return { ok: false, refusal: 'superseded' };
  const refusal = stillCurrent(invitation, label, issuance.record, issuance.latestIssuedOn);
  if (refusal !== null || issuance.record === null) return { ok: false, refusal: refusal ?? 'superseded' };
  return { ok: true, link: { invitation, registry, label, record: issuance.record, latestIssuedOn: issuance.latestIssuedOn } };
}

/**
 * ADR-943 Φ5β — ο σύνδεσμος **δεν** απαντά: οδηγεί στη σελίδα της προκαταβολής. `answered` = απαντήθηκε ήδη (ο σύνδεσμος
 * που ενέκρινε — η αρχική άρνηση `already-used` αν δεν υπάρχει προκαταβολή)· `advance` = σύνδεσμος προκαταβολής (η άρνηση
 * της σελίδας λέγεται όπως είναι).
 */
type ToAdvancePage = { readonly ok: false; readonly toAdvance: 'answered' | 'advance' };

/** Token → σύνδεσμος → η ανάθεση — ή (Φ5β) η σελίδα της προκαταβολής, **ποτέ** η φόρμα απάντησης. */
async function resolveLink(db: Firestore, token: string, now: Date): Promise<Resolution | ToAdvancePage> {
  const found = await readInvitationByToken(db, ISSUANCE_INVITATION_LOCATOR, { token, nowValue: now.toISOString(), recipientEmail: null });
  if (found.kind === 'secret-missing') return { ok: false, unavailable: 'secret-missing' };
  if (found.kind === 'refused') return found.reason === 'already-used' ? { ok: false, toAdvance: 'answered' } : { ok: false, refusal: found.reason };
  const invitation = parseIssuanceInvitation(found.stored, found.invitationId);
  if (invitation === null) return { ok: false, unavailable: 'invitation-corrupt' };
  if (isAdvanceLink(invitation)) return { ok: false, toAdvance: 'advance' };
  return resolveIssuanceInvitation(db, invitation, now);
}

/** Η άρνηση/αδυναμία μιας επίλυσης που **δεν** οδηγεί σε σελίδα προκαταβολής. */
function failureOf(resolved: Exclude<Resolution, { ok: true }>): LinkRefused | { readonly kind: 'unavailable' } {
  return 'refusal' in resolved ? { kind: 'refused', reason: resolved.refusal } : { kind: 'unavailable' };
}

export function officeNameOf(link: ResolvedLink): Promise<string | null> {
  return readWorkspaceName(link.invitation.companyId).then(trimmedStringOrNull, () => null);
}

function recipientNameOf(link: ResolvedLink): string | null {
  return link.registry.people[link.invitation.contactId]?.name ?? null;
}

async function viewOf(db: Firestore, link: ResolvedLink): Promise<IssuanceLinkView> {
  const { invitation, registry, record } = link;
  const [officeName, facets] = await Promise.all([officeNameOf(link), quoteFacetsOf(db, link)]);
  const request = invitation.audience === 'owner' ? record.approvalRequest : record.notice;
  return {
    ...facets,
    audience: invitation.audience,
    recipientName: recipientNameOf(link),
    officeName,
    propertyLabel: link.label.name,
    documentKind: invitation.documentKind,
    professional: invitation.audience === 'owner'
      ? { name: registry.people[professionalReferenceOf(record.professional)]?.name ?? null, ...record.credential }
      : null,
    note: request?.note ?? null,
    expiresAt: invitation.expiresAt,
  };
}

export type LinkViewOutcome =
  | { readonly kind: 'view'; readonly landing: IssuanceLinkLanding; readonly markOpened: () => Promise<void> }
  | LinkRefused
  | { readonly kind: 'unavailable' };

/**
 * **Η όψη — ΧΩΡΙΣ πράξη.** Τα Safe Links ανοίγουν τη σελίδα πριν τον άνθρωπο· εδώ δεν γράφεται τίποτα (ούτε προσπάθεια
 * κωδικού). Σύνδεσμος με κωδικό ⇒ μόνο η πύλη· κλειδωμένος ⇒ το λέει.
 */
export async function viewIssuanceLink(db: Firestore, token: string, now: Date): Promise<LinkViewOutcome> {
  const resolved = await resolveLink(db, token, now);
  if (!resolved.ok) return 'toAdvance' in resolved ? advanceLandingOf(db, token, resolved.toAdvance, now) : failureOf(resolved);
  const { link } = resolved;
  if (isIssuanceLinkLocked(link.invitation)) return { kind: 'refused', reason: 'code-locked', remaining: 0 };
  const ref = issuanceInvitationsCollection(db).doc(link.invitation.id);
  const landing: IssuanceLinkLanding = link.invitation.accessCode === null
    ? { access: 'open', view: await viewOf(db, link) }
    : { access: 'code-required', gate: issuanceGateViewOf(link.invitation, recipientNameOf(link), await officeNameOf(link)) };
  return { kind: 'view', landing, markOpened: () => markInvitationOpenedAt(db, ref, nowISO()) };
}

function recipientUidsOf(link: ResolvedLink): readonly string[] {
  const sentBy = link.invitation.audience === 'owner' ? link.record.approvalRequest?.byUid : link.record.notice?.byUid;
  return [link.record.proposedByUid, ...(sentBy === undefined ? [] : [sentBy])];
}

/** Η ειδοποίηση του γραφείου — απάντηση, ή κλείδωμα του κωδικού (§29, πρακτική Adobe Sign). Μετά το commit, ποτέ δεν πετά. */
async function announceToOffice(link: ResolvedLink, event: IssuanceLinkEvent): Promise<void> {
  await announceIssuanceAnswer({
    companyId: link.invitation.companyId, assignmentId: link.invitation.assignmentId, invitationId: link.invitation.id,
    answer: event, recipientUids: recipientUidsOf(link), propertyName: link.label.name, respondentName: recipientNameOf(link),
  });
}

/**
 * Τα στοιχεία ενός email της ανάθεσης — από τον **ίδιο** αναγνώστη με την όψη, ποτέ από το αίτημα του πελάτη. `note` = η
 * σημείωση του γραφείου (υπενθύμιση §31: η **ίδια** με το αρχικό μήνυμα) ή `null` (απόδειξη §30).
 */
export async function issuanceEmailFactsOf(link: ResolvedLink, note: string | null): Promise<IssuanceEmailFacts> {
  const { invitation, registry, record } = link;
  return {
    officeName: await officeNameOf(link), propertyLabel: link.label.name, documentKind: invitation.documentKind,
    professionalName: registry.people[professionalReferenceOf(record.professional)]?.name ?? null, credential: record.credential, note,
  };
}

/** §30 — η απόδειξη στη διεύθυνση του συνδέσμου (§39: με τον σύνδεσμο εισόδου στον χώρο). Μετά το commit, ποτέ δεν πετά. */
async function sendReceipt(
  link: ResolvedLink, answer: IssuanceLinkAnswerBody,
  outcome: { readonly verifiedBy: LinkVerification; readonly answeredAt: string; readonly space: IssuanceSpaceOutcome; readonly advancePayment: IssuanceSpaceLink | null },
): Promise<void> {
  await sendIssuanceAnswerReceipt({
    invitation: link.invitation, facts: await issuanceEmailFactsOf(link, null), answer: answer.answer, comment: answer.note,
    verifiedBy: outcome.verifiedBy, answeredAt: outcome.answeredAt, space: issuanceSpaceLinkOf(outcome.space),
    advancePayment: outcome.advancePayment,
  });
}

/**
 * §39 — το σχέδιο του χώρου, **μόνο** για το «Αναλαμβάνω» του επαγγελματία. Κάθε άλλη απάντηση (άρνηση · απόφαση
 * ιδιοκτήτη) δεν ανοίγει χώρο. Οι αναγνώσεις γίνονται εδώ, **πριν** από τη συναλλαγή της σφράγισης.
 */
async function spacePlanOf(db: Firestore, link: ResolvedLink, answer: IssuanceLinkAnswerBody, now: Date): Promise<IssuanceSpacePlan | null> {
  if (answer.answer !== 'accept') return null;
  const { invitation, record } = link;
  return planIssuanceSpace(db, {
    companyId: invitation.companyId, propertyId: invitation.propertyId, assignmentId: invitation.assignmentId,
    documentKind: invitation.documentKind, contactId: invitation.contactId, inviteeEmail: invitation.inviteeEmail,
    qualification: record.credential.qualification, registryNumber: record.credential.registryNumber,
    actorUid: invitation.invitedByUid,
  }, now.getTime());
}

/** Ό,τι γράφει η σφράγιση: η απάντηση στην ανάθεση **και** (§39) ο χώρος — αδιαίρετα. */
interface StagedAnswer {
  readonly staged: StagedIssuanceWrite;
  readonly space: IssuanceSpaceOutcome;
}

/** Ο κωδικός **για αυτή την πράξη** — άρνηση ⇒ λέγεται με τις προσπάθειες που μένουν· κλείδωμα ⇒ ειδοποίηση, μία φορά. */
async function guardAccess(db: Firestore, link: ResolvedLink, attempt: string | null, nowIso: string): Promise<IssuanceAccessCheck> {
  const check = await checkIssuanceAccessCode(db, link.invitation, attempt, nowIso);
  if (!check.ok && check.lockedNow) {
    logger.warn('Ο σύνδεσμος ανάθεσης κλείδωσε μετά από επαναλαμβανόμενους λάθος κωδικούς', { invitationId: link.invitation.id });
    await announceToOffice(link, 'code-locked');
  }
  return check;
}

export type LinkUnlockOutcome =
  | { readonly kind: 'view'; readonly view: IssuanceLinkView }
  | { readonly kind: 'advance'; readonly advance: IssuanceAdvancePaymentView }
  | LinkRefused
  | { readonly kind: 'unavailable' };

/**
 * Η άρνηση της σελίδας προκαταβολής προς τον άνθρωπο: σύνδεσμος προκαταβολής ⇒ όπως είναι (`superseded` · `expired` …)·
 * σύνδεσμος που απαντήθηκε **χωρίς** προκαταβολή ⇒ η αρχική άρνηση `already-used`, όπως πριν (ADR-943 §5.9).
 */
function advanceRefusalOf(landing: LinkRefused, via: ToAdvancePage['toAdvance']): LinkRefused {
  return via === 'advance' || landing.remaining !== undefined ? landing : { kind: 'refused', reason: 'already-used' };
}

/** ADR-943 §5.9 · Φ5β — η σελίδα της προκαταβολής στη θέση της όψης. Καμία εγγραφή — όπως κάθε όψη. */
async function advanceLandingOf(db: Firestore, token: string, via: ToAdvancePage['toAdvance'], now: Date): Promise<LinkViewOutcome> {
  const landing = await viewIssuanceAdvance(db, token, null, now);
  const noop = async (): Promise<void> => undefined;
  if (landing.kind === 'advance') return { kind: 'view', landing: { access: 'advance', advance: landing.advance }, markOpened: noop };
  if (landing.kind === 'code-required') return { kind: 'view', landing: { access: 'code-required', gate: landing.gate }, markOpened: noop };
  return landing.kind === 'unavailable' ? landing : advanceRefusalOf(landing, via);
}

/** Το ξεκλείδωμα της σελίδας προκαταβολής (ADR-943 §5.9 · Φ5β): η όψη της, ή η άρνηση. */
async function unlockAdvanceOf(db: Firestore, token: string, accessCode: string, via: ToAdvancePage['toAdvance'], now: Date): Promise<LinkUnlockOutcome> {
  const landing = await viewIssuanceAdvance(db, token, accessCode, now);
  if (landing.kind === 'advance' || landing.kind === 'unavailable') return landing;
  // Η όψη δεν επιστρέφει πύλη όταν δόθηκε κωδικός· αμυντικά, πύλη ⇒ «λείπει ο κωδικός».
  return landing.kind === 'code-required' ? { kind: 'refused', reason: 'code-required' } : advanceRefusalOf(landing, via);
}

/** **Το ξεκλείδωμα** (§29) — μία προσπάθεια κωδικού ⇒ η πλήρης όψη. Καμία πράξη στην ανάθεση. */
export async function unlockIssuanceLink(db: Firestore, token: string, accessCode: string, now: Date): Promise<LinkUnlockOutcome> {
  const resolved = await resolveLink(db, token, now);
  if (!resolved.ok) return 'toAdvance' in resolved ? unlockAdvanceOf(db, token, accessCode, resolved.toAdvance, now) : failureOf(resolved);
  const check = await guardAccess(db, resolved.link, accessCode, now.toISOString());
  if (!check.ok) return { kind: 'refused', reason: check.refusal, remaining: check.remaining };
  return { kind: 'view', view: await viewOf(db, resolved.link) };
}

/** Το είδος για την κλειδαριά: η απάντηση γράφεται με τον **ίδιο** γραφέα, μέσα στη **ίδια** συναλλαγή με τη σφράγιση. */
function linkKind(
  db: Firestore,
  link: ResolvedLink,
  answer: IssuanceLinkAnswerBody,
  verification: {
    readonly verifiedBy: LinkVerification; readonly nowIso: string; readonly space: IssuanceSpacePlan | null;
    /** §45.15 — το τεκμήριο ιδιοκτητών, κριμένο **πριν** από τη συναλλαγή. */
    readonly ownerAttestation: IssuanceOwnerAttestation | null;
  },
): InvitationLinkKind<InvitationDocumentCore, IssuanceInvitation, LinkRefusal, LinkUnavailable, StagedAnswer> {
  const { verifiedBy, nowIso, ownerAttestation } = verification;
  return {
    ...ISSUANCE_INVITATION_LOCATOR,
    secretMissing: 'secret-missing',
    recordOf: (stored) => parseIssuanceInvitation(stored, link.invitation.id),
    async onResolve(tx, { record: invitation }) {
      // §29 — δεύτερος φραγμός, μέσα στη συναλλαγή: κλείδωμα ανάμεσα στον έλεγχο και τη σφράγιση ⇒ καμία απάντηση.
      if (isIssuanceLinkLocked(invitation)) return { kind: 'refused', reason: 'code-locked' };
      const staged = await stageIssuanceAction(tx, db, {
        ledger: officeLedger(invitation.companyId),
        writer: { kind: 'link', invitationId: invitation.id, name: link.registry.people[invitation.contactId]?.name ?? null, verifiedBy },
        property: { id: invitation.propertyId, scope: link.label.scope, name: link.label.name },
        documentKind: invitation.documentKind,
        latestIssuedOn: link.latestIssuedOn,
        action: linkAnswerActionOf(answer, invitation.contactId, ownerAttestation),
        names: Object.fromEntries(Object.entries(link.registry.people).map(([id, person]) => [id, person.name])),
        nowIso,
      });
      // Ο μειωτής αρνήθηκε (παλιός σύνδεσμος · άλλο στάδιο) ⇒ η πρόσκληση μένει `pending`, **καμία** γραφή.
      if (!staged.outcome.ok) return { kind: 'refused', reason: 'superseded' };
      // §39 — οι αναγνώσεις του χώρου (ζωντανές της θέσης) **πριν** από κάθε γραφή· γράφονται μαζί με την απάντηση.
      const space = verification.space === null
        ? { outcome: { kind: 'none' } as const, commit: () => undefined }
        : await stageIssuanceSpace(db, tx, verification.space);
      return { kind: 'commit', write: () => { staged.commit(); space.commit(); return { staged, space: space.outcome }; } };
    },
  };
}

/** §42 — η έγκριση της προσφοράς από τον ίδιο τον υπεύθυνο ⇒ πρόσκληση στον χώρο, στο όνομα του αποστολέα του συνδέσμου. */
async function engageOnApproval(db: Firestore, link: ResolvedLink, staged: StagedIssuanceWrite, now: Date): Promise<void> {
  if (!staged.outcome.ok || staged.outcome.stage !== 'accepted' || link.invitation.audience !== 'owner') return;
  const { invitation } = link;
  await engageApprovedProfessional(
    db,
    { companyId: invitation.companyId, uid: invitation.invitedByUid, name: null },
    { propertyId: invitation.propertyId, documentKind: invitation.documentKind },
    now,
  );
}

export type LinkAnswerOutcome =
  | { readonly kind: 'answered'; readonly answer: IssuanceLinkAnswerBody['answer']; readonly space: IssuanceSpaceView }
  | LinkRefused
  | { readonly kind: 'unavailable' };

/** **Η απάντηση** — μόνο από POST. Ένα κλικ ⇒ ένα αποτέλεσμα· δύο κλικ ⇒ `already-used`. */
export async function answerIssuanceLink(db: Firestore, token: string, answer: IssuanceLinkAnswerBody, now: Date): Promise<LinkAnswerOutcome> {
  const resolved = await resolveLink(db, token, now);
  // Φ5β — ο σύνδεσμος προκαταβολής δεν απαντά ποτέ· ο απαντημένος λέει `already-used`, όπως πριν.
  if (!resolved.ok) {
    return 'toAdvance' in resolved
      ? { kind: 'refused', reason: resolved.toAdvance === 'advance' ? 'answer-mismatch' : 'already-used' }
      : failureOf(resolved);
  }
  const { link } = resolved;
  if (LINK_ANSWER_AUDIENCE[answer.answer] !== link.invitation.audience) return { kind: 'refused', reason: 'answer-mismatch' };
  const check = await guardAccess(db, link, answer.accessCode, now.toISOString());
  if (!check.ok) return { kind: 'refused', reason: check.refusal, remaining: check.remaining };
  // §45.15 — ό,τι βεβαιώνει για τους ιδιοκτήτες κρίνεται απέναντι σε όσους υπάρχουν **τώρα** (ποτέ για όσους δεν είδε).
  const attested = await resolveOwnerAttestation(db, link, answer);
  if (attested.kind === 'unavailable') return { kind: 'unavailable' };
  if (attested.kind === 'refused') return { kind: 'refused', reason: attested.refusal === 'owners-changed' ? 'owners-changed' : 'answer-mismatch' };
  const target = answer.answer === 'reject' || answer.answer === 'decline' ? 'declined' : 'accepted';
  const space = await spacePlanOf(db, link, answer, now);
  const kind = linkKind(db, link, answer, { verifiedBy: check.verifiedBy, nowIso: now.toISOString(), space, ownerAttestation: attested.attestation });
  const outcome = await redeemInvitationByLink(db, kind, { token, target, nowValue: now.toISOString() });
  if (outcome.kind === 'unavailable') {
    logger.error('Ο σύνδεσμος ανάθεσης δεν εξαργυρώθηκε', { invitationId: link.invitation.id, reason: outcome.reason });
    return { kind: 'unavailable' };
  }
  if (outcome.kind === 'refused') return outcome;
  await outcome.effect.staged.audit();
  await engageOnApproval(db, link, outcome.effect.staged, now);
  // Δύο αποδέκτες, μία πράξη: το γραφείο μαθαίνει την απάντηση· η διεύθυνση του συνδέσμου παίρνει την απόδειξη (§30)
  // — με τον σύνδεσμο εισόδου στον χώρο όταν το «Αναλαμβάνω» τον άνοιξε (§39).
  await Promise.all([
    announceToOffice(link, answer.answer),
    sendReceipt(link, answer, {
      verifiedBy: check.verifiedBy, answeredAt: now.toISOString(), space: outcome.effect.space,
      // ADR-943 §5.9 — έγκριση με προκαταβολή ⇒ η απόδειξη φέρει τον σύνδεσμο πληρωμής (ο ίδιος σύνδεσμος).
      advancePayment: outcome.effect.staged.outcome.ok ? advancePaymentLinkOf(token, link.invitation, outcome.effect.staged.outcome.record) : null,
    }),
  ]);
  return { kind: 'answered', answer: answer.answer, space: issuanceSpaceViewOf(outcome.effect.space) };
}
