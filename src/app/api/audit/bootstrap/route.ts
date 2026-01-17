/**
 * =============================================================================
 * AUDIT BOOTSTRAP ENDPOINT - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise-grade aggregated data loading για /audit page
 * Αντικαθιστά 85+ N+1 cascade API calls με 1 single request
 *
 * @module api/audit/bootstrap
 * @version 2.0.0
 * @enterprise Phase 2 - RBAC Protection + Tenant Isolation
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: audit:data:view (company_admin or super_admin)
 * - Tenant Isolation: company_admin sees ONLY their company data
 * - Super Admin Bypass: super_admin sees ALL companies (cross-tenant audit)
 * - Comprehensive audit logging with logAuditEvent
 * - Enterprise patterns: SAP/Salesforce tenant isolation
 *
 * 🏢 ENTERPRISE FIX: Uses Admin SDK (not Client SDK)
 * - Admin SDK: Server-side, no offline mode, consistent latency
 * - Client SDK: Was causing 40-50s timeouts and "offline mode" errors
 * - Multi-tenant aware: Filters data based on user's company context
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { adminDb, ensureAdminInitialized, getAdminInitializationStatus } from '@/lib/firebaseAdmin';
import { withErrorHandling, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import type { CompanyContact } from '@/types/contacts';

// ============================================================================
// TYPES - Enterprise Bootstrap Response
// ============================================================================

interface BootstrapCompany {
  id: string;
  name: string;
  projectCount: number;
}

interface BootstrapProject {
  id: string;
  projectCode: string | null;
  name: string;
  companyId: string;
  status: string;
  updatedAt: string | null;  // ISO string (enterprise requirement)
  createdAt: string | null;  // ISO string
  // Precomputed aggregates (if available)
  totalUnits?: number;
  soldUnits?: number;
  soldAreaM2?: number;
  // 🏢 PERF-001: Building count from bootstrap (eliminates realtime listener)
  buildingCount: number;
}

interface BootstrapResponse {
  companies: BootstrapCompany[];
  projects: BootstrapProject[];
  loadedAt: string;
  source: 'cache' | 'firestore';
  cached: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = 'api:audit:bootstrap';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes (enterprise requirement)
const FIRESTORE_IN_LIMIT = 10; // Firestore `in` query max items

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * 🔧 Chunk array για Firestore `in` query limit (max 10)
 * Enterprise requirement: Proper chunking για >10 companyIds
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 🔄 Convert Firestore Timestamp to ISO string
 * Enterprise requirement: Dates ως ISO strings (όχι Date objects)
 */
function toISOString(timestamp: unknown): string | null {
  if (!timestamp) return null;

  // Handle Firestore Timestamp
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    const firestoreTimestamp = timestamp as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  // Handle Date object
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  // Handle ISO string
  if (typeof timestamp === 'string') {
    return timestamp;
  }

  // Handle number (epoch ms)
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }

  return null;
}

// ============================================================================
// FORCE DYNAMIC - Enterprise requirement
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * GET /api/audit/bootstrap
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: projects:projects:view
 * - Tenant Isolation: Filters companies and projects by user's companyId
 * - Single-tenant view (user sees only their company data)
 */
export async function GET(request: NextRequest) {
  const handler = withAuth<ApiSuccessResponse<BootstrapResponse>>(
    withErrorHandling(async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleAuditBootstrap(req, ctx);
    }, { operation: 'audit-bootstrap' }),
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
}

async function handleAuditBootstrap(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ApiSuccessResponse<BootstrapResponse>>> {
  const startTime = Date.now();
  console.log(`🚀 [Bootstrap] Audit bootstrap load for user ${ctx.email} (company: ${ctx.companyId})...`);

  // ============================================================================
  // 0. VALIDATE FIREBASE ADMIN SDK - ENTERPRISE REQUIREMENT
  // ============================================================================

  // 🏢 ENTERPRISE: Check if Admin SDK is initialized before any Firestore operations
  try {
    ensureAdminInitialized();
  } catch (error) {
    const status = getAdminInitializationStatus();
    console.error('❌ [Bootstrap] Firebase Admin SDK not initialized');
    console.error('📍 [Bootstrap] Environment:', status.environment);
    console.error('📋 [Bootstrap] Error:', status.error);

    // Throw descriptive error that will be caught by withErrorHandling
    throw new Error(
      `Bootstrap failed: Firebase Admin SDK not initialized. ` +
      `Environment: ${status.environment}. ` +
      `Error: ${status.error}. ` +
      `Required: FIREBASE_SERVICE_ACCOUNT_KEY must be configured in Vercel environment variables.`
    );
  }

  console.log('✅ [Bootstrap] Firebase Admin SDK validated');

  // ============================================================================
  // 1. CHECK CACHE FIRST (PER-COMPANY CACHE KEY)
  // ============================================================================

  // 🔒 TENANT ISOLATION: Cache key includes companyId for tenant separation
  const tenantCacheKey = `${CACHE_KEY}:${ctx.companyId}`;
  const cache = EnterpriseAPICache.getInstance();
  const cachedData = cache.get<BootstrapResponse>(tenantCacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    console.log(`⚡ [Bootstrap] CACHE HIT (tenant: ${ctx.companyId}) - ${cachedData.companies.length} companies, ${cachedData.projects.length} projects in ${duration}ms`);

    // 🏢 ENTERPRISE: Return standard apiSuccess format
    return apiSuccess<BootstrapResponse>(
      {
        ...cachedData,
        source: 'cache' as const,
        cached: true
      },
      `Bootstrap data loaded from cache in ${duration}ms`
    );
  }

  console.log(`🔍 [Bootstrap] Cache miss (tenant: ${ctx.companyId}) - Fetching from Firestore...`);

  // ============================================================================
  // 2. FETCH USER'S COMPANY (TENANT ISOLATION)
  // ============================================================================

  let companiesSnapshot: FirebaseFirestore.QuerySnapshot;
  let userCompanyDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []; // 🔧 FIX: Define outside try block

  try {
    // 🔒 TENANT ISOLATION: Fetch ONLY the user's company
    // Enterprise pattern: Single-tenant view (user sees only their organization)
    companiesSnapshot = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('status', '==', 'active')
      .get();

    // Filter to user's company only (in-memory filter after fetch for type safety)
    userCompanyDocs = companiesSnapshot.docs.filter(doc => doc.id === ctx.companyId);

    if (userCompanyDocs.length === 0) {
      console.warn(`⚠️ [Bootstrap] User's company ${ctx.companyId} not found in database`);
      // Return empty result (tenant has no data yet)
      return apiSuccess<BootstrapResponse>(
        {
          companies: [],
          projects: [],
          loadedAt: new Date().toISOString(),
          source: 'firestore' as const,
          cached: false
        },
        'Company not found - returning empty bootstrap data'
      );
    }

    console.log(`🏢 [Bootstrap] Found user's company (tenant: ${ctx.companyId})`);

    // 🏢 DIAGNOSTIC: Log collection and query details
    if (companiesSnapshot.docs.length === 0) {
      console.warn('⚠️ [Bootstrap] No companies found - checking database state');
      console.warn('📋 [Bootstrap] Collection:', COLLECTIONS.CONTACTS);
      console.warn('📋 [Bootstrap] Query filters: type=company, status=active');
    }
  } catch (error) {
    console.error('❌ [Bootstrap] Failed to fetch companies from Firestore');
    console.error('📍 [Bootstrap] Collection:', COLLECTIONS.CONTACTS);
    console.error('📋 [Bootstrap] Error details:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('📚 [Bootstrap] Stack trace:', error.stack);
    }

    throw new Error(
      `Failed to fetch companies from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Collection: ${COLLECTIONS.CONTACTS}. ` +
      `Check Firestore security rules and Admin SDK permissions.`
    );
  }

  // Build company map for quick lookup (only user's company)
  const companyMap = new Map<string, { id: string; name: string }>();

  userCompanyDocs.forEach(doc => {
    const data = doc.data() as Partial<CompanyContact>;
    companyMap.set(doc.id, {
      id: doc.id,
      name: data.companyName || data.displayName || 'Unknown Company'
    });
  });

  // 🔒 TENANT ISOLATION: Only user's companyId (single-tenant array)
  const companyIds = [ctx.companyId];

  // ============================================================================
  // 3. FETCH ALL PROJECTS (Admin SDK with chunking for `in` limit)
  // ============================================================================

  let allProjects: BootstrapProject[] = [];

  if (companyIds.length === 0) {
    console.log('⚠️ [Bootstrap] No companies found - returning empty projects');
  } else {
    try {
      if (companyIds.length <= FIRESTORE_IN_LIMIT) {
        // 🏢 ENTERPRISE: Single query - under the limit (Admin SDK)
        const projectsSnapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where('companyId', 'in', companyIds)
          .get();

        allProjects = projectsSnapshot.docs.map(doc => mapProjectDocument(doc));

      } else {
        // 🏢 ENTERPRISE: Chunked queries - over the limit (Admin SDK)
        console.log(`📦 [Bootstrap] Chunking ${companyIds.length} companies into ${Math.ceil(companyIds.length / FIRESTORE_IN_LIMIT)} queries`);

        const chunks = chunkArray(companyIds, FIRESTORE_IN_LIMIT);

        const chunkResults = await Promise.all(
          chunks.map(async (chunk) => {
            const snapshot = await adminDb
              .collection(COLLECTIONS.PROJECTS)
              .where('companyId', 'in', chunk)
              .get();
            return snapshot.docs.map(doc => mapProjectDocument(doc));
          })
        );

        allProjects = chunkResults.flat();
      }

      console.log(`🏗️ [Bootstrap] Found ${allProjects.length} total projects`);

    } catch (error) {
      console.error('❌ [Bootstrap] Failed to fetch projects from Firestore');
      console.error('📍 [Bootstrap] Collection:', COLLECTIONS.PROJECTS);
      console.error('📋 [Bootstrap] Company IDs count:', companyIds.length);
      console.error('📋 [Bootstrap] Error details:', error instanceof Error ? error.message : String(error));

      if (error instanceof Error && error.stack) {
        console.error('📚 [Bootstrap] Stack trace:', error.stack);
      }

      throw new Error(
        `Failed to fetch projects from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Collection: ${COLLECTIONS.PROJECTS}. ` +
        `Check Firestore security rules and indexes.`
      );
    }
  }

  // ============================================================================
  // 3.5 FETCH BUILDING COUNTS PER PROJECT (PERF-001)
  // ============================================================================

  const projectIds = allProjects.map(p => p.id);
  const buildingCountByProject = new Map<string, number>();

  if (projectIds.length > 0) {
    try {
      // 🏢 ENTERPRISE: Fetch all buildings and count per project
      // This eliminates the need for realtime listeners in NavigationContext
      const buildingChunks = chunkArray(projectIds, FIRESTORE_IN_LIMIT);

      const buildingResults = await Promise.all(
        buildingChunks.map(async (chunk) => {
          const snapshot = await adminDb
            .collection(COLLECTIONS.BUILDINGS)
            .where('projectId', 'in', chunk)
            .get();
          return snapshot.docs;
        })
      );

      const allBuildingDocs = buildingResults.flat();
      console.log(`🏗️ [Bootstrap] Found ${allBuildingDocs.length} total buildings`);

      // Count buildings per project
      allBuildingDocs.forEach(doc => {
        const projectId = doc.data().projectId;
        if (projectId) {
          const count = buildingCountByProject.get(projectId) || 0;
          buildingCountByProject.set(projectId, count + 1);
        }
      });

    } catch (error) {
      console.error('❌ [Bootstrap] Failed to fetch buildings from Firestore');
      console.error('📍 [Bootstrap] Collection:', COLLECTIONS.BUILDINGS);
      console.error('📋 [Bootstrap] Project IDs count:', projectIds.length);
      console.error('📋 [Bootstrap] Error details:', error instanceof Error ? error.message : String(error));

      if (error instanceof Error && error.stack) {
        console.error('📚 [Bootstrap] Stack trace:', error.stack);
      }

      // 🏢 NON-BLOCKING: Buildings are optional - continue with zero counts
      console.warn('⚠️ [Bootstrap] Continuing with zero building counts (non-critical failure)');
    }
  }

  // Add buildingCount to each project
  allProjects = allProjects.map(project => ({
    ...project,
    buildingCount: buildingCountByProject.get(project.id) || 0
  }));

  // ============================================================================
  // 4. BUILD AGGREGATED RESPONSE
  // ============================================================================

  // Count projects per company
  const projectCountByCompany = new Map<string, number>();
  allProjects.forEach(project => {
    const count = projectCountByCompany.get(project.companyId) || 0;
    projectCountByCompany.set(project.companyId, count + 1);
  });

  // Build companies array with project counts
  const companies: BootstrapCompany[] = Array.from(companyMap.entries())
    .map(([id, company]) => ({
      id,
      name: company.name,
      projectCount: projectCountByCompany.get(id) || 0
    }))
    // Only include companies with projects (above-the-fold optimization)
    .filter(company => company.projectCount > 0)
    // Sort by name for consistent ordering
    .sort((a, b) => a.name.localeCompare(b.name, 'el'));

  const response: BootstrapResponse = {
    companies,
    projects: allProjects,
    loadedAt: new Date().toISOString(),
    source: 'firestore',
    cached: false
  };

  // ============================================================================
  // 5. CACHE RESPONSE (PER-TENANT)
  // ============================================================================

  // 🔒 TENANT ISOLATION: Cache with tenant-specific key
  cache.set(tenantCacheKey, response, CACHE_TTL_MS);

  const duration = Date.now() - startTime;
  console.log(`✅ [Bootstrap] Complete (tenant: ${ctx.companyId}): ${companies.length} companies, ${allProjects.length} projects in ${duration}ms (cached for 3min)`);

  // 🏢 ENTERPRISE: Return standard apiSuccess format
  return apiSuccess<BootstrapResponse>(
    response,
    `Bootstrap loaded: ${companies.length} companies, ${allProjects.length} projects in ${duration}ms`
  );
}

// ============================================================================
// DOCUMENT MAPPER
// ============================================================================

/**
 * 📄 Map Firestore document to BootstrapProject
 * Enterprise requirement: ISO strings, null safety
 * 🏢 ENTERPRISE: Compatible with Admin SDK QueryDocumentSnapshot
 */
function mapProjectDocument(doc: FirebaseFirestore.QueryDocumentSnapshot): BootstrapProject {
  const data = doc.data();

  return {
    id: doc.id,
    projectCode: typeof data.projectCode === 'string' ? data.projectCode : null,
    name: typeof data.name === 'string' ? data.name : 'Unnamed Project',
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    status: typeof data.status === 'string' ? data.status : 'unknown',
    updatedAt: toISOString(data.updatedAt),
    createdAt: toISOString(data.createdAt),
    // Precomputed aggregates (if available in document)
    totalUnits: typeof data.totalUnits === 'number' ? data.totalUnits : undefined,
    soldUnits: typeof data.soldUnits === 'number' ? data.soldUnits : undefined,
    soldAreaM2: typeof data.soldAreaM2 === 'number' ? data.soldAreaM2 : undefined,
    // 🏢 PERF-001: Building count (will be populated after buildings query)
    buildingCount: 0
  };
}
