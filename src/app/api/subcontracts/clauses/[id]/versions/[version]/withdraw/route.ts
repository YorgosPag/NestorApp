/**
 * POST …/clauses/[id]/versions/[version]/withdraw — **απόσυρση** πρότασης από τον ίδιο τον προτείνοντα (ADR-928 §5.2.1·
 * άλλος ⇒ 403 `notProposer`). Auth: `subcontracts:clauses:propose` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { withdrawSubcontractClauseVersion } from '@/server/subcontracts/clause-governance-writer.server';
import { decideClauseVersionBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute, versionTargetOf, type ClauseVersionParams } from '../../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof decideClauseVersionBodySchema, ClauseVersionParams, unknown>(
  { category: 'STANDARD', authority: 'propose' },
  decideClauseVersionBodySchema,
  (auth, body, params) => withdrawSubcontractClauseVersion(auth, versionTargetOf(params, body.expectedRevision), body.reason),
);
