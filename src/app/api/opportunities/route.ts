/**
 * POST /api/opportunities  { title, …fields, stage?, assignedTo? } → 201 { id }
 *
 * The ONE door that creates an opportunity (ADR-930 §3.10) — in the client's schema (`types/crm.ts`), with a history row.
 *
 * - Body = `opportunityCreateBody` (strict): unknown, stage-owned or system fields ⇒ 400. Only an OPEN stage —
 *   closing needs closing data and goes through `…/[id]/stage`.
 * - `assignedTo` other than the caller ⇒ must be an ACTIVE member of the workspace, else 400 `{ reason: 'owner_not_member' }`.
 * - Retries go through the `Idempotency-Key` boundary of `withAuth` (ADR-872) — a double click is ONE opportunity.
 *
 * Auth: withAuth — any member of the company (same as `crmCanCreate` in `firestore.rules`); the company comes from the
 *   auth context, never from the body. Rate: sensitive (CRM data).
 *
 * @see ADR-930 · ADR-602 API Route-Handler Factory SSoT
 */

import 'server-only';

import { badRequest, created, defineRoute } from '@/lib/api/define-route';
import { OpportunitiesServerService } from '@/services/opportunities-server.service';
import { opportunityCreateBody, type OpportunityCreateResponse } from '@/services/crm/opportunity-fields-schema';

export const dynamic = 'force-dynamic';

export const POST = defineRoute<typeof opportunityCreateBody>({
  rateLimit: 'sensitive',
  schema: opportunityCreateBody,
  fallbackError: 'Failed to create opportunity',
  handler: async ({ auth, body }) => {
    const outcome = await OpportunitiesServerService.create(body, auth);
    if (outcome.kind === 'invalid') badRequest('The owner is not an active member of this workspace', { reason: outcome.reason });
    const response: OpportunityCreateResponse = { id: outcome.id };
    return created(response);
  },
});
