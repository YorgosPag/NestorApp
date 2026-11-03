/**
 * POST …/clauses/[id]/versions/[version]/review — σημείωση **επαγγελματικού ελέγχου** (λογιστής/νομικός, ADR-928 §4 · §9).
 * Auth: `subcontracts:clauses:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { markSubcontractClauseVersionReviewed } from '@/server/subcontracts/clause-governance-writer.server';
import { revisionOnlyBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute, versionTargetOf, type ClauseVersionParams } from '../../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof revisionOnlyBodySchema, ClauseVersionParams, unknown>(
  { category: 'STANDARD', authority: 'manage' },
  revisionOnlyBodySchema,
  (auth, body, params) => markSubcontractClauseVersionReviewed(auth, versionTargetOf(params, body.expectedRevision)),
);
