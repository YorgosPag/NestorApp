/**
 * POST /api/opportunities/[id]/stage  { expectedStage, request } → { outcome, stage, previousStage?, reopened? }
 *
 * The ONE door for an opportunity's stage (ADR-929): kanban drag, keyboard "Move to…", edit form, undo.
 *
 * - `expectedStage` ≠ stored stage ⇒ 409 `{ currentStage, updatedBy }` — someone else moved it meanwhile.
 *   Field-level CAS: an unrelated edit (note, phone) does NOT cancel the move.
 * - Closing data missing/invalid (won: value + date · lost: catalogued reason) ⇒ 400 `{ reason }`.
 * - Same stage again ⇒ `unchanged`: no write, no history row. Retries also go through the
 *   `Idempotency-Key` boundary of `withAuth` (ADR-872).
 *
 * Auth: withAuth + `crm:opportunities:update` + opportunity tenant fence (foreign ⇒ 404) · Rate: sensitive (CRM data)
 *
 * @see ADR-929 · ADR-602 API Route-Handler Factory SSoT
 */

import 'server-only';

import { badRequest, conflict, defineRoute, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireOpportunityInTenant } from '@/lib/auth/tenant-isolation';
import { API_ROUTES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import { opportunityStageBody, type OpportunityStageResponse } from '@/services/crm/opportunity-stage-schema';
import { applyOpportunityStageTransition } from '@/services/crm/opportunity-stage-transition.server';

export const dynamic = 'force-dynamic';

type Params = { id: string };

export const POST = defineRoute<typeof opportunityStageBody, Params>({
  rateLimit: 'sensitive',
  schema: opportunityStageBody,
  auth: { permissions: 'crm:opportunities:update' },
  fallbackError: 'Failed to change opportunity stage',
  handler: async ({ auth, body, params }) => {
    await requireOpportunityInTenant({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.STAGE(params.id) });
    const outcome = await applyOpportunityStageTransition(getAdminFirestore(), {
      opportunityId: params.id,
      expectedStage: body.expectedStage,
      request: body.request,
      ctx: auth,
      nowIso: nowISO(),
    });
    if (outcome.kind === 'conflict') {
      conflict('Opportunity stage changed meanwhile', { currentStage: outcome.currentStage, updatedBy: outcome.updatedBy });
    }
    if (outcome.kind === 'invalid') badRequest('Invalid stage transition', { reason: outcome.reason });
    const response: OpportunityStageResponse =
      outcome.kind === 'unchanged'
        ? { outcome: 'unchanged', stage: outcome.stage }
        : { outcome: 'applied', stage: outcome.stage, previousStage: outcome.previousStage, reopened: outcome.reopened };
    return ok(response);
  },
});
