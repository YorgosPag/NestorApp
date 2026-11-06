/**
 * PATCH  /api/opportunities/[id]  { changes, expected } → { outcome: 'applied' | 'unchanged' }
 * DELETE /api/opportunities/[id]                        → { success }
 *
 * The ONE door for an opportunity's fields and its deletion (ADR-930 §3.10). Stage → `…/stage`, owner → `…/owner`.
 *
 * - PATCH body = `opportunityUpdateBody` (strict): stage-owned, owner or system fields ⇒ 400.
 * - Field-level CAS: `expected` = what the human SAW for the fields they change. One of THOSE changed meanwhile to a
 *   different value ⇒ 409 `{ fields, updatedBy }`. An unrelated change (stage, owner, other field) does NOT cancel.
 * - Nothing actually different ⇒ `unchanged`: no write, no history row.
 * - DELETE keeps the last values in the history row (ADR-195) — the deleted opportunity can be reconstructed.
 *
 * Auth: withAuth + tenant fence (foreign ⇒ 404) + **owner authority** (`requireOpportunityAccess`, ADR-930):
 *   PATCH = intent `edit` (manager capability · creator · assignee) · DELETE = intent `delete` (manager · creator —
 *   NOT the assignee). Same table as `firestore.rules` `match /opportunities`.
 * Rate: sensitive (CRM data)
 *
 * @see ADR-930 · ADR-252 · ADR-602 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { z } from 'zod';

import { conflict, defineRoute, notFound, ok } from '@/lib/api/define-route';
import { API_ROUTES } from '@/config/domain-constants';
import { OpportunitiesServerService } from '@/services/opportunities-server.service';
import { requireOpportunityAccess } from '@/services/crm/opportunity-access.server';
import { opportunityUpdateBody, type OpportunityUpdateResponse } from '@/services/crm/opportunity-fields-schema';

export const dynamic = 'force-dynamic';

type Params = { id: string };

const NOT_FOUND = 'Opportunity not found';

export const PATCH = defineRoute<typeof opportunityUpdateBody, Params>({
  rateLimit: 'sensitive',
  schema: opportunityUpdateBody,
  fallbackError: 'Failed to update opportunity',
  handler: async ({ auth, body, params }) => {
    await requireOpportunityAccess({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.BY_ID(params.id), intent: 'edit' });
    const outcome = await OpportunitiesServerService.update(params.id, body, auth);
    if (outcome.kind === 'refused') notFound(NOT_FOUND);
    if (outcome.kind === 'conflict') {
      conflict('Opportunity fields changed meanwhile', { fields: outcome.fields, updatedBy: outcome.updatedBy });
    }
    const response: OpportunityUpdateResponse = { outcome: outcome.kind };
    return ok(response);
  },
});

export const DELETE = defineRoute<z.ZodTypeAny, Params>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete opportunity',
  handler: async ({ auth, params }) => {
    await requireOpportunityAccess({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.BY_ID(params.id), intent: 'delete' });
    const outcome = await OpportunitiesServerService.remove(params.id, auth);
    if (outcome.kind === 'refused') notFound(NOT_FOUND);
    return ok();
  },
});
