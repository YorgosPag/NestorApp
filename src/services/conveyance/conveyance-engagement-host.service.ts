/**
 * =============================================================================
 * Οι επαγγελματίες της υπόθεσης — η πλευρά του ΟΙΚΟΔΕΣΠΟΤΗ (ADR-901 Φ2 · ADR-862 Φ1)
 * =============================================================================
 *
 * - `listCaseProfessionalSlots` — οι τρεις θέσεις: ποιος ορίστηκε, έχει λογαριασμό, πού είναι η συμμετοχή
 * - `offerCaseEngagement`       — πρόταση πρόσβασης (Procore «Save & Send Notification» + Entra «PendingAcceptance»)
 * - `endCaseEngagement`         — απόσυρση πρότασης / **άμεση** ανάκληση (ADR-787 Ε-2 §5)
 *
 * ⚠️ Ο καλών έχει **ήδη** κρίνει μισθωτή + δικαίωμα (`authorizeForProperty`) πάνω στην υπόθεση που
 *    διάβασε με `readOwnedConveyanceCase`. Εδώ **δεν** ξαναδιαβάζεται χώρος από το αίτημα: ο μισθωτής της
 *    συμμετοχής είναι **ο μισθωτής της υπόθεσης** (ADR-862 §2.3, Κ-3).
 *
 * @module services/conveyance/conveyance-engagement-host.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { planConsents, requiresAttestation } from '@/lib/conveyance/engagement-consent';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { selectCurrentEngagement } from '@/lib/auth/engagement-read';
import { closeEngagementsForSubject, offerEngagement, transitionEngagement } from '@/lib/auth/engagement-write';
import { parseEngagement } from '@/lib/auth/engagement-schema';
import { engagementsCollection, engagementsForSubjectQuery } from '@/lib/auth/engagement-ref';
import { LEGAL_ENGAGEMENT_ROLES, type ConsentBasis, type Engagement } from '@/types/engagement';
import type { CaseProfessionalSlot, ConveyanceCase } from '@/types/conveyance-case';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { resolveCaseProfessional } from './conveyance-professional.server';
import { loadConveyanceSubject } from './conveyance-subject.server';
import { announceEngagementChanged } from './conveyance-engagement-notifier';
import type { ConveyanceActor } from './conveyance-case.service';
import {
  acceptsEngagements,
  caseProjectId,
  caseSubject,
  engagementKeyOf,
  recordEngagementAudit,
  stateChange,
  toEngagementSummary,
} from './conveyance-engagement-support';

// =============================================================================
// ΟΙ ΘΕΣΕΙΣ
// =============================================================================

/** Όλες οι συμμετοχές της υπόθεσης, ομαδοποιημένες ανά ρόλο (μη αναγνώσιμες παραλείπονται — δεν δίνουν πρόσβαση). */
async function engagementsByRole(db: Firestore, record: ConveyanceCase, projectId: string): Promise<Map<LegalProfessionalRole, Engagement[]>> {
  const snapshot = await engagementsForSubjectQuery(engagementsCollection(db, record.companyId, projectId), caseSubject(record.id)).get();
  const byRole = new Map<LegalProfessionalRole, Engagement[]>();
  for (const engagement of snapshot.docs.map((doc) => parseEngagement(doc.data()))) {
    if (engagement) byRole.set(engagement.role, [...(byRole.get(engagement.role) ?? []), engagement]);
  }
  return byRole;
}

/** Οι τρεις θέσεις της υπόθεσης — **μία** απάντηση για το UI του οικοδεσπότη. */
export async function listCaseProfessionalSlots(db: Firestore, record: ConveyanceCase): Promise<readonly CaseProfessionalSlot[]> {
  const projectId = caseProjectId(record);
  const byRole = projectId ? await engagementsByRole(db, record, projectId) : new Map<LegalProfessionalRole, Engagement[]>();
  return Promise.all(LEGAL_ENGAGEMENT_ROLES.map(async (role): Promise<CaseProfessionalSlot> => {
    const professional = await resolveCaseProfessional(db, record.companyId, record.subject.propertyId, role);
    const current = selectCurrentEngagement(byRole.get(role) ?? []).engagement;
    return {
      role,
      appointment: professional.outcome,
      engagement: current ? toEngagementSummary(current) : null,
      requiresAttestation: requiresAttestation(role),
    };
  }));
}

// =============================================================================
// ΠΡΟΤΑΣΗ
// =============================================================================

export type CaseOfferOutcome =
  | { readonly ok: true; readonly created: boolean; readonly slots: readonly CaseProfessionalSlot[] }
  | { readonly ok: false; readonly rejection: CaseOfferRejection };

export type CaseOfferRejection =
  | 'case-closed'
  | 'no-project'
  | 'not-appointed'
  | 'no-email'
  | 'needs-invitation'
  | 'consent-basis-required'
  | 'slot-occupied'
  | 'role-conflict'
  | 'unreadable';

/** Η υπόθεση δέχεται πρόταση; — **πριν** από κάθε ανάγνωση επαγγελματία. */
async function preflight(db: Firestore, actor: ConveyanceActor, record: ConveyanceCase): Promise<{ projectId: string; propertyName: string | null } | CaseOfferRejection> {
  const context = await loadConveyanceSubject(db, actor.companyId, record.subject.propertyId);
  if (!acceptsEngagements(effectiveCaseState(record.storedState, context?.legalPhase))) return 'case-closed';
  const projectId = caseProjectId(record);
  return projectId ? { projectId, propertyName: context?.propertyName ?? null } : 'no-project';
}

/** **Πρόταση πρόσβασης** στον επαγγελματία της θέσης — ιδεμποτής, με δηλωμένη συναίνεση όπου χρειάζεται. */
export async function offerCaseEngagement(
  db: Firestore,
  actor: ConveyanceActor,
  record: ConveyanceCase,
  input: { readonly role: LegalProfessionalRole; readonly attestedBasis: ConsentBasis | null; readonly nowMs: number },
): Promise<CaseOfferOutcome> {
  const ready = await preflight(db, actor, record);
  if (typeof ready === 'string') return { ok: false, rejection: ready };
  const professional = await resolveCaseProfessional(db, record.companyId, record.subject.propertyId, input.role);
  if (professional.outcome !== 'account') return { ok: false, rejection: professional.outcome };
  const consents = planConsents(input.role, input.attestedBasis, actor.uid, new Date(input.nowMs).toISOString());
  if (!consents.ok) return { ok: false, rejection: consents.rejection };

  const outcome = await offerEngagement(db, {
    hostCompanyId: record.companyId, projectId: ready.projectId, uid: professional.uid, email: professional.email,
    template: 'legal', role: input.role, subject: caseSubject(record.id),
    origin: { kind: 'professional_appointment', contactId: professional.contactId },
    consents: consents.consents, offeredBy: actor.uid, nowMs: input.nowMs,
  });
  if (outcome.outcome === 'slot-occupied' || outcome.outcome === 'role-conflict' || outcome.outcome === 'unreadable') {
    return { ok: false, rejection: outcome.outcome };
  }
  if (outcome.outcome === 'offered') {
    await recordEngagementAudit({ engagement: outcome.engagement, action: 'created', changes: [stateChange(null, outcome.engagement)], performedBy: actor.uid, performedByName: actor.email, entityName: ready.propertyName });
    await announceEngagementChanged(outcome.engagement, ready.propertyName);
  }
  return { ok: true, created: outcome.outcome === 'offered', slots: await listCaseProfessionalSlots(db, record) };
}

// =============================================================================
// ΑΠΟΣΥΡΣΗ / ΑΝΑΚΛΗΣΗ
// =============================================================================

export type CaseEndOutcome =
  | { readonly ok: true; readonly slots: readonly CaseProfessionalSlot[] }
  | { readonly ok: false; readonly rejection: 'not-found' };

/** Τέλος μιας συμμετοχής **αυτής** της υπόθεσης — ξένη συμμετοχή ≡ ανύπαρκτη (ADR-742). */
export async function endCaseEngagement(
  db: Firestore,
  actor: ConveyanceActor,
  record: ConveyanceCase,
  engagementId: string,
  nowMs: number,
): Promise<CaseEndOutcome> {
  const projectId = caseProjectId(record);
  if (!projectId) return { ok: false, rejection: 'not-found' };
  const all = [...(await engagementsByRole(db, record, projectId)).values()].flat();
  const target = all.find((e) => e.id === engagementId);
  if (!target) return { ok: false, rejection: 'not-found' };

  const outcome = await transitionEngagement(db, engagementKeyOf(target), { kind: 'end', byUid: actor.uid }, nowMs);
  if (outcome.outcome === 'changed') {
    const context = await loadConveyanceSubject(db, actor.companyId, record.subject.propertyId);
    const name = context?.propertyName ?? null;
    await recordEngagementAudit({ engagement: outcome.after, action: 'status_changed', changes: [stateChange(outcome.before, outcome.after)], performedBy: actor.uid, performedByName: actor.email, entityName: name });
    await announceEngagementChanged(outcome.after, name);
  }
  return { ok: true, slots: await listCaseProfessionalSlots(db, record) };
}

// =============================================================================
// ΚΛΕΙΣΙΜΟ ΥΠΟΘΕΣΗΣ — η ΚΥΡΙΑ λήξη (ADR-862 §5.3.3)
// =============================================================================

/**
 * Η υπόθεση έκλεισε/ακυρώθηκε ⇒ οι συμμετοχές της **παύουν μόνες τους** (ενεργή ⇒ `completed`, πρόταση ⇒
 * `withdrawn`) — παράγεται από την πράξη, δεν πληκτρολογείται. Ιδεμποτές: δεύτερη κλήση βρίσκει μηδέν ζωντανές.
 * Κάθε αλλαγή γράφει ίχνος και **λέγεται** στον επαγγελματία.
 */
export async function closeCaseEngagements(
  db: Firestore,
  actor: ConveyanceActor,
  record: ConveyanceCase,
  propertyName: string | null,
  nowMs: number,
): Promise<void> {
  const projectId = caseProjectId(record);
  // Η αποθηκευμένη κατάσταση είναι υποσύνολο της εμφανιζόμενης — `closed`/`cancelled` είναι ΜΟΝΟ ρητές πράξεις.
  if (!projectId || acceptsEngagements(record.storedState)) return;
  const closed = await closeEngagementsForSubject(db, { hostCompanyId: record.companyId, projectId }, caseSubject(record.id), actor.uid, nowMs);
  await Promise.all(closed.map(async (after) => {
    await recordEngagementAudit({ engagement: after, action: 'status_changed', changes: [{ field: 'state', oldValue: after.state === 'completed' ? 'active' : 'offered', newValue: after.state }], performedBy: actor.uid, performedByName: actor.email, entityName: propertyName });
    await announceEngagementChanged(after, propertyName);
  }));
}
