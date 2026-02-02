/**
 * 🏗️ PROJECTS BY COMPANY ENDPOINT
 *
 * @module api/projects/by-company/[companyId]
 * @version 2.1.0
 * @updated 2026-02-02 - SUPER_ADMIN CROSS-TENANT ACCESS
 *
 * 🚨 SECURITY:
 * - Migrated from Client SDK to Admin SDK
 * - Added withAuth + RBAC protection
 * - URL param [companyId] honored ONLY for super_admin
 * - Regular users: Always uses ctx.companyId (tenant isolation)
 * - super_admin: Can access any company's projects via URL param
 *
 * 🔒 SECURITY MODEL:
 * - Permission: projects:projects:view
 * - Tenant isolation: Regular users restricted to own company
 * - Cross-tenant: super_admin only (with audit logging)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';
// 🏢 ENTERPRISE: Role bypass check for super_admin cross-tenant access
import { isRoleBypass } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

// Response types for type-safe withAuth
type ByCompanyData = {
  projects: unknown[];
  companyId: string;
  source: string;
  cached: boolean;
};

type ByCompanySuccess = ApiSuccessResponse<ByCompanyData>;

type ByCompanyError = {
  success: false;
  error: string;
  companyId: string;
};

type ByCompanyResponse = ByCompanySuccess | ByCompanyError;

/**
 * 🏗️ GET projects for authenticated user's company
 *
 * @security URL param [companyId] is IGNORED - uses ctx.companyId for security
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ companyId: string }> }
) {
  // Extract URL param (for logging only - NOT used for query)
  const { companyId: urlCompanyId } = await segmentData.params;

  const handler = withAuth<ByCompanyResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ByCompanyResponse>> => {
      const startTime = Date.now();

      // 🏢 ENTERPRISE: Super admin can access any company's projects
      // Regular users can only access their own company's projects
      const isSuperAdmin = isRoleBypass(ctx.globalRole);

      // 🔒 SECURITY: Use URL param ONLY for super_admin, otherwise use ctx.companyId
      const companyId = isSuperAdmin ? urlCompanyId : ctx.companyId;

      // 🚨 SECURITY: Log cross-tenant access by super_admin
      if (urlCompanyId !== ctx.companyId) {
        if (isSuperAdmin) {
          console.log(`🔓 [SUPER_ADMIN] Cross-tenant access: ${ctx.email} accessing companyId=${urlCompanyId}`);
        } else {
          console.warn(`🚫 URL param mismatch detected (using authenticated scope)`);
        }
      }

      try {
        // ============================================================================
        // 1. CHECK CACHE FIRST (tenant-scoped)
        // ============================================================================

        const cachedProjects = CacheHelpers.getCachedProjectsByCompany(companyId);
        if (cachedProjects) {
          const duration = Date.now() - startTime;
          console.log(`⚡ Cache hit: ${cachedProjects.length} projects (${duration}ms)`);

          // 📊 Audit: Cache hit
          await logAuditEvent(ctx, 'data_accessed', 'projects', 'api', {
            metadata: {
              path: '/api/projects/by-company',
              reason: `Projects by company accessed (${cachedProjects.length} items from cache, ${duration}ms)`
            }
          });

          return apiSuccess({
            projects: cachedProjects,
            companyId: companyId,
            source: 'cache',
            cached: true
          }, `Found ${cachedProjects.length} cached projects`);
        }

        console.log('🔍 Cache miss - querying Firestore');

        // ============================================================================
        // 2. FETCH FROM FIRESTORE (Admin SDK + Tenant Isolation)
        // ============================================================================

        const snapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where('companyId', '==', companyId)
          .get();

        const projects = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log(`🏗️ Loaded ${snapshot.docs.length} projects from Firestore`);

        // ============================================================================
        // 3. CACHE FOR FUTURE REQUESTS
        // ============================================================================

        CacheHelpers.cacheProjectsByCompany(companyId, projects);

        const duration = Date.now() - startTime;
        console.log(`✅ Complete: ${projects.length} projects cached (${duration}ms)`);

        // 📊 Audit: Firestore load
        await logAuditEvent(ctx, 'data_accessed', 'projects', 'api', {
          metadata: {
            path: '/api/projects/by-company',
            reason: `Projects by company accessed (${projects.length} items from Firestore, ${duration}ms)`
          }
        });

        return apiSuccess({
          projects,
          companyId: companyId,
          source: 'firestore',
          cached: false
        }, `Found ${projects.length} projects`);

      } catch (error: unknown) {
        console.error('❌ Error loading projects:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : { message: String(error) },
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load projects',
            companyId: companyId
          },
          { status: 500 }
        );
      }
    },
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
}