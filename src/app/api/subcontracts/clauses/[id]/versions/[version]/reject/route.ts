/**
 * POST …/clauses/[id]/versions/[version]/reject — **απόρριψη** πρότασης (ADR-928 §5.2.1).
 * Auth: `subcontracts:clauses:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { rejectSubcontractClauseVersion } from '@/server/subcontracts/clause-governance-writer.server';
import { decideClauseVersionBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute, versionTargetOf, type ClauseVersionParams } from '../../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof decideClauseVersionBodySchema, ClauseVersionParams, unknown>(
  { category: 'STANDARD', authority: 'manage' },
  decideClauseVersionBodySchema,
  (auth, body, params) => rejectSubcontractClauseVersion(auth, versionTargetOf(params, body.expectedRevision), body.reason),
);
