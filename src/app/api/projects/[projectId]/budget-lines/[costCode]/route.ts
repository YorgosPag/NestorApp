/**
 * PUT    /api/projects/[projectId]/budget-lines/[costCode]  { amount, note, expectedRevision } → { outcome, line }
 * DELETE /api/projects/[projectId]/budget-lines/[costCode]?expectedRevision=N              → { outcome, line }
 *
 * ONE budget line per (project, cost code) — soft cost (`SOFT-*`) or an allowance on an ΑΤΟΕ code (`OIK-*`).
 * DELETE archives (Ζ3): the ledger stops reading it, the history stays.
 *
 * - Code outside the taxonomy (or a free-text lower level) ⇒ 400.
 * - `expectedRevision` ≠ current ⇒ 409 `{ currentRevision }` — no lost update between two editors.
 * - Same values again ⇒ `unchanged`, no write, no history row. Retries also go through the
 *   `Idempotency-Key` boundary of `withAuth` (ADR-872).
 *
 * Auth: withAuth + `projects:projects:update` + project tenant fence (foreign project ⇒ 404, ADR-742) · Rate: standard
 *
 * @see ADR-917 Φ3β · Ζ3 · Ζ5 · Ζ8
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { badRequest, conflict, defineRoute, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireProjectInTenant } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { API_ROUTES } from '@/config/domain-constants';
import { isBudgetLineCostCode } from '@/config/cost-taxonomy';
import { nowISO } from '@/lib/date-local';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  budgetLineArchiveQuery,
  budgetLinePutBody,
} from '@/services/project-cost/project-budget-line-schema';
import {
  writeProjectBudgetLine,
  type BudgetLineValues,
  type BudgetLineWriteOutcome,
} from '@/services/project-cost/project-budget-lines.server';

export const dynamic = 'force-dynamic';

type Params = { projectId: string; costCode: string };

const WRITE_PERMISSION = { permissions: 'projects:projects:update' } as const;

/** The shared path of both verbs: fence → validate code → ONE writer → envelope */
async function setOrArchive(
  auth: AuthContext,
  { projectId, costCode }: Params,
  next: BudgetLineValues | null,
  expectedRevision: number,
) {
  const path = API_ROUTES.PROJECTS.BUDGET_LINE(projectId, costCode);
  const project = await requireProjectInTenant({ ctx: auth, projectId, path });
  if (!isBudgetLineCostCode(costCode)) badRequest('Cost code is not a budget-line code', { costCode });
  const outcome: BudgetLineWriteOutcome = await writeProjectBudgetLine(getAdminFirestore(), {
    actor: { companyId: auth.companyId, uid: auth.uid, name: auth.email || null },
    target: { projectId, projectName: project.name ?? null, costCode },
    next,
    expectedRevision,
    nowIso: nowISO(),
  });
  if (outcome.kind === 'conflict') conflict('Budget line changed meanwhile', { currentRevision: outcome.currentRevision });
  return ok({ outcome: outcome.kind, line: outcome.line });
}

export const PUT = defineRoute<typeof budgetLinePutBody, Params>({
  rateLimit: 'standard',
  schema: budgetLinePutBody,
  auth: WRITE_PERMISSION,
  fallbackError: 'Failed to set budget line',
  handler: async ({ auth, body, params }) =>
    setOrArchive(auth, params, { amount: body.amount, note: body.note }, body.expectedRevision),
});

export const DELETE = defineRoute<never, Params>({
  rateLimit: 'standard',
  auth: WRITE_PERMISSION,
  fallbackError: 'Failed to archive budget line',
  handler: async ({ auth, req, params }) => {
    const parsed = safeParseBody(budgetLineArchiveQuery, {
      expectedRevision: req.nextUrl.searchParams.get('expectedRevision') ?? '',
    });
    if (parsed.error) return parsed.error;
    return setOrArchive(auth, params, null, parsed.data.expectedRevision);
  },
});
