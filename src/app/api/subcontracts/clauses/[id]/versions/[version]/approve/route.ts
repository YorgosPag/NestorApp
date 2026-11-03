/**
 * POST …/clauses/[id]/versions/[version]/approve — **έγκριση** πρότασης (ADR-928 §5.2.1). Ο προτείνων δεν εγκρίνει
 * τη δική του (403 `selfApproval`)· η προηγούμενη εγκεκριμένη γίνεται `superseded` στην ίδια συναλλαγή.
 * Auth: `subcontracts:clauses:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { approveSubcontractClauseVersion } from '@/server/subcontracts/clause-governance-writer.server';
import { approveClauseVersionBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute, versionTargetOf, type ClauseVersionParams } from '../../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof approveClauseVersionBodySchema, ClauseVersionParams, unknown>(
  { category: 'STANDARD', authority: 'manage' },
  approveClauseVersionBodySchema,
  (auth, body, params) =>
    approveSubcontractClauseVersion(auth, versionTargetOf(params, body.expectedRevision), { effectiveFrom: body.effectiveFrom, reason: body.reason }),
);
