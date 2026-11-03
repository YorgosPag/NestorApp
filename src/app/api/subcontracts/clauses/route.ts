/**
 * POST /api/subcontracts/clauses — νέα ρήτρα στη βιβλιοθήκη, ως **πρόταση** της έκδοσης 1 (ADR-928 §5.2.1).
 * Ισχύει μόνο μετά από έγκριση άλλου ανθρώπου. Auth: `subcontracts:clauses:propose` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createSubcontractClause } from '@/server/subcontracts/clause-library-writer.server';
import { createClauseBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractCreateRoute } from '../_shared/subcontract-route';

export const POST = subcontractCreateRoute({ category: 'STANDARD', authority: 'propose' }, createClauseBodySchema, (auth, body) =>
  createSubcontractClause(auth, {
    draft: { clauseKey: body.clauseKey, title: body.title, body: body.body, parameters: body.parameters },
    proposalReason: body.proposalReason,
  }),
);
