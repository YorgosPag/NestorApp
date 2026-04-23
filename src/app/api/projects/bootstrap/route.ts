/**
 * =============================================================================
 * PROJECTS BOOTSTRAP ENDPOINT - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise-grade aggregated data loading για /projects page
 * Αντικαθιστά 85+ N+1 cascade API calls με 1 single request
 *
 * @module api/projects/bootstrap
 * @version 2.1.0
 * @enterprise Phase 2 - RBAC Protection + Tenant Isolation
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: projects:projects:view (company_admin or super_admin)
 * - Tenant Isolation: company_admin sees ONLY their company data
 * - Super Admin Bypass: super_admin sees ALL companies (cross-tenant view)
 * - Comprehensive audit logging with logAuditEvent
 * - Enterprise patterns: SAP/Salesforce tenant isolation
 *
 * 🏢 ENTERPRISE FIX: Uses Admin SDK (not Client SDK)
 * - Admin SDK: Server-side, no offline mode, consistent latency
 * - Client SDK: Was causing 40-50s timeouts and "offline mode" errors
 * - Multi-tenant aware: Filters data based on user's company context
 *
 * 📁 SRP SPLIT (ADR-268):
 * - bootstrap-helpers.ts  → Types + document mapper
 * - bootstrap-queries.ts  → Firestore data-fetching logic
 * - route.ts (this file)  → HTTP handler, caching, response assembly
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import type { AuthContext, PermissionCache } from "@/lib/auth";
import { getAdminFirestore, getAdminDiagnostics } from "@/lib/firebaseAdmin";
import { apiSuccess, type ApiSuccessResponse } from "@/lib/api/ApiErrorHandler";
import { EnterpriseAPICache } from "@/lib/cache/enterprise-api-cache";
import { withSensitiveRateLimit } from "@/lib/middleware/with-rate-limit";
import { createModuleLogger } from "@/lib/telemetry";
import { compareByLocale } from "@/lib/intl-formatting";
import type { BootstrapCompany, BootstrapResponse } from "./bootstrap-helpers";
import {
  fetchCompanies,
  fetchProjects,
  fetchBuildingCounts,
  resolveProjectCompanyNames,
} from "./bootstrap-queries";
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger("ProjectsBootstrapRoute");

const CACHE_KEY = "api:projects:bootstrap";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export const dynamic = "force-dynamic";

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * GET /api/projects/bootstrap
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: projects:projects:view
 * - Tenant Isolation: Filters companies and projects by user's companyId
 *
 * @rateLimit SENSITIVE (20 req/min)
 */
export async function GET(request: NextRequest) {
  const handler = withSensitiveRateLimit(
    withAuth<ApiSuccessResponse<BootstrapResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        return handleProjectsBootstrap(req, ctx);
      },
      { permissions: "projects:projects:view" },
    ),
  );

  return handler(request);
}

async function handleProjectsBootstrap(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<BootstrapResponse>>> {
  const startTime = Date.now();
  logger.info("[Bootstrap] Projects bootstrap load", {
    email: ctx.email,
    companyId: ctx.companyId,
  });

  // 0. VALIDATE FIREBASE ADMIN SDK
  const adminDb = initAdminFirestore();

  // 1. CHECK CACHE
  const isAdmin =
    ctx.globalRole === "super_admin" || ctx.globalRole === "company_admin";
  const tenantCacheKey = isAdmin
    ? `${CACHE_KEY}:admin`
    : `${CACHE_KEY}:tenant:${ctx.companyId}`;

  const cache = EnterpriseAPICache.getInstance();

  if (request.nextUrl.searchParams.has("t")) {
    cache.delete(tenantCacheKey);
    logger.info("[Bootstrap] Cache busted by client request");
  }

  const cachedData = cache.get<BootstrapResponse>(tenantCacheKey);
  if (cachedData) {
    const duration = Date.now() - startTime;
    logger.info("[Bootstrap] CACHE HIT", { durationMs: duration });
    return apiSuccess<BootstrapResponse>(
      { ...cachedData, source: "cache" as const, cached: true },
      `Bootstrap data loaded from cache in ${duration}ms`,
    );
  }

  logger.info("[Bootstrap] Cache miss", {
    tenantId: ctx.companyId,
    role: ctx.globalRole,
  });

  // 2. FETCH COMPANIES (admin multi-company or tenant single-company)
  const companyResult = await fetchCompanies(adminDb, ctx);

  if (!companyResult.ok) {
    return apiSuccess<BootstrapResponse>(
      {
        companies: [],
        projects: [],
        loadedAt: nowISO(),
        source: "firestore",
        cached: false,
      },
      companyResult.emptyReason,
    );
  }

  const { companyIds, companyMap } = companyResult;

  // 3. FETCH PROJECTS
  let allProjects = await fetchProjects(adminDb, companyIds);

  // 3.5. FETCH BUILDING COUNTS (PERF-001)
  const buildingCounts = await fetchBuildingCounts(
    adminDb,
    allProjects.map((p) => p.id),
  );
  allProjects = allProjects.map((p) => ({
    ...p,
    buildingCount: buildingCounts.get(p.id) || 0,
  }));

  // 3.6. RESOLVE COMPANY DISPLAY NAMES (linkedCompanyId → contacts → "ALFA")
  const companyNameMap = await resolveProjectCompanyNames(adminDb, allProjects);
  if (companyNameMap.size > 0) {
    allProjects = allProjects.map((p) => ({
      ...p,
      companyDisplayName: p.linkedCompanyId
        ? (companyNameMap.get(p.linkedCompanyId) ?? p.companyDisplayName)
        : p.companyDisplayName,
    }));
  }

  // 4. BUILD RESPONSE
  const projectCountByCompany = new Map<string, number>();
  allProjects.forEach((p) => {
    projectCountByCompany.set(
      p.companyId,
      (projectCountByCompany.get(p.companyId) || 0) + 1,
    );
  });

  const companies: BootstrapCompany[] = Array.from(companyMap.entries())
    .map(([id, company]) => ({
      id,
      name: company.name,
      projectCount: projectCountByCompany.get(id) || 0,
    }))
    .sort((a, b) => compareByLocale(a.name, b.name));

  const response: BootstrapResponse = {
    companies,
    projects: allProjects,
    loadedAt: nowISO(),
    source: "firestore",
    cached: false,
  };

  // 5. CACHE & RETURN
  cache.set(tenantCacheKey, response, CACHE_TTL_MS);

  const duration = Date.now() - startTime;
  logger.info("[Bootstrap] Complete", {
    companies: companies.length,
    projects: allProjects.length,
    durationMs: duration,
  });

  return apiSuccess<BootstrapResponse>(
    response,
    `Bootstrap loaded: ${companies.length} companies, ${allProjects.length} projects in ${duration}ms`,
  );
}

// ============================================================================
// FIREBASE ADMIN INIT
// ============================================================================

function initAdminFirestore(): FirebaseFirestore.Firestore {
  try {
    return getAdminFirestore();
  } catch (error) {
    const diag = getAdminDiagnostics();
    logger.error("[Bootstrap] Firebase Admin SDK not initialized", {
      environment: diag.environment,
      error: diag.error,
    });
    throw new Error(
      `Bootstrap failed: Firebase Admin SDK not initialized. Environment: ${diag.environment}. ` +
        `Required: FIREBASE_SERVICE_ACCOUNT_KEY in Vercel environment variables.`,
    );
  }
}
