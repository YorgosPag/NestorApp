/**
 * =============================================================================
 * «Οι υποθέσεις μου» — η πλευρά του ΕΠΑΓΓΕΛΜΑΤΙΑ (ADR-901 Φ2 §5.4 · ADR-862 Φ1)
 * =============================================================================
 *
 * - `listMyCases`            — κάθε συμμετοχή του ανθρώπου σε ξένη υπόθεση (collection-group στο `uid`)
 * - `respondToCaseEngagement` — «Αναλαμβάνω» / «Δεν αναλαμβάνω» (Entra: πρόσβαση ΜΟΝΟ μετά την αποδοχή)
 * - `getEngagedCaseView`     — η υπόθεση, φιλτραρισμένη ανά **ρόλο** (`visibleTo`) και **εμβέλεια** (WIP ⛔)
 *
 * 🔑 **Ο χώρος δεν έρχεται ποτέ από το αίτημα**: ο άνθρωπος ζητά με `eng_…`· η συμμετοχή βρίσκεται **ανάμεσα
 *    στις δικές του** (Admin SDK, `uid` από το token)· ο μισθωτής της υπόθεσης είναι **ο μισθωτής της
 *    συμμετοχής**, και επαληθεύεται ξανά πάνω στο έγγραφο της υπόθεσης (ζώνη-και-τιράντες).
 * 🔑 **Κάθε ανάγνωση περνά από τον `decideEngagement`** — λήξη/ανάκληση κρίνονται **ανά αίτημα**, χωρίς cache
 *    («new enemy problem» του Zanzibar — η ανάκληση είναι άμεση).
 *
 * @module services/conveyance/conveyance-engagement-access.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import { listEngagementsOfUser, selectCurrentEngagement } from '@/lib/auth/engagement-read';
import { transitionEngagement, type EngagementTransition } from '@/lib/auth/engagement-write';
import { deriveCaseChecklist } from '@/lib/conveyance/case-checklist';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { conveyanceToday, nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { declaredCredentialOf, latestOwnDeclaration, type CaseEngagementAnswer } from '@/lib/conveyance/declared-credential';
import { deriveFacts } from '@/lib/conveyance/derive-facts';
import type { ConveyanceCase, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import type { Engagement, EngagementDecision, EngagementVerdict } from '@/types/engagement';
import type { CredentialHint } from '@/types/engagement-invitation';
import { collectCaseEvidence, HOST_EVIDENCE_VIEWER, type CaseEvidenceViewer } from './conveyance-case-evidence.server';
import { actingViews, resolveActingFor, type ActingRejection, type ActingViewer, type ActingViews } from './conveyance-acting-workspace.server';
import { contactCredentialHint } from './conveyance-professional.server';
import { documentRequestPanel } from './conveyance-document-request-panel.server';
import { listCaseParticipants } from './conveyance-case-participants.server';
import { loadConveyanceSubject, type ConveyanceSubjectContext } from './conveyance-subject.server';
import { announceEngagementAnswered } from './conveyance-engagement-notifier';
import { answerChanges, engagementKeyOf, recordEngagementAudit } from './conveyance-engagement-support';
import { caseRosterSignal, readViewRevision } from './conveyance-view-signal.server';

// =============================================================================
// ΚΟΙΝΑ
// =============================================================================

/** Η υπόθεση της συμμετοχής — **μόνο** αν ανήκει στον μισθωτή **της συμμετοχής** (ξένη ≡ ανύπαρκτη). */
async function readCaseOf(db: Firestore, engagement: Engagement): Promise<ConveyanceCase | null> {
  const record = parseConveyanceCase((await db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(engagement.subject.caseId).get()).data());
  if (!record || record.companyId !== engagement.hostCompanyId || record.subject.projectId !== engagement.projectId) return null;
  return record;
}

/** Η τρέχουσα συμμετοχή **του ίδιου** με αυτή την ταυτότητα — ή `null` (καμία μαρτυρία ύπαρξης ξένης). */
async function findOwnEngagement(db: Firestore, uid: string, engagementId: string): Promise<Engagement | null | 'unknown'> {
  const list = await listEngagementsOfUser(db, uid);
  if (list.outcome === 'unknown') return 'unknown';
  return list.engagements.find((e) => e.id === engagementId) ?? null;
}

function judge(engagement: Engagement, uid: string, nowMs: number): EngagementDecision {
  return decideEngagement({ engagement, uid, subject: engagement.subject, scope: 'conveyance:case:view', nowMs });
}

/** **Ποιος** κοιτά τον κατάλογο — ο θεατής του ΕΝΟΣ συλλέκτη τεκμηρίων (`conveyance-case-evidence.server`). */
export type ChecklistViewer = CaseEvidenceViewer;

/** Ο οικοδεσπότης: όλες οι γραμμές, όλα τα ενεργά τεκμήρια, και ό,τι του στάλθηκε. */
export const HOST_CHECKLIST_VIEWER: ChecklistViewer = HOST_EVIDENCE_VIEWER;

/**
 * Ο επαγγελματίας μιας συμμετοχής: ο ρόλος της, το πρότυπό της, και ποιος είναι (τα δικά του transmittals).
 * Χωρίς `uid` (προεπισκόπηση πρόσκλησης — ο προσκεκλημένος δεν έχει ακόμη λογαριασμό) ⇒ τίποτα δεν είναι «δικό του».
 */
export function engagementChecklistViewer(engagement: Pick<Engagement, 'role' | 'template'> & { readonly uid?: string }): ChecklistViewer {
  return { role: engagement.role, audience: engagement.template, uid: engagement.uid ?? null };
}

/**
 * Ο κατάλογος όπως τον βλέπει **αυτός ο θεατής** — ο ΕΝΑΣ τρόπος server-side: τον ζητούν η υπόθεση του
 * επαγγελματία, η πρόσκληση με email (μετρήσεις, ADR-901 Φ3 §5.6) **και** οι ειδοποιήσεις λήξεων (Φ4).
 */
export async function checklistForRole(
  db: Firestore,
  record: ConveyanceCase,
  context: ConveyanceSubjectContext,
  viewer: ChecklistViewer,
) {
  const evidence = await collectCaseEvidence(db, record, viewer);
  return deriveCaseChecklist({
    record,
    derivedFacts: deriveFacts(context.factSources),
    evidence: evidence.files,
    sealed: evidence.sealed,
    today: conveyanceToday(),
    viewer: viewer.role,
  });
}

function engagedChecklist(db: Firestore, engagement: Engagement, record: ConveyanceCase, context: ConveyanceSubjectContext) {
  return checklistForRole(db, record, context, engagementChecklistViewer(engagement));
}

// =============================================================================
// «ΟΙ ΥΠΟΘΕΣΕΙΣ ΜΟΥ»
// =============================================================================

/**
 * Η προσυμπλήρωση της δήλωσης για **πρόταση** που περιμένει απάντηση: πρώτα η δική του πιο πρόσφατη δήλωση,
 * μετά το βιβλίο του οικοδεσπότη. Για κάθε άλλη κατάσταση `null` (δεν υπάρχει τι να δηλωθεί).
 */
async function offerCredentialHint(db: Firestore, engagement: Engagement, history: readonly Engagement[]): Promise<CredentialHint | null> {
  if (engagement.state !== 'offered') return null;
  return latestOwnDeclaration(history, engagement.role)
    ?? contactCredentialHint(db, engagement.hostCompanyId, engagement.origin.contactId, engagement.role);
}

async function cardOf(db: Firestore, engagement: Engagement, verdict: EngagementVerdict, history: readonly Engagement[], acting: ActingViews): Promise<MyCaseCard> {
  const record = await readCaseOf(db, engagement);
  const context = record ? await loadConveyanceSubject(db, record.companyId, record.subject.propertyId) : null;
  const engaged = isEngaged(verdict) && record !== null && context !== null;
  const checklist = engaged ? await engagedChecklist(db, engagement, record, context) : null;
  return {
    engagementId: engagement.id,
    role: engagement.role,
    engagementState: engagement.state,
    verdict,
    offeredAt: engagement.offeredAt,
    expiresAt: engagement.expiresAt,
    // Η πρόταση δείχνει **ποιο** ακίνητο (για να αποφασίσει) — ποτέ περιεχόμενο πριν την αποδοχή.
    propertyName: context?.propertyName ?? null,
    caseState: record && context ? effectiveCaseState(record.storedState, context.legalPhase) : null,
    summary: checklist?.summary ?? null,
    credentialHint: await offerCredentialHint(db, engagement, history),
    targetSigningDate: engaged ? record.targetSigningDate : null,
    // §15 Γ1 — πριν από το πάτημα: τι θα γίνει· μετά: για ποιον ενεργεί. Ο ΙΔΙΟΣ κριτής με την αποδοχή.
    acceptance: engagement.state === 'offered' ? await acting.acceptance() : null,
    actingFor: await acting.actingFor(engagement),
  };
}

export type MyCasesOutcome = { readonly ok: true; readonly cards: readonly MyCaseCard[] } | { readonly ok: false };

/** Μία κάρτα **ανά υπόθεση** (η τρέχουσα συμμετοχή), νεότερη πρώτη. */
export async function listMyCases(db: Firestore, viewer: ActingViewer, nowMs: number): Promise<MyCasesOutcome> {
  const { uid } = viewer;
  const acting = actingViews(viewer);
  const list = await listEngagementsOfUser(db, uid);
  if (list.outcome === 'unknown') return { ok: false };
  const byCase = new Map<string, Engagement[]>();
  for (const e of list.engagements) byCase.set(e.subject.caseId, [...(byCase.get(e.subject.caseId) ?? []), e]);
  const current = [...byCase.values()]
    .map((history) => selectCurrentEngagement(history).engagement)
    .filter((e): e is Engagement => e !== null);
  const cards = await Promise.all(current.map((e) => cardOf(db, e, judge(e, uid, nowMs).verdict, list.engagements, acting)));
  return { ok: true, cards: [...cards].sort((a, b) => b.offeredAt.localeCompare(a.offeredAt)) };
}

// =============================================================================
// ΑΠΑΝΤΗΣΗ
// =============================================================================

export type RespondOutcome =
  | { readonly ok: true; readonly card: MyCaseCard }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' | 'offer-expired' | 'not-allowed' | 'acting-choice-required' | 'acting-refused' };

/** Ποιος απαντά: ο άνθρωπος (token) και ο χώρος γραφείου του αιτήματός του — για το «για λογαριασμό ποιου» (§15). */
export interface RespondingActor extends ActingViewer {
  readonly email: string | null;
}

type PlannedAnswer =
  | { readonly ok: true; readonly transition: EngagementTransition }
  | { readonly ok: false; readonly rejection: Exclude<ActingRejection, 'acting-unknown'> | 'unknown' };

/**
 * Η απάντηση ως μετάβαση. 🔑 §15 Γ1 — η αποδοχή περνά **πρώτα** από τον κριτή της ιδιότητας (`resolveActingFor`):
 * χωρίς χώρο «για λογαριασμό ποιου» **δεν** φτάνει ποτέ στον γραφέα (2+ γραφεία χωρίς επιλογή · ξένο γραφείο ·
 * «δεν μπόρεσα να ρωτήσω» ⇒ ονομασμένη άρνηση, καμία γραφή).
 */
async function planAnswer(own: Engagement, actor: RespondingActor, answer: CaseEngagementAnswer, nowMs: number): Promise<PlannedAnswer> {
  if (answer.decision === 'decline') return { ok: true, transition: { kind: 'decline', byUid: actor.uid } };
  const acting = await resolveActingFor(actor, answer.actingRequest ?? null);
  if (!acting.ok) return { ok: false, rejection: acting.rejection === 'acting-unknown' ? 'unknown' : acting.rejection };
  const declaredCredential = declaredCredentialOf(own.role, answer.credential, new Date(nowMs).toISOString());
  return { ok: true, transition: { kind: 'accept', byUid: actor.uid, declaredCredential, actingFor: acting.actingFor } };
}

/** «Αναλαμβάνω» / «Δεν αναλαμβάνω» — **μόνο** ο ίδιος, **μόνο** σε πρόταση. Ιδεμποτές. */
export async function respondToCaseEngagement(
  db: Firestore,
  actor: RespondingActor,
  engagementId: string,
  answer: CaseEngagementAnswer,
  nowMs: number,
): Promise<RespondOutcome> {
  const own = await findOwnEngagement(db, actor.uid, engagementId);
  if (own === 'unknown') return { ok: false, rejection: 'unknown' };
  if (!own) return { ok: false, rejection: 'not-found' };
  // Η υπόθεση διαβάζεται ΠΡΙΝ: η απάντηση αλλάζει τον κατάλογο συμμετεχόντων ⇒ σήμα στις όψεις της (§14.8).
  const record = await readCaseOf(db, own);
  if (!record) return { ok: false, rejection: 'not-found' };
  const planned = await planAnswer(own, actor, answer, nowMs);
  if (!planned.ok) return planned;
  const outcome = await transitionEngagement(db, engagementKeyOf(own), planned.transition, nowMs, caseRosterSignal(db, record));
  if (outcome.outcome === 'not-found') return { ok: false, rejection: 'not-found' };
  if (outcome.outcome === 'not-allowed' || outcome.outcome === 'offer-expired') return { ok: false, rejection: outcome.outcome };
  const after = outcome.outcome === 'changed' ? outcome.after : outcome.engagement;
  if (outcome.outcome === 'changed') await recordAnswer(db, actor, record, outcome.before, after);
  return { ok: true, card: await cardOf(db, after, judge(after, actor.uid, nowMs).verdict, [], actingViews(actor)) };
}

/** Ίχνος στο βιβλίο του οικοδεσπότη + ειδοποίηση όποιου πρότεινε. */
async function recordAnswer(db: Firestore, actor: { readonly uid: string; readonly email: string | null }, record: ConveyanceCase, before: Engagement, after: Engagement): Promise<void> {
  const context = await loadConveyanceSubject(db, record.companyId, record.subject.propertyId);
  const name = context?.propertyName ?? null;
  await recordEngagementAudit({ engagement: after, action: 'status_changed', changes: answerChanges(before, after), performedBy: actor.uid, performedByName: actor.email, entityName: name });
  await announceEngagementAnswered(after, record.subject.propertyId, name);
}

// =============================================================================
// Η ΥΠΟΘΕΣΗ
// =============================================================================

/** Η υπόθεση **μέσω** της δικής μου, ενεργής **τώρα**, συμμετοχής: η συμμετοχή · η πράξη · το πλαίσιο του ακινήτου. */
export interface EngagedCaseAccess {
  readonly engagement: Engagement;
  readonly record: ConveyanceCase;
  readonly context: ConveyanceSubjectContext;
}

export type EngagedCaseResolution =
  | { readonly ok: true; readonly access: EngagedCaseAccess }
  /** Η **δική του** συμμετοχή, χωρίς πρόσβαση τώρα — ονομασμένος λόγος (offered · revoked · expired · …). */
  | { readonly ok: false; readonly rejection: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' };

/**
 * **Ο ΕΝΑΣ δρόμος** κάθε ανάγνωσης του επαγγελματία (όψη · αρχεία · ίχνος): δική μου συμμετοχή → κρίση **ανά
 * αίτημα** (`decideEngagement`) → η υπόθεση **στον μισθωτή της συμμετοχής**. Δεύτερος δρόμος = δεύτερος κριτής.
 */
export async function resolveEngagedCase(db: Firestore, uid: string, engagementId: string, nowMs: number): Promise<EngagedCaseResolution> {
  const own = await findOwnEngagement(db, uid, engagementId);
  if (own === 'unknown') return { ok: false, rejection: 'unknown' };
  if (!own) return { ok: false, rejection: 'not-found' };
  const decision = judge(own, uid, nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const record = await readCaseOf(db, own);
  const context = record ? await loadConveyanceSubject(db, record.companyId, record.subject.propertyId) : null;
  if (!record || !context) return { ok: false, rejection: 'not-found' };
  return { ok: true, access: { engagement: own, record, context } };
}

/** Ο κατάλογος της πρόσβασης — φιλτραρισμένος ανά ρόλο και εμβέλεια. */
export function engagedChecklistOf(db: Firestore, access: EngagedCaseAccess) {
  return engagedChecklist(db, access.engagement, access.record, access.context);
}

/** Η όψη μπαγιατεύει μόνη της στην αλλαγή ελληνικής ημέρας — ή νωρίτερα, όταν λήγει η ίδια η συμμετοχή. */
function engagedFreshUntil(engagement: Engagement, nowMs: number): string {
  const nextDay = nextConveyanceDayStart(new Date(nowMs)).getTime();
  const expiresAt = Date.parse(engagement.expiresAt);
  return new Date(Number.isFinite(expiresAt) && expiresAt > nowMs ? Math.min(nextDay, expiresAt) : nextDay).toISOString();
}

export type EngagedCaseOutcome =
  | { readonly ok: true; readonly view: EngagedCaseView }
  | Extract<EngagedCaseResolution, { ok: false }>;

/** Η υπόθεση μέσω της συμμετοχής — **ποτέ** το ωμό έγγραφο. */
export async function getEngagedCaseView(db: Firestore, uid: string, engagementId: string, nowMs: number): Promise<EngagedCaseOutcome> {
  // §14.8 — η αναθεώρηση ΠΡΙΝ από κάθε ανάγνωση της υπόθεσης (το σήμα ανήκει στη συμμετοχή, όχι στην υπόθεση).
  const revision = await readViewRevision(db, { kind: 'engagement', engagementId, uid });
  const resolution = await resolveEngagedCase(db, uid, engagementId, nowMs);
  if (!resolution.ok) return resolution;
  const { engagement, record, context } = resolution.access;
  const state = effectiveCaseState(record.storedState, context.legalPhase);
  const checklist = await engagedChecklistOf(db, resolution.access);
  const party = { role: engagement.role, uid } as const;
  return {
    ok: true,
    view: {
      engagementId: engagement.id,
      role: engagement.role,
      caseId: record.id,
      state,
      propertyName: context.propertyName,
      targetSigningDate: record.targetSigningDate,
      checklist,
      participants: await listCaseParticipants(db, engagement, nowMs),
      // Φ4.5 — «Ζήτησε έγγραφο»: ο ΙΔΙΟΣ κριτής με τον γραφέα, πάνω στις γραμμές που ήδη βλέπει.
      documentRequests: await documentRequestPanel(db, { record, state, party, rows: checklist.rows, nowMs }),
      freshness: { revision, freshUntil: engagedFreshUntil(engagement, nowMs) },
    },
  };
}
