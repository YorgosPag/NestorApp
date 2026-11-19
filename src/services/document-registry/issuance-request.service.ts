/**
 * @fileoverview ADR-945 §7.5 — **η πράξη** «αίτημα προσφορών έκδοσης»: πρόσκληση βιτρίνας · ανάθεση στη νικήτρια ·
 *   ακύρωση, πάνω στο ΕΝΑ αίτημα (κάτοχος, ακίνητο, είδος) και τις έως 3 προσφορές του.
 * @related issuance-requests.server.ts (I/O αιτήματος) · issuance-assignments.server.ts (ο ΕΝΑΣ γραφέας προσφορών) ·
 *   lib/document-validity/issuance-bidding.ts (ο μειωτής) · app/api/document-registry/issuance-requests/route.ts (το σύνορο)
 * @module services/document-registry/issuance-request.service
 *
 * 🔑 **Ο κριτής υποκειμένου είναι ο ΕΝΑΣ** (`readUpkeepSubject`, §36/§37): ξένο ακίνητο ≡ ανύπαρκτο, αποσυρμένο ⇒ άρνηση,
 *    και το **βιβλίο** έρχεται από τον κριτή, ποτέ από το αίτημα. Φ1: μόνο βιβλίο **ιδιώτη** (`office-ledger` αλλιώς).
 * 🔑 **Μία συναλλαγή ανά πράξη** — αίτημα **και** προσφορές μαζί (§7.2): η πρόσκληση γράφει αίτημα + πρόταση· η ανάθεση
 *    γράφει απόφαση στη νικήτρια + «δεν επιλέχθηκε» στις ανοιχτές άλλες + αίτημα. Δεν υπάρχει στιγμή με δύο «ανατέθηκε».
 * 🔑 **CAS σε δύο επίπεδα**: ο κύκλος που είδε ο άνθρωπος, και το στάδιο **κάθε** προσφοράς που αγγίζεται ⇒ `stale`.
 * 🔑 **Το προσόν παράγεται από τη βιτρίνα** (`showcaseIssuanceCredential`), με τον ΙΔΙΟ κριτή με τον κατάλογο `/pro`.
 * 🔑 Το ιστορικό (ADR-195) γράφεται **μετά** την επιτυχία της συναλλαγής, μία γραμμή ανά προσφορά που άλλαξε.
 * ⏭️ Ειδοποίηση επαγγελματία (email · χώρος συνεργασίας) = Φ3 (ADR-945 Δ5/Δ6) — εδώ μόνο τα γεγονότα.
 */

import 'server-only';

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { issuanceStateOf, type IssuanceAction, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import {
  inviteCycleOf,
  reduceIssuanceRequest,
  type IssuanceBidClosing,
  type IssuanceRequestContext,
  type IssuanceRequestRecord,
} from '@/lib/document-validity/issuance-bidding';
import type { IssuanceBiddingView, IssuanceRequestBody, IssuanceRequestServiceRefusal } from '@/lib/document-validity/issuance-bidding-request';
import { professionalReferenceOf, type IssuanceProfessional } from '@/lib/document-validity/issuance-professional';
import { showcaseIssuanceCredential } from '@/lib/document-validity/issuance-showcase-credential';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import { readLedgerIssuanceInTx, stageIssuanceAction, type IssuanceWrite, type StagedIssuanceWrite } from './issuance-assignments.server';
import { subjectLatestIssuedOn, type IssuanceSubject } from './issuance-latest-issued.server';
import type { IssuanceLedger } from './issuance-ledger';
import { bidIdOf } from './issuance-request-schema';
import {
  issuanceRequestRefOf,
  readIssuanceRequestInTx,
  readIssuanceRequestView,
  writeIssuanceRequestInTx,
  type IssuanceRequestTarget,
} from './issuance-requests.server';
import { readUpkeepSubject } from './upkeep-subject.server';

/** Ποιος πράττει — ο ιδιώτης στο δικό του βιβλίο, με όνομα για το ιστορικό. */
export interface IssuanceRequestActor extends ListingActor {
  readonly name: string | null;
}

type Refused = { readonly ok: false; readonly refusal: IssuanceRequestServiceRefusal };
export type IssuanceRequestResult = { readonly ok: true; readonly outcome: 'changed' | 'unchanged'; readonly cycle: number } | Refused;
export type IssuanceRequestReading = { readonly ok: true; readonly view: IssuanceBiddingView } | Refused;

const refused = (refusal: IssuanceRequestServiceRefusal): Refused => ({ ok: false, refusal });

/** Το υποκείμενο της πράξης, κριμένο: ακίνητο · βιβλίο ιδιώτη · νεότερο έγγραφο του είδους. */
interface ResolvedRequest {
  readonly subject: IssuanceSubject;
  readonly target: IssuanceRequestTarget;
  readonly latestIssuedOn: string | null;
}

async function resolveRequest(db: Firestore, actor: ListingActor, propertyId: string, documentKind: DocumentKind, now: Date): Promise<ResolvedRequest | Refused> {
  const subject = await readUpkeepSubject(db, actor, propertyId);
  if (subject.kind !== 'subject') return refused(subject.kind);
  if (subject.owner.userId === undefined) return refused('office-ledger');
  const issuance = await subjectLatestIssuedOn(db, subject, documentKind, now);
  if (issuance.kind === 'unknown') return refused('unavailable');
  if (issuance.kind === 'not-assignable') return refused('not-assignable');
  return { subject, target: { owner: subject.owner, propertyId, documentKind }, latestIssuedOn: issuance.latestIssuedOn };
}

/** Το αίτημα και οι προσφορές του — ο ΙΔΙΟΣ κριτής με την πράξη (GET ⇔ PUT δεν διαφωνούν ποτέ). */
export async function readIssuanceRequest(db: Firestore, actor: ListingActor, propertyId: string, documentKind: DocumentKind, now: Date): Promise<IssuanceRequestReading> {
  const resolved = await resolveRequest(db, actor, propertyId, documentKind, now);
  if ('ok' in resolved) return resolved;
  return { ok: true, view: await readIssuanceRequestView(db, resolved.target, resolved.latestIssuedOn) };
}

/** Τα κοινά μιας εγγραφής προσφοράς — ό,τι αλλάζει ανά προσφορά είναι το βιβλίο, το στάδιο που είδε ο άνθρωπος και η πράξη. */
interface BidWriteContext {
  readonly resolved: ResolvedRequest;
  readonly actor: IssuanceRequestActor;
  readonly requestId: string;
  readonly cycle: number;
  readonly names: IssuanceWrite['names'];
  readonly nowIso: string;
}

function bidLedger(ctx: BidWriteContext, bidId: string): IssuanceLedger {
  return { kind: 'owned', owner: ctx.resolved.target.owner, assignmentId: bidId, requestId: ctx.requestId, cycle: ctx.cycle };
}

function stageBid(tx: Transaction, db: Firestore, ctx: BidWriteContext, bidId: string, expectedStage: IssuanceStage | null, action: IssuanceAction): Promise<StagedIssuanceWrite> {
  const { property } = ctx.resolved.subject;
  return stageIssuanceAction(tx, db, {
    ledger: bidLedger(ctx, bidId),
    writer: { kind: 'owner', uid: ctx.actor.uid, name: ctx.actor.name, expectedStage },
    property: { id: property.id, scope: property.scope, name: property.name },
    documentKind: ctx.resolved.target.documentKind,
    latestIssuedOn: ctx.resolved.latestIssuedOn,
    action,
    names: ctx.names,
    nowIso: ctx.nowIso,
  });
}

/** Το πλαίσιο του μειωτή: είναι η νικήτρια (αν υπάρχει) ακόμη ανοιχτή; — διαβασμένο **μέσα** στη συναλλαγή. */
async function requestContextInTx(tx: Transaction, db: Firestore, ctx: Omit<BidWriteContext, 'cycle'>, current: IssuanceRequestRecord | null): Promise<IssuanceRequestContext> {
  const base = { uid: ctx.actor.uid, nowIso: ctx.nowIso };
  if (current === null || current.award === null) return { ...base, awardedBidOpen: false };
  const ledger = bidLedger({ ...ctx, cycle: current.cycle }, current.award.bidId);
  const winner = await readLedgerIssuanceInTx(tx, db, ledger, ctx.resolved.target.propertyId, ctx.resolved.target.documentKind);
  return { ...base, awardedBidOpen: issuanceStateOf(winner, ctx.resolved.latestIssuedOn).kind === 'open' };
}

/** Ό,τι γυρίζει μια συναλλαγή: το αποτέλεσμα, και οι εγγραφές προσφορών που θέλουν ιστορικό **μετά** την επιτυχία. */
interface TxOutcome {
  readonly result: IssuanceRequestResult;
  readonly staged: readonly StagedIssuanceWrite[];
}

const refusedTx = (refusal: IssuanceRequestServiceRefusal): TxOutcome => ({ result: refused(refusal), staged: [] });

async function runRequestTx(db: Firestore, body: (tx: Transaction) => Promise<TxOutcome>): Promise<IssuanceRequestResult> {
  const outcome = await db.runTransaction(body);
  for (const staged of outcome.staged) await staged.audit();
  return outcome.result;
}

/** Η βιτρίνα ως επαγγελματίας της προσφοράς, με το προσόν της — ή η άρνηση που λέει **γιατί** όχι. */
async function showcaseProfessionalOf(db: Firestore, companyId: string, kind: DocumentKind) {
  const lookup = await lookupAgencyProfile(db, companyId);
  if (lookup.outcome === 'unavailable') return refused('unavailable');
  if (lookup.outcome === 'not-published') return refused('professional-unavailable');
  const credential = showcaseIssuanceCredential(lookup.showcase, kind);
  if (credential === null) return refused('unqualified');
  const professional: IssuanceProfessional = { kind: 'workspace', companyId };
  return { professional, credential, name: lookup.showcase.displayName };
}

type InviteBody = Extract<IssuanceRequestBody, { action: 'invite' }>;

async function invite(db: Firestore, actor: IssuanceRequestActor, resolved: ResolvedRequest, body: InviteBody, nowIso: string): Promise<IssuanceRequestResult> {
  const chosen = await showcaseProfessionalOf(db, body.professionalCompanyId, body.documentKind);
  if ('ok' in chosen) return chosen;
  const ref = issuanceRequestRefOf(db, resolved.target);
  const names = { [professionalReferenceOf(chosen.professional)]: chosen.name };
  const base = { resolved, actor, requestId: ref.id, names, nowIso };
  return runRequestTx(db, async (tx) => {
    const current = await readIssuanceRequestInTx(tx, ref, resolved.target);
    if ((current?.cycle ?? null) !== body.expectedCycle) return refusedTx('stale');
    const reqCtx = await requestContextInTx(tx, db, base, current);
    const cycle = inviteCycleOf(current, reqCtx);
    const bidId = bidIdOf(ref.id, cycle, chosen.professional);
    const reduced = reduceIssuanceRequest(current, { kind: 'invite', professional: chosen.professional, bidId }, reqCtx);
    if (!reduced.ok) return refusedTx(reduced.refusal);
    if (!reduced.changed) return { result: { ok: true, outcome: 'unchanged', cycle }, staged: [] };
    const staged = await stageBid(tx, db, { ...base, cycle }, bidId, null, { kind: 'propose', professional: chosen.professional, credential: chosen.credential });
    if (!staged.outcome.ok) return refusedTx(staged.outcome.refusal);
    staged.commit();
    writeIssuanceRequestInTx(tx, ref, { ...resolved.target, scope: resolved.subject.property.scope, record: reduced.record, nowIso });
    return { result: { ok: true, outcome: 'changed', cycle }, staged: [staged] };
  });
}

/** Είδε ο άνθρωπος **ακριβώς** τις προσφορές του κύκλου; — μία που δεν είδε ⇒ `stale`, ποτέ πράξη πάνω της. */
function sawEveryBid(current: IssuanceRequestRecord, expected: Readonly<Record<string, IssuanceStage | null>>): boolean {
  const seen = Object.keys(expected);
  return seen.length === current.bids.length && current.bids.every((bid) => bid.bidId in expected);
}

/**
 * Κλείνει τις προσφορές που λέει ο μειωτής, στην ΙΔΙΑ συναλλαγή. Όποια ο άνθρωπος είδε **ήδη κλειστή** (`null`) και είναι
 * όντως κλειστή, παραλείπεται — δεν ακυρώνεται δεύτερη φορά· κάθε άλλη άρνηση σταματά ολόκληρη την πράξη.
 */
async function stageClosings(tx: Transaction, db: Firestore, ctx: BidWriteContext, closing: IssuanceBidClosing | null, expected: Readonly<Record<string, IssuanceStage | null>>): Promise<readonly StagedIssuanceWrite[] | Refused> {
  const staged: StagedIssuanceWrite[] = [];
  for (const bidId of closing?.bidIds ?? []) {
    const seen = expected[bidId] ?? null;
    const next = await stageBid(tx, db, ctx, bidId, seen, { kind: 'cancel', reason: closing?.reason ?? 'cancelled' });
    if (next.outcome.ok) staged.push(next);
    else if (!(next.outcome.refusal === 'transition-refused' && seen === null)) return refused(next.outcome.refusal);
  }
  return staged;
}

type ClosingBody = Extract<IssuanceRequestBody, { action: 'award' | 'cancel' }>;

/** Η απόφαση στη νικήτρια — `owner-self`: κανένα κανάλι καταγραφής, κανένας υπεύθυνος-επαφή (ADR-945 Δ3). */
function winnerDecision(body: Extract<IssuanceRequestBody, { action: 'award' }>): IssuanceAction {
  return { kind: 'decide', outcome: 'approved', channel: null, note: null, ownerContactId: null, quoteRevision: body.quoteRevision, ownerAttestation: null };
}

/** Ανάθεση **ή** ακύρωση: αίτημα + (νικήτρια) + κλείσιμο των άλλων, σε ΜΙΑ συναλλαγή. */
async function closeOut(db: Firestore, actor: IssuanceRequestActor, resolved: ResolvedRequest, body: ClosingBody, nowIso: string): Promise<IssuanceRequestResult> {
  const ref = issuanceRequestRefOf(db, resolved.target);
  const base = { resolved, actor, requestId: ref.id, names: {}, nowIso };
  return runRequestTx(db, async (tx) => {
    const current = await readIssuanceRequestInTx(tx, ref, resolved.target);
    if (current === null) return refusedTx('request-closed');
    if (current.cycle !== body.expectedCycle || !sawEveryBid(current, body.expectedStages)) return refusedTx('stale');
    const reduced = reduceIssuanceRequest(current, body.action === 'award' ? { kind: 'award', bidId: body.bidId } : { kind: 'cancel' }, await requestContextInTx(tx, db, base, current));
    if (!reduced.ok) return refusedTx(reduced.refusal);
    if (!reduced.changed) return { result: { ok: true, outcome: 'unchanged', cycle: current.cycle }, staged: [] };
    const ctx = { ...base, cycle: current.cycle };
    const winner = body.action === 'award' ? await stageBid(tx, db, ctx, body.bidId, body.expectedStages[body.bidId] ?? null, winnerDecision(body)) : null;
    if (winner !== null && !winner.outcome.ok) return refusedTx(winner.outcome.refusal);
    const closings = await stageClosings(tx, db, ctx, reduced.closing, body.expectedStages);
    if ('ok' in closings) return refusedTx(closings.refusal);
    const staged = winner === null ? closings : [winner, ...closings];
    for (const write of staged) write.commit();
    writeIssuanceRequestInTx(tx, ref, { ...resolved.target, scope: resolved.subject.property.scope, record: reduced.record, nowIso });
    return { result: { ok: true, outcome: 'changed', cycle: current.cycle }, staged };
  });
}

export async function actOnIssuanceRequest(db: Firestore, actor: IssuanceRequestActor, body: IssuanceRequestBody, now: Date): Promise<IssuanceRequestResult> {
  const resolved = await resolveRequest(db, actor, body.propertyId, body.documentKind, now);
  if ('ok' in resolved) return resolved;
  const nowIso = now.toISOString();
  switch (body.action) {
    case 'invite': return invite(db, actor, resolved, body, nowIso);
    case 'award': case 'cancel': return closeOut(db, actor, resolved, body, nowIso);
  }
}
