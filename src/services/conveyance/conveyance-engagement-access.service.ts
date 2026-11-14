/**
 * =============================================================================
 * «Οι υποθέσεις μου» — η πλευρά του ΕΠΑΓΓΕΛΜΑΤΙΑ (ADR-901 Φ2 §5.4 · ADR-862 Φ1)
 * =============================================================================
 *
 * - `listCaseCards`          — οι κάρτες των υποθέσεων μεταβίβασης του ανθρώπου, όπως φαίνονται **στον χώρο της
 *                              σελίδας** (§15 Γ2 — φίλτρο στη μνήμη, κανένας νέος δείκτης)· η μία λίστα όλων των
 *                              ειδών: `server/engagements/my-engagements.server.ts` (ADR-862 §5.3.11)
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
import { isShownInWorkspace } from '@/lib/auth/acting-workspace';
import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import { listEngagementsOfUser, selectCurrentEngagement } from '@/lib/auth/engagement-read';
import { transitionEngagement, type EngagementTransition } from '@/lib/auth/engagement-write';
import { deriveCaseChecklist } from '@/lib/conveyance/case-checklist';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { conveyanceToday, nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import {
  declaredCredentialOf,
  latestOwnDeclaration,
  legalRoleAuthority,
  type CaseEngagementAnswer,
} from '@/lib/conveyance/declared-credential';
import { deriveFacts } from '@/lib/conveyance/derive-facts';
import type { ConveyanceCase, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import {
  isConveyanceEngagement,
  SCOPE_OF_SUBJECT,
  type ConveyanceEngagement,
  type Engagement,
  type EngagementDecision,
  type EngagementVerdict,
} from '@/types/engagement';
import type { CredentialHint } from '@/types/engagement-invitation';
import type { WorkspaceRef } from '@/types/workspace-membership';
import { collectCaseEvidence, HOST_EVIDENCE_VIEWER, type CaseEvidenceViewer } from './conveyance-case-evidence.server';
import { actingViews, placeEngagement, resolveActingFor, type ActingRejection, type ActingViewer, type ActingViews } from './conveyance-acting-workspace.server';
import { contactCredentialHint } from './conveyance-professional.server';
import { documentRequestPanel } from './conveyance-document-request-panel.server';
import { listCaseParticipants } from './conveyance-case-participants.server';
import { readCasePartyLabels } from './conveyance-party-labels.server';
import { visiblePartyKeys, visibleSellers } from '@/lib/conveyance/party-labels';
import { loadConveyanceSubject, type ConveyanceSubjectContext } from './conveyance-subject.server';
import { announceEngagementAnswered } from './conveyance-engagement-notifier';
import { answerChanges, asCaseEngagement, engagementKeyOf, recordEngagementAudit } from './conveyance-engagement-support';
import { caseRosterSignal, readViewRevision } from './conveyance-view-signal.server';

// =============================================================================
// ΚΟΙΝΑ
// =============================================================================

/**
 * Η υπόθεση της συμμετοχής — **μόνο** αν ανήκει στον μισθωτή **της συμμετοχής** (ξένη ≡ ανύπαρκτη).
 * Εξάγεται για τη γραμμή «Ανέλαβε» του οικοδεσπότη (`hostLine`, ADR-915 §40) — ο ΕΝΑΣ αναγνώστης, όχι δεύτερος.
 */
export async function readCaseOf(db: Firestore, engagement: ConveyanceEngagement): Promise<ConveyanceCase | null> {
  const record = parseConveyanceCase((await db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(engagement.subject.caseId).get()).data());
  if (!record || record.companyId !== engagement.hostCompanyId || record.subject.projectId !== engagement.projectId) return null;
  return record;
}

/** Η τρέχουσα συμμετοχή **του ίδιου** με αυτή την ταυτότητα — ή `null` (καμία μαρτυρία ύπαρξης ξένης). */
async function findOwnEngagement(db: Firestore, uid: string, engagementId: string): Promise<ConveyanceEngagement | null | 'unknown'> {
  const list = await listEngagementsOfUser(db, uid);
  if (list.outcome === 'unknown') return 'unknown';
  // ADR-862 §5.3.10 — συμμετοχή άλλου είδους (ανάθεση έκδοσης) **δεν** είναι υπόθεση μεταβίβασης ⇒ ίδια απάντηση με την ανύπαρκτη.
  return list.engagements.filter(isConveyanceEngagement).find((e) => e.id === engagementId) ?? null;
}

/** Το σπίτι μιας **δικής του** συμμετοχής — ή «δεν είναι δική του / δεν υπάρχει» — ή «δεν μπόρεσα να ρωτήσω». */
export type OwnCaseHome =
  | { readonly outcome: 'home'; readonly home: WorkspaceRef }
  | { readonly outcome: 'none' }
  | { readonly outcome: 'unknown' };

/**
 * **«Πού ζει ΤΩΡΑ η συμμετοχή μου `eng_…`;»** (ADR-901 §15.16) — για τον φρουρό του χώρου, που βρήκε τον άνθρωπο
 * σε διεύθυνση υπόθεσης γραφείου όπου **δεν ανήκει πια** (παλιός σύνδεσμος · email γραμμένο πριν από την αποχώρηση).
 *
 * 🔑 Ίδια ανάγνωση (`findOwnEngagement`: μόνο οι συμμετοχές **του ίδιου**) και ίδιο σπίτι (`placeEngagement`) με
 *    την ειδοποίηση — κανένας δεύτερος κανόνας. ⛔ **Δεν κρίνει πρόσβαση**: την κρίνει η σελίδα στο σπίτι
 *    (`decideEngagement`, ανά αίτημα)· εδώ απαντιέται μόνο η **πόρτα**. Ξένη και ανύπαρκτη ⇒ το ίδιο `none`.
 */
export async function locateOwnCaseHome(db: Firestore, uid: string, engagementId: string): Promise<OwnCaseHome> {
  const own = await findOwnEngagement(db, uid, engagementId);
  if (own === 'unknown') return { outcome: 'unknown' };
  if (!own) return { outcome: 'none' };
  const placement = await placeEngagement(own);
  return placement.outcome === 'placed' ? { outcome: 'home', home: placement.home } : { outcome: 'unknown' };
}

function judge(engagement: ConveyanceEngagement, uid: string, nowMs: number): EngagementDecision {
  return decideEngagement({ engagement, uid, subject: engagement.subject, scope: SCOPE_OF_SUBJECT.conveyance_case, nowMs });
}

/** **Ποιος** κοιτά τον κατάλογο — ο θεατής του ΕΝΟΣ συλλέκτη τεκμηρίων (`conveyance-case-evidence.server`). */
export type ChecklistViewer = CaseEvidenceViewer;

/** Ο οικοδεσπότης: όλες οι γραμμές, όλα τα ενεργά τεκμήρια, και ό,τι του στάλθηκε. */
export const HOST_CHECKLIST_VIEWER: ChecklistViewer = HOST_EVIDENCE_VIEWER;

/**
 * Ο επαγγελματίας μιας συμμετοχής: ο ρόλος της, το πρότυπό της, και ποιος είναι (τα δικά του transmittals).
 * Χωρίς `uid` (προεπισκόπηση πρόσκλησης — ο προσκεκλημένος δεν έχει ακόμη λογαριασμό) ⇒ τίποτα δεν είναι «δικό του».
 */
export function engagementChecklistViewer(engagement: Pick<ConveyanceEngagement, 'role' | 'template'> & { readonly uid?: string }): ChecklistViewer {
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

function engagedChecklist(db: Firestore, engagement: ConveyanceEngagement, record: ConveyanceCase, context: ConveyanceSubjectContext) {
  return checklistForRole(db, record, context, engagementChecklistViewer(engagement));
}

// =============================================================================
// «ΟΙ ΥΠΟΘΕΣΕΙΣ ΜΟΥ»
// =============================================================================

/**
 * Η προσυμπλήρωση της δήλωσης για **πρόταση** που περιμένει απάντηση: πρώτα η δική του πιο πρόσφατη δήλωση,
 * μετά το βιβλίο του οικοδεσπότη. Για κάθε άλλη κατάσταση `null` (δεν υπάρχει τι να δηλωθεί).
 */
async function offerCredentialHint(db: Firestore, engagement: ConveyanceEngagement, history: readonly ConveyanceEngagement[]): Promise<CredentialHint | null> {
  if (engagement.state !== 'offered') return null;
  return latestOwnDeclaration(history, legalRoleAuthority(engagement.role))
    ?? contactCredentialHint(db, engagement.hostCompanyId, engagement.origin.contactId, engagement.role);
}

async function cardOf(db: Firestore, engagement: ConveyanceEngagement, verdict: EngagementVerdict, history: readonly ConveyanceEngagement[], acting: ActingViews): Promise<MyCaseCard> {
  const record = await readCaseOf(db, engagement);
  const context = record ? await loadConveyanceSubject(db, record.companyId, record.subject.propertyId) : null;
  const engaged = isEngaged(verdict) && record !== null && context !== null;
  const checklist = engaged ? await engagedChecklist(db, engagement, record, context) : null;
  return {
    kind: 'conveyance_case',
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

/** Ποιος κοιτά τη λίστα, **και από ποιον χώρο** — ο χώρος της σελίδας (`viewedWorkspace`), όχι όπου ανήκει. */
export interface CasesViewer extends ActingViewer {
  readonly viewed: WorkspaceRef;
}

/**
 * Όσες φαίνονται στον χώρο της σελίδας — καθεμία στο **σπίτι** της (`placement`, §15.15: το γραφείο όπου ανήκει
 * ακόμη, αλλιώς ο προσωπικός του). `unknown` ⇒ τουλάχιστον μία δεν μπόρεσε να κριθεί.
 */
export async function shownIn<E extends Engagement>(engagements: readonly E[], viewed: WorkspaceRef, acting: ActingViews): Promise<readonly E[] | 'unknown'> {
  const placed = await Promise.all(engagements.map(async (engagement) => ({ engagement, placement: await acting.placement(engagement) })));
  const shown: E[] = [];
  for (const { engagement, placement } of placed) {
    // Η πρόταση που περιμένει απάντηση φαίνεται παντού — και δεν έχει χώρο, άρα δεν ρωτά ποτέ το βιβλίο.
    if (placement.outcome === 'unknown') return 'unknown';
    if (isShownInWorkspace(engagement, placement.home, viewed)) shown.push(engagement);
  }
  return shown;
}

/** Γιατί η όψη μιας συμμετοχής **δεν** ανοίγει σε αυτόν τον χώρο — ίδια απάντηση για κάθε είδος υπόθεσης. */
export type PlacementRejection =
  | { readonly ok: false; readonly rejection: 'unknown' }
  | { readonly ok: false; readonly rejection: 'elsewhere'; readonly home: WorkspaceRef };

/**
 * §15.15 — **ανοίγει εδώ η όψη;** Το σπίτι είναι το γραφείο όπου ανήκει ΑΚΟΜΗ, αλλιώς ο προσωπικός του: ποτέ
 * ανακατεύθυνση σε χώρο που θα απαντήσει 404. `null` ⇒ ανοίγει εδώ. Ο ΕΝΑΣ έλεγχος για όψη μεταβίβασης και ανάθεσης.
 */
export async function placementRejectionOf(viewer: CasesViewer, engagement: Engagement): Promise<PlacementRejection | null> {
  const placement = await actingViews(viewer).placement(engagement);
  if (placement.outcome === 'unknown') return { ok: false, rejection: 'unknown' };
  if (!isShownInWorkspace(engagement, placement.home, viewer.viewed)) return { ok: false, rejection: 'elsewhere', home: placement.home };
  return null;
}

/**
 * Μία κάρτα **ανά υπόθεση μεταβίβασης** (η τρέχουσα συμμετοχή), νεότερη πρώτη — **όσες φαίνονται στον χώρο της
 * σελίδας**, πάνω σε ιστορικό που διαβάστηκε **ήδη**: η **μία** λίστα «Οι υποθέσεις μου» όλων των ειδών ζει στο
 * `server/engagements/my-engagements.server.ts` (ADR-862 §5.3.11) και ρωτά εδώ μέσω του οικοδεσπότη της μεταβίβασης.
 *
 * 🔑 §15 Γ2 (Α6 · Α47): το **ίδιο** ερώτημα (`uid`) και φίλτρο στη μνήμη (`isShownInWorkspace`). Στον χώρο Χ ⇒ μόνο
 *    όσες ενεργούν για τον Χ· οι προτάσεις που περιμένουν απάντηση ⇒ **παντού**. Το φίλτρο τρέχει **πριν** από την
 *    κάρτα: υπόθεση άλλου χώρου δεν διαβάζεται καν.
 */
export async function listCaseCards(
  db: Firestore,
  viewer: CasesViewer,
  conveyanceHistory: readonly ConveyanceEngagement[],
  nowMs: number,
): Promise<readonly MyCaseCard[] | 'unknown'> {
  const { uid } = viewer;
  const acting = actingViews(viewer);
  const byCase = new Map<string, ConveyanceEngagement[]>();
  for (const e of conveyanceHistory) byCase.set(e.subject.caseId, [...(byCase.get(e.subject.caseId) ?? []), e]);
  const candidates = [...byCase.values()]
    .map((history) => selectCurrentEngagement(history).engagement)
    .filter((e): e is ConveyanceEngagement => e !== null);
  const current = await shownIn(candidates, viewer.viewed, acting);
  // §15.15 — «δεν μπόρεσα να ρωτήσω αν ανήκει ακόμη» ⇒ «δεν φορτώθηκε», ποτέ λίστα που κρύβει σιωπηλά υπόθεση.
  if (current === 'unknown') return 'unknown';
  const cards = await Promise.all(current.map((e) => cardOf(db, e, judge(e, uid, nowMs).verdict, conveyanceHistory, acting)));
  return [...cards].sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));
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
async function planAnswer(own: ConveyanceEngagement, actor: RespondingActor, answer: CaseEngagementAnswer, nowMs: number): Promise<PlannedAnswer> {
  if (answer.decision === 'decline') return { ok: true, transition: { kind: 'decline', byUid: actor.uid } };
  const acting = await resolveActingFor(actor, answer.actingRequest ?? null);
  if (!acting.ok) return { ok: false, rejection: acting.rejection === 'acting-unknown' ? 'unknown' : acting.rejection };
  const declaredCredential = declaredCredentialOf(legalRoleAuthority(own.role), answer.credential, new Date(nowMs).toISOString());
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
  const after = asCaseEngagement(outcome.outcome === 'changed' ? outcome.after : outcome.engagement);
  if (outcome.outcome === 'changed') await recordAnswer(db, actor, record, asCaseEngagement(outcome.before), after);
  return { ok: true, card: await cardOf(db, after, judge(after, actor.uid, nowMs).verdict, [], actingViews(actor)) };
}

/** Ίχνος στο βιβλίο του οικοδεσπότη + ειδοποίηση όποιου πρότεινε. */
async function recordAnswer(db: Firestore, actor: { readonly uid: string; readonly email: string | null }, record: ConveyanceCase, before: ConveyanceEngagement, after: ConveyanceEngagement): Promise<void> {
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
  readonly engagement: ConveyanceEngagement;
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
function engagedFreshUntil(engagement: ConveyanceEngagement, nowMs: number): string {
  const nextDay = nextConveyanceDayStart(new Date(nowMs)).getTime();
  const expiresAt = Date.parse(engagement.expiresAt);
  return new Date(Number.isFinite(expiresAt) && expiresAt > nowMs ? Math.min(nextDay, expiresAt) : nextDay).toISOString();
}

export type EngagedCaseOutcome =
  | { readonly ok: true; readonly view: EngagedCaseView }
  /** §15 Γ2 — η **δική του** υπόθεση, ανοιγμένη σε **λάθος** χώρο: πού ζει (ποτέ 404, ποτέ κάτω από ξένο πρόθεμα). */
  | { readonly ok: false; readonly rejection: 'elsewhere'; readonly home: WorkspaceRef }
  | Extract<EngagedCaseResolution, { ok: false }>;

/** Ποιος ανοίγει τη σελίδα της υπόθεσης, **και από ποιον χώρο** — ίδιος θεατής με τη λίστα (§15.15: το σπίτι ρωτά πού ανήκει). */
export type CaseViewer = CasesViewer;

/**
 * Η υπόθεση μέσω της συμμετοχής — **ποτέ** το ωμό έγγραφο.
 *
 * 🔑 §15 Γ2 — η **θέση** κρίνεται **μετά** την πρόσβαση (`resolveEngagedCase`) και **μόνο εδώ**: είναι ερώτημα της
 *    **σελίδας** («σε ποιο σπίτι ανοίγει;»), όχι του πόρου. Τα αρχεία και το ίχνος περνούν από τον ίδιο δρόμο
 *    πρόσβασης χωρίς να ρωτούν χώρο — ο χώρος **δεν** είναι κριτής πρόσβασης (Α39).
 */
export async function getEngagedCaseView(db: Firestore, viewer: CaseViewer, engagementId: string, nowMs: number): Promise<EngagedCaseOutcome> {
  const { uid } = viewer;
  // §14.8 — η αναθεώρηση ΠΡΙΝ από κάθε ανάγνωση της υπόθεσης (το σήμα ανήκει στη συμμετοχή, όχι στην υπόθεση).
  const revision = await readViewRevision(db, { kind: 'engagement', engagementId, uid });
  const resolution = await resolveEngagedCase(db, uid, engagementId, nowMs);
  if (!resolution.ok) return resolution;
  const misplaced = await placementRejectionOf(viewer, resolution.access.engagement);
  if (misplaced !== null) return misplaced;
  return { ok: true, view: await engagedViewOf(db, resolution.access, revision, nowMs) };
}

/** Η όψη μιας **ήδη κριμένης** πρόσβασης: ό,τι εξαρτάται από τις γραμμές του θεατή διαβάζεται παράλληλα, μετά από αυτές. */
async function engagedViewOf(db: Firestore, access: EngagedCaseAccess, revision: number, nowMs: number): Promise<EngagedCaseView> {
  const { engagement, record, context } = access;
  const state = effectiveCaseState(record.storedState, context.legalPhase);
  const checklist = await engagedChecklistOf(db, access);
  const party = { role: engagement.role, uid: engagement.uid } as const;
  const [participants, documentRequests, parties] = await Promise.all([
    listCaseParticipants(db, engagement, nowMs),
    // Φ4.5 — «Ζήτησε έγγραφο»: ο ΙΔΙΟΣ κριτής με τον γραφέα, πάνω στις γραμμές που ήδη βλέπει.
    documentRequestPanel(db, { record, state, party, rows: checklist.rows, nowMs }),
    // ADR-915 §23.10 — ονόματα ΜΟΝΟ των προσώπων των γραμμών που ήδη βλέπει: η ίδια πύλη κρίνει γραμμή και όνομα.
    readCasePartyLabels(db, engagement.hostCompanyId, visibleSellers(record.parties.sellers, visiblePartyKeys(checklist.rows))),
  ]);
  return {
    kind: 'conveyance_case',
    engagementId: engagement.id,
    role: engagement.role,
    caseId: record.id,
    state,
    propertyName: context.propertyName,
    targetSigningDate: record.targetSigningDate,
    checklist,
    participants,
    parties,
    documentRequests,
    freshness: { revision, freshUntil: engagedFreshUntil(engagement, nowMs) },
  };
}
