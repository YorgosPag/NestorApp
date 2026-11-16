/**
 * @fileoverview ADR-915 §45.20 Φ6γ — **η πράξη του μηχανικού** «Αίτημα νέας ημερομηνίας», από τον χώρο της συμμετοχής του.
 * @related lib/document-validity/issuance-delivery-change.ts (η κρίση) · issuance-assignments.server.ts (ο ΕΝΑΣ γραφέας) ·
 *   issuance-engagement-host-adapter.ts (ο ΕΝΑΣ κριτής της συμμετοχής) · app/api/engagements/[engagementId]/issuance/delivery-change
 * @module services/document-registry/issuance-delivery-change.service
 *
 * 🔑 **Ποιος**: ο συνδεδεμένος άνθρωπος (`uid` από το token), **μόνο** μέσω **δικής του** συμμετοχής σε ανάθεση έκδοσης.
 *    Ξένη ή άγνωστη συμμετοχή ⇒ `not-found` (ποτέ «υπάρχει αλλά όχι δική σου»).
 * 🔑 **Μία συναλλαγή**: η συμμετοχή ξαναδιαβάζεται και κρίνεται **μέσα** στη συναλλαγή της γραφής — ανάκληση από το
 *    γραφείο ανάμεσα στο κλικ και τη γραφή ⇒ `not-engaged`, ποτέ αίτημα από άνθρωπο που δεν συμμετέχει πια.
 * 🔑 **Ο ίδιος γραφέας και ο ίδιος μειωτής** με το γραφείο (`stageIssuanceAction`, actor `engagement`): ο μειωτής του
 *    επιτρέπει **μόνο** το αίτημα. Το νεότερο έγγραφο και η ετικέτα του ακινήτου από τον **ίδιο** αναγνώστη με την οθόνη.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { isEngaged } from '@/lib/auth/engagement-judge';
import { engagementRef } from '@/lib/auth/engagement-ref';
import { parseEngagement } from '@/lib/auth/engagement-schema';
import { issuanceKeyOf, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { deliveryChangeTransitionAt } from '@/lib/document-validity/issuance-delivery-change';
import { announceDeliveryChange } from '@/server/issuance-invitations/issuance-delivery-change-notifier';
import { isIssuanceEngagement, type IssuanceEngagement } from '@/types/engagement';
import { readDocumentRegistry } from './document-registry.service';
import { issuanceAssignmentIdOf } from './issuance-assignment-schema';
import { stageIssuanceAction, type IssuanceWrite, type IssuanceWriteOutcome, type StagedIssuanceWrite } from './issuance-assignments.server';
import { judgeIssuanceEngagement, ownIssuanceEngagement, readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';

export interface DeliveryChangeRequestInput {
  readonly uid: string;
  readonly name: string | null;
  readonly engagementId: string;
  readonly dueOn: string;
  readonly reason: string;
  /** Το στάδιο που **είδε** ο μηχανικός (CAS, όπως το γραφείο). */
  readonly expectedStage: IssuanceStage | null;
  readonly now: Date;
}

/**
 * - `not-found`   — η συμμετοχή δεν είναι δική του / δεν είναι ανάθεσης / η ανάθεση δεν υπάρχει
 * - `not-engaged` — η συμμετοχή δεν είναι (πια) ενεργή
 * - `unavailable` — δεν μπορέσαμε να ρωτήσουμε (ποτέ «δεν συμμετέχεις»)
 * - `stale` · `transition-refused` · `terms-refused` · `actor-refused` — από τον γραφέα / τον μειωτή
 */
export type DeliveryChangeRefusal = 'not-found' | 'not-engaged' | 'unavailable' | Extract<IssuanceWriteOutcome, { ok: false }>['refusal'];

export type DeliveryChangeResult =
  | { readonly ok: true; readonly outcome: 'changed' | 'unchanged' }
  | { readonly ok: false; readonly refusal: DeliveryChangeRefusal };

const refused = (refusal: DeliveryChangeRefusal): DeliveryChangeResult => ({ ok: false, refusal });

/** Η συμμετοχή **μέσα** στη συναλλαγή: ίδια, δική του, και ενεργή **τώρα**. */
function stillEngaged(raw: unknown, expected: IssuanceEngagement, uid: string, nowMs: number): boolean {
  const fresh = parseEngagement(raw);
  if (fresh === null || !isIssuanceEngagement(fresh) || fresh.uid !== uid) return false;
  if (fresh.subject.assignmentId !== expected.subject.assignmentId) return false;
  return isEngaged(judgeIssuanceEngagement(fresh, uid, nowMs).verdict);
}

/** Η γραφή σε **μία** συναλλαγή: πρώτα η συμμετοχή (ανάγνωση), μετά ο γραφέας (ανάγνωση → κρίση → εγγραφή). */
function writeRequest(db: Firestore, input: DeliveryChangeRequestInput, engagement: IssuanceEngagement, write: IssuanceWrite): Promise<StagedIssuanceWrite | 'not-engaged'> {
  const key = { hostCompanyId: engagement.hostCompanyId, projectId: engagement.projectId, engagementId: engagement.id };
  return db.runTransaction(async (tx) => {
    if (!stillEngaged((await tx.get(engagementRef(db, key))).data(), engagement, input.uid, input.now.getTime())) return 'not-engaged' as const;
    const next = await stageIssuanceAction(tx, db, write);
    next.commit();
    return next;
  });
}

export async function requestIssuanceDeliveryChange(db: Firestore, input: DeliveryChangeRequestInput): Promise<DeliveryChangeResult> {
  const engagement = await ownIssuanceEngagement(db, input.uid, input.engagementId);
  if (engagement === 'unknown') return refused('unavailable');
  if (engagement === null) return refused('not-found');
  const companyId = engagement.hostCompanyId;
  const assignment = await readHostedIssuanceAssignment(db, companyId, engagement.subject.assignmentId);
  if (assignment === null || issuanceAssignmentIdOf(companyId, assignment.propertyId, assignment.documentKind) !== assignment.id) return refused('not-found');
  const registry = await readDocumentRegistry(db, companyId, input.now);
  const issuance = registry.issuance[issuanceKeyOf(assignment.propertyId, assignment.documentKind)];
  const label = registry.properties[assignment.propertyId];
  if (!registry.issuanceKnown) return refused('unavailable');
  if (issuance === undefined || label === undefined) return refused('not-found');
  const nowIso = input.now.toISOString();
  const staged = await writeRequest(db, input, engagement, {
    companyId,
    writer: { kind: 'engagement', engagementId: engagement.id, uid: input.uid, name: input.name, expectedStage: input.expectedStage },
    property: { id: assignment.propertyId, scope: label.scope, name: label.name },
    documentKind: assignment.documentKind,
    latestIssuedOn: issuance.latestIssuedOn,
    action: { kind: 'request-delivery-change', dueOn: input.dueOn, reason: input.reason },
    names: {},
    nowIso,
  });
  if (staged === 'not-engaged') return refused('not-engaged');
  await staged.audit();
  const { outcome } = staged;
  if (!outcome.ok) return refused(outcome.refusal);
  if (outcome.outcome === 'changed') {
    await announceDeliveryChange(db, {
      assignmentId: assignment.id, companyId, propertyId: assignment.propertyId, documentKind: assignment.documentKind,
      record: outcome.record, registry, now: input.now,
    }, deliveryChangeTransitionAt(outcome.record, nowIso));
  }
  return { ok: true, outcome: outcome.outcome };
}
