import 'server-only';

/**
 * @fileoverview ADR-943 Φ5β (Ζ-1 · Ζ-2) — **ο ΕΝΑΣ εκδότης συνδέσμου προκαταβολής**: νέος σύνδεσμος σε **κάθε** email προς
 *   τον ιδιοκτήτη της απόφασης («έγινε η αυτοψία» · «αίτημα πληρωμής» · Φ5γ «επιστροφή»), δεμένος στην απόφαση, με τον
 *   κωδικό του φακέλου.
 * @related issuance-invitation-kind.ts (σκοπός `advance`) · issuance-advance-payer.ts (ποιος τον εξαργυρώνει) ·
 *   services/email-templates/issuance-invitation-email.ts (είδος `advance-link`)
 * @module server/issuance-invitations/issuance-advance-link
 *
 * 🏆 **Stripe hosted invoice**: κάθε email φέρει έγκυρο σύνδεσμο, και η σελίδα ζει όσο ζουν τα χρήματα (+30 ημ., ≤120 ημ.).
 *    **Εξυπνότερα**: (α) ο σύνδεσμος δένεται στην **απόφαση** (`decidedAt`) — νέα απόφαση τον σβήνει από κατασκευή·
 *    (β) οι ζωντανοί σύνδεσμοι μιας απόφασης είναι **φραγμένοι** (`liveLinksCap`) — ο νέος ανακαλεί τους παλαιότερους·
 *    (γ) ο κωδικός §29 είναι του **φακέλου** (DocuSign): ο ιδιοκτήτης ξανά τον ίδιο κωδικό, όχι νέο ανά email.
 * 🔑 **Πρώτα η εγγραφή, μετά το email** — ποτέ σύνδεσμος που δεν υπάρχει. Ποτέ δεν πετά μετά την εγγραφή.
 */

import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { advanceCollectedMinor, advanceSettledAtOf, advanceStateOf, ADVANCE_POLICY } from '@/lib/document-validity/issuance-advance';
import { advanceSettlementDueOf } from '@/lib/document-validity/issuance-advance-settlement';
import type { IssuanceAssignmentRecord, IssuanceDecision } from '@/lib/document-validity/issuance-assignment';
import { documentRequestLocation } from '@/lib/document-validity/document-request-link';
import { publicUrl } from '@/lib/http/public-origin';
import { formatMinorIn, type MinorAmount } from '@/lib/money/money';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { createModuleLogger } from '@/lib/telemetry';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import type { HostedIssuanceContext } from '@/services/document-registry/issuance-advance-payment.server';
import type { AdvanceLinkMoment } from '@/services/email-templates/issuance-advance-link-email-texts';
import { buildIssuanceEmail, type IssuanceEmailFacts } from '@/services/email-templates/issuance-invitation-email';
import type { IssuanceInvitation } from '@/types/issuance-invitation';

import { readIssuancePeople } from './issuance-invitation-draft';
import {
  isAdvanceLink, issuanceInvitationsCollection, liveIssuanceInvitationsQuery, mintIssuanceInvitation, parseIssuanceInvitation,
  type MintedIssuanceInvitation,
} from './issuance-invitation-kind';

const logger = createModuleLogger('issuance-advance-link');

export interface AdvanceLinkRequest {
  readonly context: HostedIssuanceContext;
  readonly record: IssuanceAssignmentRecord;
  readonly moment: AdvanceLinkMoment;
  /** Ποιος στέλνει (γραφείο) ή για λογαριασμό ποιου (αυτοψία: όποιος ζήτησε την έγκριση) — ο «αποστολέας» του email. */
  readonly actorUid: string;
  /** §29 — το γραφείο ζητά **νέο** κωδικό για αυτόν τον σύνδεσμο (γίνεται ο κάτοχος του φακέλου από εδώ και πέρα). */
  readonly requireAccessCode: boolean;
  readonly now: Date;
}

/**
 * `no-advance` καμία προκαταβολή/απόφαση · `settled` τα χρήματα τελείωσαν · `no-email` ο ιδιοκτήτης δεν έχει email ·
 * `unavailable` ο σύνδεσμος δεν γράφτηκε (λείπει το μυστικό ή απέτυχε η συναλλαγή) — **κανένα** email δεν έφυγε.
 */
export type AdvanceLinkRefusal = 'no-advance' | 'settled' | 'no-email' | 'unavailable';

export type AdvanceLinkResult =
  | { readonly ok: true; readonly delivery: InvitationNoticeOutcome; readonly expiresAt: string; readonly accessCode: string | null }
  | { readonly ok: false; readonly refusal: AdvanceLinkRefusal };

/** Η εγκεκριμένη απόφαση — η μόνη που έχει πληρωτή. */
function approvedDecisionOf(record: IssuanceAssignmentRecord): IssuanceDecision | null {
  const decision = record.decision;
  return decision !== null && decision.outcome === 'approved' ? decision : null;
}

/**
 * Το ποσό που λέει το email: ό,τι περιμένει πληρωμή, αλλιώς ό,τι κρατείται (`advanceCollectedMinor`)· Φ5γ — στη στιγμή
 * `settlement`, ό,τι επιστρέφεται **συνολικά** (η ΙΔΙΑ κρίση με την εντολή χρημάτων, `advanceSettlementDueOf`).
 */
function emailAmountMinorOf(record: IssuanceAssignmentRecord, moment: AdvanceLinkMoment): MinorAmount {
  const state = advanceStateOf(record);
  if (moment === 'settlement') return advanceSettlementDueOf(record)?.refundMinor ?? 0;
  return state.kind === 'awaiting-payment' ? state.amountMinor : advanceCollectedMinor(state);
}

/** Οι ζωντανοί σύνδεσμοι προκαταβολής **αυτής** της απόφασης, νεότερος πρώτος. */
function liveAdvanceLinksOf(docs: readonly QueryDocumentSnapshot[], decidedAt: string): readonly IssuanceInvitation[] {
  return docs
    .flatMap((doc) => parseIssuanceInvitation(doc.data(), doc.id) ?? [])
    .filter((link) => isAdvanceLink(link) && link.purpose.decidedAt === decidedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * **Ο κάτοχος του κωδικού του φακέλου**: ο νεότερος σύνδεσμος προκαταβολής της απόφασης που κρατά κωδικό (το γραφείο τον
 * ζήτησε αργότερα — υπερισχύει)· αλλιώς η πρόσκληση που ενέκρινε· αλλιώς κανένας (ο σύνδεσμος αρκεί).
 */
function codeHolderIdOf(decision: IssuanceDecision, live: readonly IssuanceInvitation[]): string | null {
  for (const link of live) {
    if (isAdvanceLink(link) && link.purpose.codeHolderId !== null) return link.purpose.codeHolderId;
  }
  return decision.basis === 'owner-link-approval' ? decision.invitationId : null;
}

/** Ζητά ο σύνδεσμος κωδικό; — από τον κάτοχο (ανάγνωση), αφού γράφτηκε. Αδιάβαστος κάτοχος ⇒ «ναι» (το email δεν ψεύδεται). */
async function requiresCode(db: Firestore, minted: MintedIssuanceInvitation): Promise<boolean> {
  const purpose = minted.invitation.purpose;
  if (minted.accessCode !== null) return true;
  if (purpose.kind !== 'advance' || purpose.codeHolderId === null) return false;
  const holder = parseIssuanceInvitation((await issuanceInvitationsCollection(db).doc(purpose.codeHolderId).get()).data(), purpose.codeHolderId);
  return holder === null || holder.accessCode !== null;
}

/** Γράψε τον νέο σύνδεσμο και ανακάλεσε τους παλαιότερους πέρα από το όριο — ατομικά. */
async function writeAdvanceLink(db: Firestore, request: AdvanceLinkRequest, draft: Omit<Parameters<typeof mintIssuanceInvitation>[0], 'purpose'>, decision: IssuanceDecision): Promise<MintedIssuanceInvitation> {
  const collection = issuanceInvitationsCollection(db);
  const liveQuery = liveIssuanceInvitationsQuery(db, request.context.assignment.id, 'owner');
  return db.runTransaction(async (tx) => {
    const live = liveAdvanceLinksOf((await tx.get(liveQuery)).docs, decision.at);
    const codeHolderId = codeHolderIdOf(decision, live);
    const minted = await mintIssuanceInvitation({ ...draft, purpose: { kind: 'advance', decidedAt: decision.at, codeHolderId } });
    for (const old of live.slice(ADVANCE_POLICY.liveLinksCap - 1)) {
      tx.update(collection.doc(old.id), { state: 'revoked', resolvedAt: draft.nowValue, resolvedByUid: draft.actorUid });
    }
    tx.set(collection.doc(minted.invitation.id), minted.invitation);
    return minted;
  });
}

async function factsOf(request: AdvanceLinkRequest): Promise<IssuanceEmailFacts> {
  const { context, record } = request;
  return {
    officeName: await readWorkspaceName(context.assignment.companyId).then(trimmedStringOrNull, () => null),
    propertyLabel: context.label.name, documentKind: context.assignment.documentKind,
    professionalName: context.registry.people[record.professionalContactId]?.name ?? null, credential: record.credential, note: null,
  };
}

/** Το email — **μετά** την εγγραφή· ποτέ δεν πετά. */
async function deliver(db: Firestore, request: AdvanceLinkRequest, minted: MintedIssuanceInvitation): Promise<InvitationNoticeOutcome> {
  const state = advanceStateOf(request.record);
  const link = publicUrl(documentRequestLocation(minted.token));
  const [facts, accessCode] = await Promise.all([factsOf(request), requiresCode(db, minted)]);
  const { invitation } = minted;
  return deliverInvitationEmail({
    invitationId: invitation.id, kind: 'document-issuance-advance-link', inviteeEmail: invitation.inviteeEmail, inviterUid: invitation.invitedByUid,
    compose: async (language) => (link === null ? null : buildIssuanceEmail({
      kind: 'advance-link', language, facts, moment: request.moment, amount: formatMinorIn(emailAmountMinorOf(request.record, request.moment), language ?? 'el'),
      releaseAt: state.kind === 'release-pending' && request.moment !== 'settlement' ? state.objectionUntil : null, expiresAt: invitation.expiresAt, link, accessCode,
    })),
  });
}

/** **Νέος σύνδεσμος προκαταβολής, με email** — βλ. κεφαλίδα. */
export async function issueAdvanceLink(db: Firestore, request: AdvanceLinkRequest): Promise<AdvanceLinkResult> {
  const { context, record } = request;
  const decision = approvedDecisionOf(record);
  if (decision === null || advanceStateOf(record).kind === 'none') return { ok: false, refusal: 'no-advance' };
  if (advanceSettledAtOf(record) !== null) return { ok: false, refusal: 'settled' };
  const owner = (await readIssuancePeople(db, context.assignment.companyId, [decision.ownerContactId])).get(decision.ownerContactId);
  if (owner === undefined || owner.email === null) return { ok: false, refusal: 'no-email' };
  const { assignment } = context;
  let minted: MintedIssuanceInvitation;
  try {
    minted = await writeAdvanceLink(db, request, {
      companyId: assignment.companyId, propertyId: assignment.propertyId, documentKind: assignment.documentKind, assignmentId: assignment.id,
      audience: 'owner', contactId: decision.ownerContactId, email: owner.email, actorUid: request.actorUid,
      nowValue: request.now.toISOString(), requireAccessCode: request.requireAccessCode,
    }, decision);
  } catch (error) {
    logger.error('Ο σύνδεσμος προκαταβολής δεν εκδόθηκε', { assignmentId: assignment.id, error: error instanceof Error ? error.message : String(error) });
    return { ok: false, refusal: 'unavailable' };
  }
  const delivery = await deliver(db, request, minted);
  return { ok: true, delivery, expiresAt: minted.invitation.expiresAt, accessCode: minted.accessCode };
}
