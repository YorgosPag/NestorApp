/**
 * 🏗️ PROJECTS BY COMPANY ENDPOINT
 *
 * @module api/projects/by-company/[companyId]
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: CRITICAL SECURITY FIX
 *
 * 🚨 SECURITY FIX:
 * - Migrated from Client SDK to Admin SDK
 * - Added withAuth + RBAC protection
 * - CRITICAL: URL param [companyId] is IGNORED for security
 * - Always uses ctx.companyId from authenticated user
 * - Prevents cross-tenant data breach via URL manipulation
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view
 * - Tenant isolation: Uses ctx.companyId ONLY (URL param ignored)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

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
      // 🔒 SECURITY: Use authenticated user's companyId ONLY
      const companyId = ctx.companyId;

      console.log(`🏗️ [Projects/ByCompany] Loading projects for company: ${companyId}`);
      console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${companyId}`);

      // 🚨 SECURITY WARNING: Log if URL param doesn't match authenticated companyId
      if (urlCompanyId !== companyId) {
        console.warn(`🚫 SECURITY: URL param mismatch - URL: ${urlCompanyId}, Auth: ${companyId} (using Auth companyId)`);
      }

      try {
        // ============================================================================
        // 1. CHECK CACHE FIRST (tenant-scoped)
        // ============================================================================

        const cachedProjects = CacheHelpers.getCachedProjectsByCompany(companyId);
        if (cachedProjects) {
          console.log(`⚡ [Projects/ByCompany] CACHE HIT - ${cachedProjects.length} projects for company ${companyId}`);
          return apiSuccess({
            projects: cachedProjects,
            companyId: companyId,
            source: 'cache',
            cached: true
          }, `Found ${cachedProjects.length} cached projects`);
        }

        console.log('🔍 [Projects/ByCompany] Cache miss - Fetching from Firestore...');

        // ============================================================================
        // 2. FETCH FROM FIRESTORE (Admin SDK + Tenant Isolation)
        // ============================================================================

        const snapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where('companyId', '==', companyId)
          .get();

        console.log(`🏗️ [Projects/ByCompany] Found ${snapshot.docs.length} projects for tenant ${companyId}`);

        const projects = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // ============================================================================
        // 3. CACHE FOR FUTURE REQUESTS
        // ============================================================================

        CacheHelpers.cacheProjectsByCompany(companyId, projects);
        console.log(`✅ [Projects/ByCompany] Complete: ${projects.length} projects (cached for 3 minutes)`);

        return apiSuccess({
          projects,
          companyId: companyId,
          source: 'firestore',
          cached: false
        }, `Found ${projects.length} projects`);

      } catch (error: unknown) {
        console.error('❌ [Projects/ByCompany] Error:', {
          companyId: companyId,
          userId: ctx.uid,
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