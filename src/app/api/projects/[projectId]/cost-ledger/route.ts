/**
 * GET /api/projects/[projectId]/cost-ledger
 *
 * Budget vs pending / committed / delivered per cost code, from the project's
 * SOURCE documents (BOQ + purchase orders) — nothing typed by hand. Read-only.
 *
 * Auth: withAuth + project tenant fence (foreign project ⇒ 404, ADR-742) · Rate: standard
 *
 * @see ADR-917 §4 Δ3 (α)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireProjectInTenant } from '@/lib/auth';
import { API_ROUTES } from '@/config/domain-constants';
import { loadProjectCostLedger } from '@/services/project-cost/project-cost-ledger.server';
import { toCostLedgerView } from '@/services/project-cost/cost-ledger-view';

export const dynamic = 'force-dynamic';

export const GET = defineRoute<never, { projectId: string }>({
  rateLimit: 'standard',
  fallbackError: 'Failed to load project cost ledger',
  handler: async ({ auth, params }) => {
    const { projectId } = params;
    await requireProjectInTenant({ ctx: auth, projectId, path: API_ROUTES.PROJECTS.COST_LEDGER(projectId) });
    const ledger = await loadProjectCostLedger(getAdminFirestore(), auth.companyId, projectId);
    return ok(toCostLedgerView(projectId, ledger, { includeSources: true }));
  },
});
