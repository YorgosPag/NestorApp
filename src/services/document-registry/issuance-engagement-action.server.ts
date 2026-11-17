/**
 * @fileoverview **Ο ΕΝΑΣ δρόμος** μιας πράξης του μηχανικού πάνω στην ανάθεση έκδοσης, από τον χώρο της συμμετοχής του —
 *   «Αίτημα νέας ημερομηνίας» (ADR-915 §45.20 Φ6γ) · «Έγινε η αυτοψία» (ADR-943 Φ5α).
 * @related issuance-assignments.server.ts (ο ΕΝΑΣ γραφέας) · issuance-engagement-host-adapter.ts (ο ΕΝΑΣ κριτής της συμμετοχής) ·
 *   issuance-delivery-change.service.ts · issuance-advance-start.service.ts (οι καταναλωτές)
 * @module services/document-registry/issuance-engagement-action.server
 *
 * 🔑 **Ποιος**: ο συνδεδεμένος άνθρωπος (`uid` από το token), **μόνο** μέσω **δικής του** συμμετοχής σε ανάθεση έκδοσης.
 *    Ξένη ή άγνωστη συμμετοχή ⇒ `not-found` (ποτέ «υπάρχει αλλά όχι δική σου»).
 * 🔑 **Μία συναλλαγή**: η συμμετοχή ξαναδιαβάζεται και κρίνεται **μέσα** στη συναλλαγή της γραφής — ανάκληση από το
 *    γραφείο ανάμεσα στο κλικ και τη γραφή ⇒ `not-engaged`, ποτέ πράξη από άνθρωπο που δεν συμμετέχει πια.
 * 🔑 **Ο ίδιος γραφέας και ο ίδιος μειωτής** με το γραφείο (`stageIssuanceAction`, actor `engagement`): ο μειωτής κρίνει
 *    ποιες πράξεις επιτρέπονται στη συμμετοχή. Το νεότερο έγγραφο και η ετικέτα του ακινήτου από τον **ίδιο** αναγνώστη με
 *    την οθόνη.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { isEngaged } from '@/lib/auth/engagement-judge';
import { engagementRef } from '@/lib/auth/engagement-ref';
import { parseEngagement } from '@/lib/auth/engagement-schema';
import { issuanceKeyOf, type IssuanceAction, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { isIssuanceEngagement, type IssuanceEngagement } from '@/types/engagement';

import { readDocumentRegistry } from './document-registry.service';
import type { DocumentRegistryResponse } from './document-registry.types';
import { issuanceAssignmentIdOf, type DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { stageIssuanceAction, type IssuanceWrite, type IssuanceWriteOutcome, type StagedIssuanceWrite } from './issuance-assignments.server';
import { judgeIssuanceEngagement, ownIssuanceEngagement, readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';

export interface EngagementIssuanceActionInput {
  readonly uid: string;
  readonly name: string | null;
  readonly engagementId: string;
  /** Το στάδιο που **είδε** ο μηχανικός (CAS, όπως το γραφείο). */
  readonly expectedStage: IssuanceStage | null;
  readonly action: IssuanceAction;
  readonly now: Date;
}

/**
 * - `not-found`   — η συμμετοχή δεν είναι δική του / δεν είναι ανάθεσης / η ανάθεση δεν υπάρχει
 * - `not-engaged` — η συμμετοχή δεν είναι (πια) ενεργή
 * - `unavailable` — δεν μπορέσαμε να ρωτήσουμε (ποτέ «δεν συμμετέχεις»)
 * - `stale` · `transition-refused` · `terms-refused` · `actor-refused` · … — από τον γραφέα / τον μειωτή
 */
export type EngagementIssuanceRefusal = 'not-found' | 'not-engaged' | 'unavailable' | Extract<IssuanceWriteOutcome, { ok: false }>['refusal'];

/** Η ανάθεση και ο κατάλογος όπως τα διάβασε η πράξη — για τις ειδοποιήσεις του καταναλωτή, χωρίς δεύτερη ανάγνωση. */
export interface EngagementIssuanceWritten {
  readonly ok: true;
  readonly outcome: Extract<IssuanceWriteOutcome, { ok: true }>;
  readonly assignment: DocumentIssuanceAssignment;
  readonly registry: DocumentRegistryResponse;
  readonly companyId: string;
}

export type EngagementIssuanceResult = EngagementIssuanceWritten | { readonly ok: false; readonly refusal: EngagementIssuanceRefusal };

const refused = (refusal: EngagementIssuanceRefusal): EngagementIssuanceResult => ({ ok: false, refusal });

/** Η συμμετοχή **μέσα** στη συναλλαγή: ίδια, δική του, και ενεργή **τώρα**. */
function stillEngaged(raw: unknown, expected: IssuanceEngagement, uid: string, nowMs: number): boolean {
  const fresh = parseEngagement(raw);
  if (fresh === null || !isIssuanceEngagement(fresh) || fresh.uid !== uid) return false;
  if (fresh.subject.assignmentId !== expected.subject.assignmentId) return false;
  return isEngaged(judgeIssuanceEngagement(fresh, uid, nowMs).verdict);
}

/** Η γραφή σε **μία** συναλλαγή: πρώτα η συμμετοχή (ανάγνωση), μετά ο γραφέας (ανάγνωση → κρίση → εγγραφή). */
function writeInTransaction(db: Firestore, input: EngagementIssuanceActionInput, engagement: IssuanceEngagement, write: IssuanceWrite): Promise<StagedIssuanceWrite | 'not-engaged'> {
  const key = { hostCompanyId: engagement.hostCompanyId, projectId: engagement.projectId, engagementId: engagement.id };
  return db.runTransaction(async (tx) => {
    if (!stillEngaged((await tx.get(engagementRef(db, key))).data(), engagement, input.uid, input.now.getTime())) return 'not-engaged' as const;
    const next = await stageIssuanceAction(tx, db, write);
    next.commit();
    return next;
  });
}

/** **Η πράξη του μηχανικού** — βλ. κεφαλίδα. Ίχνος μετά την επιτυχία της συναλλαγής. */
export async function writeEngagementIssuanceAction(db: Firestore, input: EngagementIssuanceActionInput): Promise<EngagementIssuanceResult> {
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
  const staged = await writeInTransaction(db, input, engagement, {
    companyId,
    writer: { kind: 'engagement', engagementId: engagement.id, uid: input.uid, name: input.name, expectedStage: input.expectedStage },
    property: { id: assignment.propertyId, scope: label.scope, name: label.name },
    documentKind: assignment.documentKind,
    latestIssuedOn: issuance.latestIssuedOn,
    action: input.action,
    names: {},
    nowIso: input.now.toISOString(),
  });
  if (staged === 'not-engaged') return refused('not-engaged');
  await staged.audit();
  const { outcome } = staged;
  return outcome.ok ? { ok: true, outcome, assignment, registry, companyId } : refused(outcome.refusal);
}
