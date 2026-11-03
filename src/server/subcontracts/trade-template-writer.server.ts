import 'server-only';

/**
 * Ο γραφέας των **προτύπων ειδικότητας** (ADR-928 §5.3).
 *
 * Δύο επικυρώσεις, επίτηδες σε δύο χρόνους: το πρότυπο **μόνο του** πριν από τη συναλλαγή (καθαρό), και **απέναντι στη
 * βιβλιοθήκη μέσα** στη συναλλαγή — μια ρήτρα που αρχειοθετήθηκε ή μια ζώνη που στένεψε ένα δευτερόλεπτο πριν πιάνεται.
 * Ο κωδικός είναι **αμετάβλητος** (από αυτόν βγαίνει το ντετερμινιστικό id).
 * @module server/subcontracts/trade-template-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { generateDeterministicSubcontractTradeTemplateId } from '@/services/enterprise-id.service';
import { validateTemplateAgainstLibrary, validateTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/templates/validate-trade-template';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import { readApprovedLibrary } from './clause-library-reads.server';
import {
  assertRevision,
  readOwned,
  runSubcontractTransaction,
  stageCreate,
  stageUpdate,
  tradeTemplateDocRef,
  type SubcontractTx,
} from './subcontract-store.server';
import { assertNoSubcontractIssues, SubcontractWriteError } from './subcontract-write-error';

/** Η κρίση απέναντι στη βιβλιοθήκη — ανάγνωση μέσα στη συναλλαγή, πριν από κάθε εγγραφή. */
async function assertAgainstLibrary(scope: SubcontractTx, definition: SubcontractTradeTemplateDefinition): Promise<void> {
  const library = await readApprovedLibrary(scope, definition.clauses.map((ref) => ref.clauseKey));
  assertNoSubcontractIssues(validateTemplateAgainstLibrary(definition, library));
}

export function createSubcontractTradeTemplate(ctx: AuthContext, definition: SubcontractTradeTemplateDefinition): Promise<SubcontractTradeTemplate> {
  assertNoSubcontractIssues(validateTradeTemplateDefinition(definition));
  return runSubcontractTransaction(ctx, async (scope) => {
    const id = generateDeterministicSubcontractTradeTemplateId(scope.ctx.companyId, definition.code);
    const ref = tradeTemplateDocRef(scope.db, id);
    if ((await scope.tx.get(ref)).exists) throw new SubcontractWriteError('duplicate', [], { code: definition.code });
    await assertAgainstLibrary(scope, definition);
    return stageCreate(scope, 'tradeTemplate', ref, newTradeTemplateRecord(scope, id, definition));
  });
}

/** Ο φάκελος νέου προτύπου — ο **ένας** ορισμός, για γραφέα και σπορά. */
export function newTradeTemplateRecord(scope: SubcontractTx, id: string, definition: SubcontractTradeTemplateDefinition): SubcontractTradeTemplate {
  return {
    ...definition, id, companyId: scope.ctx.companyId, isArchived: false, revision: 1,
    createdAt: scope.now, updatedAt: scope.now, createdBy: scope.ctx.uid, updatedBy: scope.ctx.uid,
  };
}

export function updateSubcontractTradeTemplate(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: SubcontractTradeTemplateDefinition,
): Promise<SubcontractTradeTemplate> {
  assertNoSubcontractIssues(validateTradeTemplateDefinition(definition));
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = tradeTemplateDocRef(scope.db, id);
    const current = await readOwned(scope, 'tradeTemplate', ref);
    assertRevision(current, expectedRevision);
    if (current.code !== definition.code) throw new SubcontractWriteError('invalid', [{ code: 'templateCodeInvalid', path: 'code' }]);
    await assertAgainstLibrary(scope, definition);
    return stageUpdate(scope, 'tradeTemplate', ref, current, definition);
  });
}

export function setSubcontractTradeTemplateArchived(ctx: AuthContext, id: string, expectedRevision: number, archived: boolean): Promise<SubcontractTradeTemplate> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = tradeTemplateDocRef(scope.db, id);
    const current = await readOwned(scope, 'tradeTemplate', ref);
    assertRevision(current, expectedRevision);
    return stageUpdate(scope, 'tradeTemplate', ref, current, { isArchived: archived });
  });
}
