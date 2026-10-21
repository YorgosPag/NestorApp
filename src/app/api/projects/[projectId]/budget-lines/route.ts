/**
 * GET /api/projects/[projectId]/budget-lines → { lines }
 *
 * The project's ACTIVE budget lines (soft cost + allowances), each with its `revision` — what the Φ3γ editor
 * sends back as `expectedRevision`. The figures the ledger reads come from the SAME reader.
 *
 * Auth: withAuth + `projects:projects:view` + project tenant fence (foreign project ⇒ 404, ADR-742) · Rate: standard
 *
 * @see ADR-917 Φ3β
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireProjectInTenant } from '@/lib/auth';
import { API_ROUTES } from '@/config/domain-constants';
import { compareCostCodes } from '@/config/cost-taxonomy';
import { readProjectBudgetLines } from '@/services/project-cost/project-budget-lines.server';

export const dynamic = 'force-dynamic';

export const GET = defineRoute<never, { projectId: string }>({
  rateLimit: 'standard',
  auth: { permissions: 'projects:projects:view' },
  fallbackError: 'Failed to load project budget lines',
  handler: async ({ auth, params }) => {
    const { projectId } = params;
    await requireProjectInTenant({ ctx: auth, projectId, path: API_ROUTES.PROJECTS.BUDGET_LINES(projectId) });
    const lines = await readProjectBudgetLines(getAdminFirestore(), auth.companyId, projectId);
    return ok({ lines: [...lines].sort((a, b) => compareCostCodes(a.costCode, b.costCode)) });
  },
});
