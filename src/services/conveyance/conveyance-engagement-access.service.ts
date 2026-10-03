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
import { transitionEngagement } from '@/lib/auth/engagement-write';
import { deriveCaseChecklist } from '@/lib/conveyance/case-checklist';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { deriveFacts } from '@/lib/conveyance/derive-facts';
import type { ConveyanceCase, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import type { Engagement, EngagementDecision, EngagementVerdict } from '@/types/engagement';
import { collectConveyanceEvidence } from './conveyance-evidence.server';
import { loadConveyanceSubject, type ConveyanceSubjectContext } from './conveyance-subject.server';
import { announceEngagementAnswered } from './conveyance-engagement-notifier';
import { engagementKeyOf, recordEngagementAudit, stateChange } from './conveyance-engagement-support';

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

/** Ο κατάλογος όπως τον βλέπει **αυτός ο ρόλος**, πάνω σε τεκμήρια που φτάνει **αυτό το πρότυπο**. */
async function engagedChecklist(db: Firestore, engagement: Engagement, record: ConveyanceCase, context: ConveyanceSubjectContext) {
  const evidence = await collectConveyanceEvidence(db, record.companyId, record.subject, record.parties, engagement.template);
  return deriveCaseChecklist({
    record,
    derivedFacts: deriveFacts(context.factSources),
    evidence,
    today: conveyanceToday(),
    viewer: engagement.role,
  });
}

// =============================================================================
// «ΟΙ ΥΠΟΘΕΣΕΙΣ ΜΟΥ»
// =============================================================================

async function cardOf(db: Firestore, engagement: Engagement, verdict: EngagementVerdict): Promise<MyCaseCard> {
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
    targetSigningDate: engaged ? record.targetSigningDate : null,
  };
}

export type MyCasesOutcome = { readonly ok: true; readonly cards: readonly MyCaseCard[] } | { readonly ok: false };

/** Μία κάρτα **ανά υπόθεση** (η τρέχουσα συμμετοχή), νεότερη πρώτη. */
export async function listMyCases(db: Firestore, uid: string, nowMs: number): Promise<MyCasesOutcome> {
  const list = await listEngagementsOfUser(db, uid);
  if (list.outcome === 'unknown') return { ok: false };
  const byCase = new Map<string, Engagement[]>();
  for (const e of list.engagements) byCase.set(e.subject.caseId, [...(byCase.get(e.subject.caseId) ?? []), e]);
  const current = [...byCase.values()]
    .map((history) => selectCurrentEngagement(history).engagement)
    .filter((e): e is Engagement => e !== null);
  const cards = await Promise.all(current.map((e) => cardOf(db, e, judge(e, uid, nowMs).verdict)));
  return { ok: true, cards: [...cards].sort((a, b) => b.offeredAt.localeCompare(a.offeredAt)) };
}

// =============================================================================
// ΑΠΑΝΤΗΣΗ
// =============================================================================

export type RespondOutcome =
  | { readonly ok: true; readonly card: MyCaseCard }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' | 'offer-expired' | 'not-allowed' };

/** «Αναλαμβάνω» / «Δεν αναλαμβάνω» — **μόνο** ο ίδιος, **μόνο** σε πρόταση. Ιδεμποτές. */
export async function respondToCaseEngagement(
  db: Firestore,
  actor: { readonly uid: string; readonly email: string | null },
  engagementId: string,
  accept: boolean,
  nowMs: number,
): Promise<RespondOutcome> {
  const own = await findOwnEngagement(db, actor.uid, engagementId);
  if (own === 'unknown') return { ok: false, rejection: 'unknown' };
  if (!own) return { ok: false, rejection: 'not-found' };
  const outcome = await transitionEngagement(db, engagementKeyOf(own), { kind: accept ? 'accept' : 'decline', byUid: actor.uid }, nowMs);
  if (outcome.outcome === 'not-found') return { ok: false, rejection: 'not-found' };
  if (outcome.outcome === 'not-allowed' || outcome.outcome === 'offer-expired') return { ok: false, rejection: outcome.outcome };
  const after = outcome.outcome === 'changed' ? outcome.after : outcome.engagement;
  if (outcome.outcome === 'changed') await recordAnswer(db, actor, outcome.before, after);
  return { ok: true, card: await cardOf(db, after, judge(after, actor.uid, nowMs).verdict) };
}

/** Ίχνος στο βιβλίο του οικοδεσπότη + ειδοποίηση όποιου πρότεινε. */
async function recordAnswer(db: Firestore, actor: { readonly uid: string; readonly email: string | null }, before: Engagement, after: Engagement): Promise<void> {
  const record = await readCaseOf(db, after);
  const context = record ? await loadConveyanceSubject(db, record.companyId, record.subject.propertyId) : null;
  const name = context?.propertyName ?? null;
  await recordEngagementAudit({ engagement: after, action: 'status_changed', changes: [stateChange(before, after)], performedBy: actor.uid, performedByName: actor.email, entityName: name });
  if (record) await announceEngagementAnswered(after, record.subject.propertyId, name);
}

// =============================================================================
// Η ΥΠΟΘΕΣΗ
// =============================================================================

export type EngagedCaseOutcome =
  | { readonly ok: true; readonly view: EngagedCaseView }
  /** Η **δική του** συμμετοχή, χωρίς πρόσβαση τώρα — ονομασμένος λόγος (offered · revoked · expired · …). */
  | { readonly ok: false; readonly rejection: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' };

/** Η υπόθεση μέσω της συμμετοχής — **ποτέ** το ωμό έγγραφο. */
export async function getEngagedCaseView(db: Firestore, uid: string, engagementId: string, nowMs: number): Promise<EngagedCaseOutcome> {
  const own = await findOwnEngagement(db, uid, engagementId);
  if (own === 'unknown') return { ok: false, rejection: 'unknown' };
  if (!own) return { ok: false, rejection: 'not-found' };
  const decision = judge(own, uid, nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const record = await readCaseOf(db, own);
  const context = record ? await loadConveyanceSubject(db, record.companyId, record.subject.propertyId) : null;
  if (!record || !context) return { ok: false, rejection: 'not-found' };
  return {
    ok: true,
    view: {
      engagementId: own.id,
      role: own.role,
      caseId: record.id,
      state: effectiveCaseState(record.storedState, context.legalPhase),
      propertyName: context.propertyName,
      targetSigningDate: record.targetSigningDate,
      checklist: await engagedChecklist(db, own, record, context),
    },
  };
}
