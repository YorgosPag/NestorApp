/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας του σταδίου ευκαιρίας** (ADR-929).
 * @module services/crm/opportunity-stage-transition.server
 *
 * 🔑 **Σύγκρουση κατά ΠΕΔΙΟ, όχι κατά έγγραφο**: ο καλών λέει «τη μετακινώ ΑΠΟ το στάδιο Χ» (`expectedStage`). Αν
 *    στο μεταξύ άλλος τη μετακίνησε ⇒ `conflict` με το πραγματικό στάδιο και ποιος την άλλαξε. Μια άσχετη αλλαγή
 *    (σημείωση, τηλέφωνο) **δεν** ακυρώνει τη μετακίνηση — όπως θα έκανε ένας έλεγχος έκδοσης όλου του εγγράφου. Οι
 *    μεγάλοι CRM κάνουν εδώ last-write-wins: η δεύτερη μετακίνηση σβήνει σιωπηλά την πρώτη.
 * 🔑 Ανάγνωση + έλεγχος + εγγραφή σε **μία** συναλλαγή ⇒ καμία φυλή ανάμεσα σε δύο συρσίματα.
 * 🔑 Το `_v` ανεβαίνει (`versionedWrite`), ώστε κάθε γραφέας με έλεγχο έκδοσης να βλέπει την αλλαγή.
 * 🔑 Ιστορικό **μετά** το commit (`recordEntityUpdate`, δηλωμένος γραφέας του CHECK 3.17)· δεν πετά ποτέ.
 * ⚠️ Ο φράχτης μισθωτή (`requireOpportunityInTenant`) είναι ευθύνη του route, **πριν** κληθεί αυτό.
 */

import 'server-only';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isOpportunityStage, type OpportunityStage } from '@/config/crm/opportunity-stages';
import type { AuthContext } from '@/lib/auth';
import { versionedWrite } from '@/lib/firestore/version-check';
import { recordEntityUpdate } from '@/services/audit/record-entity-update';
import {
  planStageTransition,
  type StageTransitionInvalidReason,
  type StageTransitionRequest,
} from './opportunity-stage-transition';

export interface StageTransitionWrite {
  readonly opportunityId: string;
  /** Το στάδιο που **είδε** ο άνθρωπος όταν ξεκίνησε τη μετακίνηση. */
  readonly expectedStage: OpportunityStage;
  readonly request: StageTransitionRequest;
  readonly ctx: AuthContext;
  readonly nowIso: string;
}

export type StageTransitionOutcome =
  | { readonly kind: 'unchanged'; readonly stage: OpportunityStage }
  | { readonly kind: 'applied'; readonly stage: OpportunityStage; readonly previousStage: OpportunityStage; readonly reopened: boolean }
  | { readonly kind: 'conflict'; readonly currentStage: string | null; readonly updatedBy: string | null }
  | { readonly kind: 'invalid'; readonly reason: StageTransitionInvalidReason };

interface Committed {
  readonly outcome: StageTransitionOutcome;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly written?: Readonly<Record<string, unknown>>;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

async function commitTransition(db: Firestore, write: StageTransitionWrite): Promise<Committed> {
  const ref = db.collection(COLLECTIONS.OPPORTUNITIES).doc(write.opportunityId);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const before: Readonly<Record<string, unknown>> = snapshot.data() ?? {};
    const current = before.stage;
    if (!isOpportunityStage(current) || current !== write.expectedStage) {
      return { outcome: { kind: 'conflict', currentStage: textOrNull(current), updatedBy: textOrNull(before.updatedBy) } };
    }
    const reopenCount = typeof before.reopenCount === 'number' ? before.reopenCount : 0;
    const plan = planStageTransition({ stage: current, reopenCount }, write.request, write.nowIso);
    if (plan.kind !== 'apply') {
      return { outcome: plan.kind === 'invalid' ? plan : { kind: 'unchanged', stage: current } };
    }
    const deletes = Object.fromEntries(plan.clear.map((field) => [field, FieldValue.delete()]));
    tx.update(ref, versionedWrite(before, { ...plan.set, ...deletes }, write.ctx.uid).data);
    const cleared = Object.fromEntries(plan.clear.map((field) => [field, null]));
    return {
      outcome: { kind: 'applied', stage: plan.target, previousStage: current, reopened: plan.reopened },
      before,
      written: { ...plan.set, ...cleared },
    };
  });
}

/** Μετακινεί την ευκαιρία στο στάδιο του αιτήματος — ή λέει γιατί όχι. */
export async function applyOpportunityStageTransition(
  db: Firestore,
  write: StageTransitionWrite,
): Promise<StageTransitionOutcome> {
  const committed = await commitTransition(db, write);
  if (committed.outcome.kind === 'applied' && committed.before && committed.written) {
    await recordEntityUpdate({
      entityType: 'opportunity',
      entityId: write.opportunityId,
      before: committed.before,
      written: committed.written,
      ctx: write.ctx,
      entityName: textOrNull(committed.before.title),
      action: 'status_changed',
    });
  }
  return committed.outcome;
}
