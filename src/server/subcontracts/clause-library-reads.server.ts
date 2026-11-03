import 'server-only';

/**
 * Η **εγκεκριμένη βιβλιοθήκη** μέσα στη συναλλαγή (ADR-928 §5.3 · §5.6) — ό,τι κρίνει ένα πρότυπο (Φ1) ή ένα
 * συμφωνητικό που καρφώνει εκδόσεις (Φ2). Δύο `getAll` (ρήτρες, μετά οι εκδόσεις σε ισχύ), ποτέ ερώτημα: το id είναι
 * ντετερμινιστικό από (χώρος, κλειδί), άρα η απάντηση είναι συνεπής με ό,τι γράφει η ίδια συναλλαγή.
 *
 * 🔑 **Μία** ανάγνωση, δύο προβολές: το πρότυπο θέλει μόνο τις παραμέτρους· το συμφωνητικό και την ίδια την έκδοση (σώμα,
 * μεταφράσεις, αποτύπωμα), γιατί την παγώνει στην αναθεώρηση.
 * @module server/subcontracts/clause-library-reads.server
 */

import { generateDeterministicSubcontractClauseId, generateDeterministicSubcontractClauseVersionId } from '@/services/enterprise-id.service';
import type { PinnedClause } from '@/subapps/procurement/subcontracts/agreements/agreement-snapshot';
import type { ClauseKey, SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { clauseDocRef, clauseVersionDocRef, readOwnedMany, type SubcontractTx } from './subcontract-store.server';

/**
 * Για κάθε κλειδί: η ρήτρα με την εγκεκριμένη έκδοσή της σε ισχύ, ή `null` (υπάρχει χωρίς εγκεκριμένη). Ρήτρα που
 * λείπει ή είναι αρχειοθετημένη **δεν** μπαίνει στον χάρτη — ο επικυρωτής τη λέει «άγνωστη».
 */
export async function readApprovedClauses(
  scope: SubcontractTx,
  clauseKeys: readonly ClauseKey[],
): Promise<ReadonlyMap<ClauseKey, PinnedClause | null>> {
  const keys = [...new Set(clauseKeys)];
  const clauses = await readOwnedMany(scope, 'clause', keys.map((key) => clauseDocRef(scope.db, generateDeterministicSubcontractClauseId(scope.ctx.companyId, key))));
  const live = clauses.filter((clause): clause is SubcontractClause => clause !== null && !clause.isArchived);
  const inForce = live.filter((clause) => clause.currentVersion !== null);
  const versions = await readOwnedMany(scope, 'clauseVersion', inForce.map((clause) =>
    clauseVersionDocRef(scope.db, clause.id, generateDeterministicSubcontractClauseVersionId(clause.id, clause.currentVersion ?? 0)),
  ));
  const pinnedById = new Map(inForce.map((clause, index) => {
    const version = versions[index];
    return [clause.id, version ? { clause, version } : null] as const;
  }));
  return new Map(live.map((clause) => [clause.clauseKey, pinnedById.get(clause.id) ?? null]));
}

/** Προβολή για το πρότυπο: μόνο οι παράμετροι της έκδοσης σε ισχύ. */
export async function readApprovedLibrary(
  scope: SubcontractTx,
  clauseKeys: readonly ClauseKey[],
): Promise<ReadonlyMap<ClauseKey, readonly ClauseParameterDefinition[] | null>> {
  const pinned = await readApprovedClauses(scope, clauseKeys);
  return new Map([...pinned].map(([key, entry]) => [key, entry ? entry.version.parameters : null]));
}
