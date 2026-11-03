/**
 * PUT /api/subcontracts/trade-templates/[id] — αλλαγή **προτύπου ειδικότητας** (ADR-928 §5.3) με CAS· ο κωδικός είναι
 * αμετάβλητος. Auth: `subcontracts:templates:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { updateSubcontractTradeTemplate } from '@/server/subcontracts/trade-template-writer.server';
import { updateTradeTemplateBodySchema } from '@/subapps/procurement/subcontracts/schema/trade-template.schema';
import { subcontractWriteRoute } from '../../_shared/subcontract-route';

export const PUT = subcontractWriteRoute<typeof updateTradeTemplateBodySchema, { id: string }, unknown>(
  { category: 'STANDARD', authority: 'templates' },
  updateTradeTemplateBodySchema,
  (auth, body, params) => updateSubcontractTradeTemplate(auth, params.id, body.expectedRevision, body.definition),
);
