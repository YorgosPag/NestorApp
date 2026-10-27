/**
 * GET /api/projects/[projectId]/buyout
 *
 * Every counted BOQ line of the project with its procurement coverage: committed PO · draft/approved PO ·
 * open RFQ · nothing. Coverage by PO comes from the cost ledger (ADR-917) — the SAME set behind the overview's
 * «BOQ coverage» card — and the open RFQs are overlaid on top. Read-only.
 *
 * Auth: withAuth + project tenant fence (foreign project ⇒ 404, ADR-742) · Rate: standard
 *
 * @see ADR-330 §5.1 S3.2
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireProjectInTenant } from '@/lib/auth';
import { API_ROUTES } from '@/config/domain-constants';
import { loadProjectCostLedger } from '@/services/project-cost/project-cost-ledger.server';
import { fetchProjectBoqSourcing } from '@/services/procurement/aggregators/project-boq-sourcing';
import { deriveProjectBuyout } from '@/services/procurement/buyout/project-buyout';

export const dynamic = 'force-dynamic';

export const GET = defineRoute<never, { projectId: string }>({
  rateLimit: 'standard',
  fallbackError: 'Failed to load project buyout',
  handler: async ({ auth, params }) => {
    const { projectId } = params;
    await requireProjectInTenant({ ctx: auth, projectId, path: API_ROUTES.PROJECTS.BUYOUT(projectId) });
    const db = getAdminFirestore();
    const [ledger, rfqRefs] = await Promise.all([
      loadProjectCostLedger(db, auth.companyId, projectId),
      fetchProjectBoqSourcing(db, auth.companyId, projectId),
    ]);
    return ok(deriveProjectBuyout(ledger, rfqRefs));
  },
});
