import 'server-only';

/**
 * Η **εγκεκριμένη βιβλιοθήκη** μέσα στη συναλλαγή (ADR-928 §5.3 · §5.6) — ό,τι κρίνει ένα πρότυπο (Φ1) ή ένα
 * συμφωνητικό που καρφώνει εκδόσεις (Φ2). Δύο `getAll` (ρήτρες, μετά οι εκδόσεις σε ισχύ), ποτέ ερώτημα: το id είναι
 * ντετερμινιστικό από (χώρος, κλειδί), άρα η απάντηση είναι συνεπής με ό,τι γράφει η ίδια συναλλαγή.
 * @module server/subcontracts/clause-library-reads.server
 */

import { generateDeterministicSubcontractClauseId, generateDeterministicSubcontractClauseVersionId } from '@/services/enterprise-id.service';
import type { ClauseKey, SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { clauseDocRef, clauseVersionDocRef, readOwnedMany, type SubcontractTx } from './subcontract-store.server';

/**
 * Για κάθε κλειδί: οι παράμετροι της εγκεκριμένης έκδοσης σε ισχύ, ή `null` (υπάρχει χωρίς εγκεκριμένη). Ρήτρα που
 * λείπει ή είναι αρχειοθετημένη **δεν** μπαίνει στον χάρτη — ο επικυρωτής τη λέει «άγνωστη».
 */
export async function readApprovedLibrary(
  scope: SubcontractTx,
  clauseKeys: readonly ClauseKey[],
): Promise<ReadonlyMap<ClauseKey, readonly ClauseParameterDefinition[] | null>> {
  const keys = [...new Set(clauseKeys)];
  const clauses = await readOwnedMany(scope, 'clause', keys.map((key) => clauseDocRef(scope.db, generateDeterministicSubcontractClauseId(scope.ctx.companyId, key))));
  const live = clauses.filter((clause): clause is SubcontractClause => clause !== null && !clause.isArchived);
  const inForce = live.flatMap((clause) => (clause.currentVersion === null ? [] : [{ id: clause.id, version: clause.currentVersion }]));
  const versions = await readOwnedMany(scope, 'clauseVersion', inForce.map(({ id, version }) =>
    clauseVersionDocRef(scope.db, id, generateDeterministicSubcontractClauseVersionId(id, version)),
  ));
  const parametersByClause = new Map(inForce.map(({ id }, index) => [id, versions[index]?.parameters ?? null]));
  return new Map(live.map((clause) => [clause.clauseKey, parametersByClause.get(clause.id) ?? null]));
}
