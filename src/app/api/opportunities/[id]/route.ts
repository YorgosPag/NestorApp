/**
 * =============================================================================
 * PATCH + DELETE /api/opportunities/[id] — Update & Delete Opportunity
 * =============================================================================
 *
 * PATCH:  Update opportunity fields (server-side validation). The stage is NOT here — `…/[id]/stage` (ADR-930).
 * DELETE: Hard-delete opportunity.
 *
 * Auth: withAuth + tenant fence (foreign ⇒ 404) + **owner authority** (`requireOpportunityAccess`, ADR-930):
 *   PATCH = intent `edit` (manager capability · creator · assignee) · DELETE = intent `delete` (manager · creator —
 *   NOT the assignee). Same table as `firestore.rules` `match /opportunities`.
 *   ⚠️ Until 2026-11-04 both handlers checked ONLY the tenant ⇒ any member of the company could edit or delete ANY
 *   opportunity over HTTP, past the rules (Admin SDK). And every refusal of the fence answered 500 instead of 404.
 * Rate: sensitive (financial/CRM data)
 *
 * @module api/opportunities/[id]
 * @enterprise ADR-252 Security Fix: Server-side validation · ADR-930 owner authority · ADR-603 defineRoute
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { API_ROUTES } from '@/config/domain-constants';
import { OpportunitiesServerService } from '@/services/opportunities-server.service';
import { requireOpportunityAccess } from '@/services/crm/opportunity-access.server';
import { respondWithServiceResult } from '../_service-response';

const UpdateOpportunitySchema = z.object({
  stage: z.string().max(50).optional(),
  value: z.number().min(0).max(999_999_999).optional(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(100).optional(),
  expectedCloseDate: z.string().max(30).nullable().optional(),
  lostReason: z.string().max(500).optional(),
}).passthrough();

type Params = { id: string };

const success = () => NextResponse.json({ success: true });

export const PATCH = defineRoute<typeof UpdateOpportunitySchema, Params>({
  rateLimit: 'sensitive',
  schema: UpdateOpportunitySchema,
  fallbackError: 'Failed to update opportunity',
  handler: async ({ auth, body, params }) => {
    await requireOpportunityAccess({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.BY_ID(params.id), intent: 'edit' });
    const result = await OpportunitiesServerService.update(
      params.id,
      { ...body, expectedCloseDate: body.expectedCloseDate ?? undefined },
      auth.companyId,
      auth.uid,
      auth.email ?? null,
    );
    return respondWithServiceResult(result, success);
  },
});

export const DELETE = defineRoute<z.ZodTypeAny, Params>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete opportunity',
  handler: async ({ auth, params }) => {
    await requireOpportunityAccess({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.BY_ID(params.id), intent: 'delete' });
    const result = await OpportunitiesServerService.remove(params.id, auth.companyId, auth);
    return respondWithServiceResult(result, success);
  },
});
