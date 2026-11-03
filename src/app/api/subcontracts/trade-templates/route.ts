/**
 * POST /api/subcontracts/trade-templates — νέο **πρότυπο ειδικότητας** (ADR-928 §5.3), κρινόμενο απέναντι στην
 * εγκεκριμένη βιβλιοθήκη μέσα στη συναλλαγή. Auth: `subcontracts:templates:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createSubcontractTradeTemplate } from '@/server/subcontracts/trade-template-writer.server';
import { createTradeTemplateBodySchema } from '@/subapps/procurement/subcontracts/schema/trade-template.schema';
import { subcontractCreateRoute } from '../_shared/subcontract-route';

export const POST = subcontractCreateRoute({ category: 'STANDARD', authority: 'templates' }, createTradeTemplateBodySchema, (auth, body) =>
  createSubcontractTradeTemplate(auth, body.definition),
);
