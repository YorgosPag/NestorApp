/**
 * POST /api/subcontracts/clauses/[id]/versions — **πρόταση** νέας έκδοσης ρήτρας (ADR-928 §5.2.1). Μία ανοιχτή πρόταση
 * ανά ρήτρα (409 `proposalPending`). Auth: `subcontracts:clauses:propose` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { proposeSubcontractClauseVersion } from '@/server/subcontracts/clause-library-writer.server';
import { proposeClauseVersionBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractCreateRoute } from '../../../_shared/subcontract-route';

export const POST = subcontractCreateRoute<typeof proposeClauseVersionBodySchema, { id: string }, unknown>(
  { category: 'STANDARD', authority: 'propose' },
  proposeClauseVersionBodySchema,
  (auth, body, params) => proposeSubcontractClauseVersion(auth, params.id, body),
);
