/**
 * 🏗️ PROJECTS LIST ENDPOINT
 *
 * Enterprise-grade endpoint για loading ALL projects για audit grid.
 * Διαχωρισμένο από /api/audit/bootstrap (Option A architecture).
 *
 * @module api/projects/list
 * @version 1.0.0
 * @enterprise Phase 3 - Data Architecture Separation
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection + tenant isolation
 *
 * 🏢 ARCHITECTURE:
 * - Admin SDK (server-side, consistent latency)
 * - withAuth + tenant isolation (CRITICAL security fix)
 * - Short TTL caching (30s for near-realtime updates)
 * - Type-safe field extraction (no type assertions)
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';

// ============================================================================
// TYPES - Project List Response
// ============================================================================

interface ProjectListItem {
  id: string;
  name: string;
  title: string;
  status: string;
  company: string;
  companyId: string;
  address: string;
  city: string;
  progress: number;
  totalValue: number;
  totalArea: number;
  startDate: string;
  completionDate: string;
  lastUpdate: string;
}

interface ProjectListResponse {
  projects: ProjectListItem[];
  count: number;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY_PREFIX = 'api:projects:list';

/**
 * Generate tenant-specific cache key
 * TTL managed by EnterpriseAPICache (30s for projectsList - near-realtime)
 * 🏢 Super Admin gets 'all' cache key for cross-tenant access
 */
function getTenantCacheKey(companyId: string, isSuperAdmin: boolean): string {
  return isSuperAdmin ? `${CACHE_KEY_PREFIX}:all` : `${CACHE_KEY_PREFIX}:${companyId}`;
}

// ============================================================================
// TYPE-SAFE FIELD EXTRACTORS
// ============================================================================

/**
 * 🔒 ENTERPRISE: Type-safe string extraction (no type assertions)
 */
function getString(data: Record<string, unknown>, field: string, defaultValue: string = ''): string {
  const value = data[field];
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * 🔒 ENTERPRISE: Type-safe number extraction
 */
function getNumber(data: Record<string, unknown>, field: string, defaultValue: number = 0): number {
  const value = data[field];
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * 🔒 ENTERPRISE: Type-safe timestamp to ISO string
 */
function getTimestampString(data: Record<string, unknown>, field: string): string {
  const value = data[field];

  if (!value) return '';

  // Handle Firestore Timestamp
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const firestoreTimestamp = value as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  // Handle Date object
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle ISO string
  if (typeof value === 'string') {
    return value;
  }

  // Handle number (epoch ms)
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  return '';
}

// ============================================================================
// STATUS NORMALIZER
// ============================================================================

/**
 * 🔒 ENTERPRISE: Normalize status to canonical values
 */
function normalizeStatus(status: string): string {
  if (status === 'construction' || status === 'active') {
    return 'in_progress';
  }
  return status || 'unknown';
}

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const handler = withAuth<ApiSuccessResponse<ProjectListResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const startTime = Date.now();

      // 🏢 ENTERPRISE: Check if user is Super Admin for cross-tenant access
      const isSuperAdmin = ctx.globalRole === 'super_admin';
      console.log(`🏗️ [Projects/List] Starting projects list load... (Super Admin: ${isSuperAdmin})`);

      // ============================================================================
      // 1. CHECK TENANT-SPECIFIC CACHE FIRST
      // ============================================================================

      const cache = EnterpriseAPICache.getInstance();
      const tenantCacheKey = getTenantCacheKey(ctx.companyId, isSuperAdmin);
      const cachedData = cache.get<ProjectListResponse>(tenantCacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    console.log(`⚡ [Projects/List] CACHE HIT - ${cachedData.count} projects in ${duration}ms`);

    // Audit event for cache hit
    await logAuditEvent(ctx, 'data_accessed', 'projects', 'api', {
      metadata: {
        path: '/api/projects/list',
        reason: `Projects list accessed (${cachedData.count} items from cache, ${duration}ms)`
      }
    });

    return apiSuccess<ProjectListResponse>({
      ...cachedData,
      source: 'cache'
    }, `Projects loaded from cache in ${duration}ms`);
  }

      console.log('🔍 [Projects/List] Cache miss - Fetching from Firestore...');

      // ============================================================================
      // 2. FETCH PROJECTS (Admin SDK)
      // 🏢 ENTERPRISE: Super Admin gets ALL projects, others get tenant-scoped
      // ============================================================================

      let projectsSnapshot;
      if (isSuperAdmin) {
        // 🏢 Super Admin: Fetch ALL projects across all companies
        console.log('👑 [Projects/List] Super Admin - Fetching ALL projects...');
        projectsSnapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .get();
      } else {
        // 🔒 Regular user: Tenant-scoped (only their company)
        projectsSnapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where('companyId', '==', ctx.companyId)
          .get();
      }

      console.log(`🏗️ [Projects/List] Found ${projectsSnapshot.docs.length} projects`);

  // ============================================================================
  // 3. MAP TO ProjectListItem (type-safe)
  // ============================================================================

  const projects: ProjectListItem[] = projectsSnapshot.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;

    return {
      id: doc.id,
      name: getString(data, 'name', 'Unnamed Project'),
      title: getString(data, 'title') || getString(data, 'name', 'Unnamed Project'),
      status: normalizeStatus(getString(data, 'status')),
      company: getString(data, 'company'),
      companyId: getString(data, 'companyId'),
      address: getString(data, 'address'),
      city: getString(data, 'city'),
      progress: getNumber(data, 'progress'),
      totalValue: getNumber(data, 'totalValue'),
      totalArea: getNumber(data, 'totalArea'),
      startDate: getTimestampString(data, 'startDate'),
      completionDate: getTimestampString(data, 'completionDate'),
      lastUpdate: getTimestampString(data, 'lastUpdate') || getTimestampString(data, 'updatedAt')
    };
  });

  // ============================================================================
  // 4. BUILD RESPONSE
  // ============================================================================

  const response: ProjectListResponse = {
    projects,
    count: projects.length,
    loadedAt: new Date().toISOString(),
    source: 'firestore'
  };

  // ============================================================================
  // 5. CACHE RESPONSE (TTL managed by EnterpriseAPICache.getTTLForKey)
  // ============================================================================

  cache.set(tenantCacheKey, response);

  const duration = Date.now() - startTime;
  console.log(`✅ [Projects/List] Complete: ${projects.length} projects in ${duration}ms`);

  // ============================================================================
  // 6. AUDIT EVENT (Enterprise compliance)
  // ============================================================================

  await logAuditEvent(ctx, 'data_accessed', 'projects', 'api', {
    metadata: {
      path: '/api/projects/list',
      reason: `Projects list accessed (${projects.length} items from firestore, ${duration}ms)`
    }
  });

  return apiSuccess<ProjectListResponse>(response, `Projects loaded in ${duration}ms`);
    },
    {
      permissions: 'projects:projects:view'
    }
  );

  return handler(request);
}
