import 'server-only';

import { buildingInstantiationRoute } from '@/server/admin/building-instantiation-route';

/**
 * ENTERPRISE SEED ROUTE: Create Buildings from Templates
 *
 * Server-only admin endpoint that creates buildings from Firestore templates.
 *
 * NOTE: This route is functionally identical to /api/buildings/populate.
 * Both delegate to the SAME route factory — the distinction is kept for backward
 * compatibility and semantic clarity (seed vs populate naming), and survives only
 * in the audit trail below (`source` / `operationPrefix` / `createdBy`).
 *
 * ⚠️ Μέχρι σήμερα η ομοιότητα ήταν **αντιγραμμένος κώδικας** και το «είναι ίδια»
 * ζούσε σε σχόλιο. Πλέον είναι **δομική**: ένα σχόλιο δεν είναι φρουρός (CHECK 3.36).
 *
 * SECURITY GATES (στο `building-instantiation-route`):
 * - server-only (import 'server-only')
 * - withAuth + requiredGlobalRoles: BYPASS_ROLES
 * - Admin SDK only (via handleBuildingInstantiation)
 *
 * @method POST - Create buildings from templates
 * @requires ADMIN_COMPANY_NAME - Server-only env var
 * @requires super_admin role
 *
 * @author Enterprise Architecture Team
 */
export const POST = buildingInstantiationRoute({
  source: 'api/buildings/seed',
  operationPrefix: 'SEED_BUILDINGS',
  createdBy: 'seed-operation',
  includeEnterpriseFields: true,
});
