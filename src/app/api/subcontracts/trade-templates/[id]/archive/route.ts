/**
 * PUT /api/subcontracts/trade-templates/[id]/archive — αρχειοθέτηση/επαναφορά **προτύπου ειδικότητας** (ADR-928 §5.3).
 * Auth: `subcontracts:templates:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { setSubcontractTradeTemplateArchived } from '@/server/subcontracts/trade-template-writer.server';
import { archiveBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute } from '../../../_shared/subcontract-route';

export const PUT = subcontractWriteRoute<typeof archiveBodySchema, { id: string }, unknown>(
  { category: 'STANDARD', authority: 'templates' },
  archiveBodySchema,
  (auth, body, params) => setSubcontractTradeTemplateArchived(auth, params.id, body.expectedRevision, body.archived),
);
