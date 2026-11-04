import 'server-only';

/**
 * Ο γραφέας της **διακυβέρνησης** εκδόσεων ρήτρας (ADR-928 §5.2.1) — έγκριση · απόρριψη · απόσυρση · επαγγελματικός
 * έλεγχος · αρχειοθέτηση. Οι **κανόνες** ζουν στην καθαρή μηχανή (`clause-governance.ts`)· εδώ η ανάγνωση, ο CAS και η
 * εγγραφή. Το **δικαίωμα** (`manage` · `propose`) το κρίνει το σύνορο της διαδρομής (CHECK 3.68).
 *
 * 🔑 Η έγκριση είναι **μία** συναλλαγή τριών εγγράφων: η νέα γίνεται `approved`, η προηγούμενη `superseded` (με
 * `supersededBy`), η ρήτρα δείχνει τη νέα. Ποτέ δύο εγκεκριμένες, ποτέ ρήτρα που δείχνει σε μη εγκεκριμένη.
 * @module server/subcontracts/clause-governance-writer.server
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { AuthContext } from '@/lib/auth';
import { todayLocalDate } from '@/lib/date-local';
import { generateDeterministicSubcontractClauseVersionId } from '@/services/enterprise-id.service';
import {
  refuseApproval,
  refuseRejection,
  refuseReviewMark,
  refuseWithdrawal,
  type ClauseGovernanceRefusal,
} from '@/subapps/procurement/subcontracts/clauses/clause-governance';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import {
  assertRevision,
  clauseDocRef,
  clauseVersionDocRef,
  readOwned,
  runSubcontractTransaction,
  stageUpdate,
  type SubcontractTx,
} from './subcontract-store.server';
import { assertGovernance } from './subcontract-write-error';

/** Η διεύθυνση μιας έκδοσης και η αναθεώρηση που διάβασε ο πελάτης (CAS). */
export interface VersionTarget {
  readonly clauseId: string;
  readonly version: number;
  readonly expectedRevision: number;
}

const versionRefOf = (scope: SubcontractTx, clauseId: string, version: number) =>
  clauseVersionDocRef(scope.db, clauseId, generateDeterministicSubcontractClauseVersionId(clauseId, version));

/** Ρήτρα + έκδοση, με CAS στην έκδοση — οι αναγνώσεις κάθε πράξης. */
async function readTarget(scope: SubcontractTx, target: VersionTarget): Promise<{ clause: SubcontractClause; version: SubcontractClauseVersion }> {
  const clause = await readOwned(scope, 'clause', clauseDocRef(scope.db, target.clauseId));
  const version = await readOwned(scope, 'clauseVersion', versionRefOf(scope, target.clauseId, target.version));
  assertRevision(version, target.expectedRevision);
  return { clause, version };
}

export interface ApproveInput {
  readonly effectiveFrom: CalendarDay | null;
  readonly reason: string | null;
}

export async function approveSubcontractClauseVersion(ctx: AuthContext, target: VersionTarget, input: ApproveInput): Promise<SubcontractClauseVersion> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const { clause, version } = await readTarget(scope, target);
    assertGovernance(refuseApproval(version, ctx.uid));
    const previous = clause.currentVersion === null ? null : await readOwned(scope, 'clauseVersion', versionRefOf(scope, clause.id, clause.currentVersion));
    if (previous) stageUpdate(scope, 'clauseVersion', versionRefOf(scope, clause.id, previous.version), previous, { state: 'superseded', supersededBy: version.version });
    stageUpdate(scope, 'clause', clauseDocRef(scope.db, clause.id), clause, { currentVersion: version.version, openProposal: null });
    return stageUpdate(scope, 'clauseVersion', versionRefOf(scope, clause.id, version.version), version, {
      state: 'approved',
      effectiveFrom: input.effectiveFrom ?? todayLocalDate(),
      decidedBy: ctx.uid,
      decidedAt: scope.now,
      decisionReason: input.reason,
    });
  });
}

/**
 * Η πρόταση γίνεται `rejected` — **μόνο** η έκδοση· το `openProposal` της ρήτρας το γράφει ο καλών, ώστε μία συναλλαγή να
 * ενημερώνει τη ρήτρα **μία** φορά (η σπορά την ξαναγράφει αμέσως με τη διάδοχη, §5.20).
 */
export function stageClosedProposal(
  scope: SubcontractTx,
  version: SubcontractClauseVersion,
  decision: { readonly decidedBy: string; readonly reason: string | null },
): SubcontractClauseVersion {
  return stageUpdate(scope, 'clauseVersion', versionRefOf(scope, version.clauseId, version.version), version, {
    state: 'rejected', decidedBy: decision.decidedBy, decidedAt: scope.now, decisionReason: decision.reason,
  });
}

/** Κλείνει την ανοιχτή πρόταση ως `rejected` — απόρριψη (manage) ή απόσυρση (ο ίδιος ο προτείνων). */
function closeProposal(
  ctx: AuthContext,
  target: VersionTarget,
  reason: string | null,
  refuse: (version: SubcontractClauseVersion) => ClauseGovernanceRefusal | null,
): Promise<SubcontractClauseVersion> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const { clause, version } = await readTarget(scope, target);
    assertGovernance(refuse(version));
    stageUpdate(scope, 'clause', clauseDocRef(scope.db, clause.id), clause, { openProposal: null });
    return stageClosedProposal(scope, version, { decidedBy: ctx.uid, reason });
  });
}

export function rejectSubcontractClauseVersion(ctx: AuthContext, target: VersionTarget, reason: string | null): Promise<SubcontractClauseVersion> {
  return closeProposal(ctx, target, reason, refuseRejection);
}

export function withdrawSubcontractClauseVersion(ctx: AuthContext, target: VersionTarget, reason: string | null): Promise<SubcontractClauseVersion> {
  return closeProposal(ctx, target, reason, (version) => refuseWithdrawal(version, ctx.uid));
}

/** Ο λογιστής/νομικός είδε το κείμενο (ADR-928 §4 · §9). Ανεξάρτητο από τη διακυβέρνηση, μία φορά ανά έκδοση. */
export function markSubcontractClauseVersionReviewed(ctx: AuthContext, target: VersionTarget): Promise<SubcontractClauseVersion> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const { clause, version } = await readTarget(scope, target);
    assertGovernance(refuseReviewMark(version));
    return stageUpdate(scope, 'clauseVersion', versionRefOf(scope, clause.id, version.version), version, {
      professionalReview: 'reviewed', reviewedBy: ctx.uid, reviewedAt: scope.now,
    });
  });
}

/** Αρχειοθέτηση/επαναφορά ρήτρας. Τα εκδοθέντα έγγραφα κρατούν την έκδοση που πάγωσαν (§5.6) — δεν επηρεάζονται. */
export function setSubcontractClauseArchived(ctx: AuthContext, clauseId: string, expectedRevision: number, archived: boolean): Promise<SubcontractClause> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = clauseDocRef(scope.db, clauseId);
    const clause = await readOwned(scope, 'clause', ref);
    assertRevision(clause, expectedRevision);
    return stageUpdate(scope, 'clause', ref, clause, { isArchived: archived });
  });
}
