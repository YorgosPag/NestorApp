/**
 * ADR-901 Φ2 — τα κοινά των δύο πλευρών της συμμετοχής σε υπόθεση μεταβίβασης (οικοδεσπότης ·
 * επαγγελματίας): η ταυτότητα της υπόθεσης ως «subject», το κλειδί, η προβολή και το ίχνος.
 * **Ένα** σημείο, ώστε οι δύο υπηρεσίες να μη διαφωνήσουν για το τι είναι «η υπόθεση».
 *
 * @module services/conveyance/conveyance-engagement-support
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { actingWorkspaceOf } from '@/lib/auth/acting-workspace';
import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import { engagementsCollection, engagementsForSubjectQuery } from '@/lib/auth/engagement-ref';
import { parseEngagement } from '@/lib/auth/engagement-schema';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { CaseEngagementSummary, ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement, EngagementKey, EngagementSubject } from '@/types/engagement';

/** Η υπόθεση ως αντικείμενο συμμετοχής. */
export function caseSubject(caseId: string): EngagementSubject {
  return { kind: 'conveyance_case', caseId };
}

/** Το έργο της υπόθεσης — **το** σημείο όπου ζουν οι συμμετοχές της (ADR-862 §5.3.1). */
export function caseProjectId(record: ConveyanceCase): string | null {
  return record.subject.projectId;
}

/**
 * **Όλες** οι συμμετοχές μιας υπόθεσης (κάθε κατάστασης). Οι μη αναγνώσιμες παραλείπονται, γιατί δεν δίνουν
 * πρόσβαση. Είναι η ΜΙΑ ανάγνωση για τον οικοδεσπότη (θέσεις), τους «Συμμετέχοντες» και τις ειδοποιήσεις λήξεων.
 */
export async function listCaseEngagements(db: Firestore, hostCompanyId: string, projectId: string, caseId: string): Promise<Engagement[]> {
  const snapshot = await engagementsForSubjectQuery(engagementsCollection(db, hostCompanyId, projectId), caseSubject(caseId)).get();
  return snapshot.docs.map((doc) => parseEngagement(doc.data())).filter((e): e is Engagement => e !== null);
}

/** Ενεργή **τώρα**: `active` **και** δεκτή από τον ΕΝΑ κριτή (λήξη · ανάκληση · εύρος) — όχι μόνο το πεδίο `state`. */
export function engagedNow(engagement: Engagement, nowMs: number): boolean {
  if (engagement.state !== 'active') return false;
  return isEngaged(decideEngagement({ engagement, uid: engagement.uid, subject: engagement.subject, scope: 'conveyance:case:view', nowMs }).verdict);
}

/** Οι συμμετοχές της υπόθεσης που είναι ενεργές **τώρα** (λήξεις · συντάκτες transmittal · παραλήπτες). */
export async function activeCaseEngagements(db: Firestore, record: ConveyanceCase, nowMs: number): Promise<Engagement[]> {
  const projectId = caseProjectId(record);
  if (!projectId) return [];
  return (await listCaseEngagements(db, record.companyId, projectId, record.id)).filter((e) => engagedNow(e, nowMs));
}

/** Ο οικοδεσπότης ως **παραλήπτες**: ο δημιουργός της υπόθεσης **και** οι ενεργοί διαχειριστές του χώρου, χωρίς διπλά. */
export async function caseHostRecipients(db: Firestore, record: ConveyanceCase): Promise<string[]> {
  return [...new Set([record.createdBy, ...(await activeWorkspaceAdministrators(db, record.companyId))])];
}

/** Το κλειδί μιας συμμετοχής **από την ίδια** — ποτέ από το αίτημα. */
export function engagementKeyOf(engagement: Engagement): EngagementKey {
  return { hostCompanyId: engagement.hostCompanyId, projectId: engagement.projectId, engagementId: engagement.id };
}

/** Η προβολή για τον οικοδεσπότη — ρητά πεδία, ποτέ spread του εγγράφου. */
export function toEngagementSummary(engagement: Engagement): CaseEngagementSummary {
  return {
    engagementId: engagement.id,
    role: engagement.role,
    state: engagement.state,
    email: engagement.email,
    offeredAt: engagement.offeredAt,
    respondedAt: engagement.respondedAt,
    closedAt: engagement.closedAt,
    expiresAt: engagement.expiresAt,
    consents: engagement.consents,
    declaredCredential: engagement.declaredCredential ?? null,
  };
}

/**
 * Ίχνος στο βιβλίο του **οικοδεσπότη** (ADR-195 · ADR-862 §5.7): ποιος μπήκε, ποιος αποδέχτηκε, ποιος
 * ανακλήθηκε — με τον **δρώντα** (οικοδεσπότης ή επαγγελματίας) ως `performedBy`.
 */
export async function recordEngagementAudit(params: {
  readonly engagement: Engagement;
  readonly action: AuditAction;
  readonly changes: readonly AuditFieldChange[];
  readonly performedBy: string;
  readonly performedByName: string | null;
  readonly entityName: string | null;
}): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'engagement',
    entityId: params.engagement.id,
    entityName: params.entityName,
    action: params.action,
    changes: [...params.changes],
    performedBy: params.performedBy,
    performedByName: params.performedByName,
    companyId: params.engagement.hostCompanyId,
  });
}

/** Η αλλαγή κατάστασης ως πεδίο ίχνους. */
export function stateChange(before: Engagement | null, after: Engagement): AuditFieldChange {
  return { field: 'state', oldValue: before?.state ?? null, newValue: after.state };
}

/**
 * Οι αλλαγές μιας **απάντησης** (αποδοχή/άρνηση) ως πεδία ίχνους: η κατάσταση **και** η δήλωση ιδιότητας που
 * δόθηκε μαζί της (Ε-4). Είναι **ένα** σημείο για τις δύο διαδρομές (πρόσκληση · πρόταση), ώστε το ίχνος να
 * μη διαφέρει ανάλογα με το πώς ήρθε ο επαγγελματίας.
 */
export function answerChanges(before: Engagement | null, after: Engagement): AuditFieldChange[] {
  const credential = after.declaredCredential;
  if (!credential || before?.declaredCredential === credential) return [stateChange(before, after)];
  const declared = credential.chapter ? `${credential.number} · ${credential.chapter}` : credential.number;
  return [
    stateChange(before, after),
    { field: 'declaredCredential', oldValue: null, newValue: declared },
    actingForChange(after),
  ];
}

/**
 * ADR-901 §15 (Γ1) — **για λογαριασμό ποιου χώρου** ανέλαβε, ως πεδίο ίχνους στο βιβλίο του οικοδεσπότη. Γράφεται
 * **μαζί** με τη δήλωση ιδιότητας (η αποδοχή φέρει και τα δύο)· η τιμή είναι το **αναγνωριστικό** του γραφείου, ή
 * `personal` για τον προσωπικό χώρο **του ίδιου** — σταθερή, ποτέ όνομα που θα πάλιωνε (το λύνει η οθόνη).
 * ⛔ Όχι `workspaceRefKey`: εκείνο είναι κλειδί προβολής και απαγορεύεται ρητά σε έγγραφο.
 */
function actingForChange(after: Engagement): AuditFieldChange {
  const workspace = actingWorkspaceOf(after);
  return { field: 'actingFor', oldValue: null, newValue: workspace.kind === 'org' ? workspace.companyId : workspace.kind };
}
