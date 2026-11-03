/**
 * PUT /api/subcontracts/clauses/[id]/archive — αρχειοθέτηση/επαναφορά ρήτρας (ADR-928 §5.2.1). Τα εκδοθέντα έγγραφα
 * κρατούν την έκδοση που πάγωσαν (§5.6). Auth: `subcontracts:clauses:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { setSubcontractClauseArchived } from '@/server/subcontracts/clause-governance-writer.server';
import { archiveBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute } from '../../../_shared/subcontract-route';

export const PUT = subcontractWriteRoute<typeof archiveBodySchema, { id: string }, unknown>(
  { category: 'STANDARD', authority: 'manage' },
  archiveBodySchema,
  (auth, body, params) => setSubcontractClauseArchived(auth, params.id, body.expectedRevision, body.archived),
);
