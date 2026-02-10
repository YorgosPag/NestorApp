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
import { getAdminFirestore, getAdminDiagnostics } from '@/lib/firebaseAdmin';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import type { CompanyContact } from '@/types/contacts';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AuditBootstrapRoute');

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
 *
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function GET(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<ApiSuccessResponse<BootstrapResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleAuditBootstrap(req, ctx);
    },
    { permissions: 'projects:projects:view' }
  ));

  return handler(request);
}

async function handleAuditBootstrap(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ApiSuccessResponse<BootstrapResponse>>> {
  const startTime = Date.now();
  logger.info('[Bootstrap] Audit bootstrap load', { email: ctx.email, companyId: ctx.companyId });

  // ============================================================================
  // 0. VALIDATE FIREBASE ADMIN SDK - ENTERPRISE REQUIREMENT
  // ============================================================================

  // 🏢 ENTERPRISE: Lazy init — getAdminFirestore() throws if SDK unavailable
  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminFirestore();
  } catch (error) {
    const diag = getAdminDiagnostics();
    logger.error('[Bootstrap] Firebase Admin SDK not initialized');
    logger.error('[Bootstrap] Environment', { environment: diag.environment });
    logger.error('[Bootstrap] Error', { error: diag.error });

    throw new Error(
      `Bootstrap failed: Firebase Admin SDK not initialized. ` +
      `Environment: ${diag.environment}. ` +
      `Error: ${diag.error}. ` +
      `Required: FIREBASE_SERVICE_ACCOUNT_KEY must be configured in Vercel environment variables.`
    );
  }

  logger.info('[Bootstrap] Firebase Admin SDK validated');

  // ============================================================================
  // 1. CHECK CACHE FIRST (ROLE-BASED CACHE KEY)
  // ============================================================================

  // 🏢 ENTERPRISE RBAC: Different cache keys for admins vs regular users
  // - Admins see ALL navigation_companies → cache key: 'api:audit:bootstrap:admin'
  // - Regular users see only their company → cache key: 'api:audit:bootstrap:tenant:{companyId}'
  const isAdmin = ctx.globalRole === 'super_admin' || ctx.globalRole === 'company_admin';
  const tenantCacheKey = isAdmin
    ? `${CACHE_KEY}:admin`
    : `${CACHE_KEY}:tenant:${ctx.companyId}`;

  const cache = EnterpriseAPICache.getInstance();
  const cachedData = cache.get<BootstrapResponse>(tenantCacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    logger.info('[Bootstrap] CACHE HIT', { tenantId: ctx.companyId, companies: cachedData.companies.length, projects: cachedData.projects.length, durationMs: duration });

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

  logger.info('[Bootstrap] Cache miss - Fetching from Firestore', { tenantId: ctx.companyId, role: ctx.globalRole });

  // ============================================================================
  // 2. FETCH COMPANIES - HYBRID APPROACH (ENTERPRISE)
  // ============================================================================
  // 🏢 HYBRID APPROACH (SAP/Salesforce pattern):
  // - super_admin / company_admin → Load from navigation_companies (multi-company view)
  // - internal_user → Tenant Isolation (single-company view)
  // ============================================================================

  // Note: isAdmin already defined above for cache key selection
  let companyIds: string[] = [];
  const companyMap = new Map<string, { id: string; name: string }>();

  try {
    if (isAdmin) {
      // =========================================================================
      // 🔓 ADMIN MODE: Load from navigation_companies (multi-company view)
      // =========================================================================
      logger.info('[Bootstrap] Admin mode - Loading from navigation_companies', { globalRole: ctx.globalRole });

      // Step 1: Get all navigation company IDs
      const navCompaniesSnapshot = await adminDb
        .collection(COLLECTIONS.NAVIGATION)
        .get();

      if (navCompaniesSnapshot.empty) {
        logger.warn('[Bootstrap] No navigation companies found - admin has no companies configured');
        return apiSuccess<BootstrapResponse>(
          {
            companies: [],
            projects: [],
            loadedAt: new Date().toISOString(),
            source: 'firestore' as const,
            cached: false
          },
          'No navigation companies configured - use + button to add companies'
        );
      }

      // Extract contactIds from navigation_companies
      const navContactIds: string[] = [];
      navCompaniesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.contactId) {
          navContactIds.push(data.contactId);
        }
      });

      logger.info('[Bootstrap] Found navigation companies', { count: navContactIds.length });

      // Step 2: Fetch company details from contacts collection
      if (navContactIds.length > 0) {
        // Chunk for Firestore 'in' limit
        const contactChunks = chunkArray(navContactIds, FIRESTORE_IN_LIMIT);

        for (const chunk of contactChunks) {
          const contactsSnapshot = await adminDb
            .collection(COLLECTIONS.CONTACTS)
            .where('__name__', 'in', chunk)
            .where('type', '==', 'company')
            .get();

          contactsSnapshot.docs.forEach(doc => {
            const data = doc.data() as Partial<CompanyContact>;
            companyMap.set(doc.id, {
              id: doc.id,
              name: data.companyName || data.displayName || 'Unknown Company'
            });
            companyIds.push(doc.id);
          });
        }
      }

      logger.info('[Bootstrap] Admin loaded companies from navigation_companies', { count: companyIds.length });

    } else {
      // =========================================================================
      // 🔒 TENANT ISOLATION: Internal user sees only their company
      // =========================================================================
      logger.info('[Bootstrap] Tenant isolation mode - Loading user company only');

      if (!ctx.companyId) {
        logger.warn('[Bootstrap] User has no companyId in custom claims');
        return apiSuccess<BootstrapResponse>(
          {
            companies: [],
            projects: [],
            loadedAt: new Date().toISOString(),
            source: 'firestore' as const,
            cached: false
          },
          'User has no company assigned - contact administrator'
        );
      }

      // Fetch only user's company
      const companyDoc = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .doc(ctx.companyId)
        .get();

      if (!companyDoc.exists) {
        logger.warn('[Bootstrap] User company not found in database', { companyId: ctx.companyId });
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

      const data = companyDoc.data() as Partial<CompanyContact>;
      companyMap.set(companyDoc.id, {
        id: companyDoc.id,
        name: data?.companyName || data?.displayName || 'Unknown Company'
      });
      companyIds.push(ctx.companyId);

      logger.info('[Bootstrap] Tenant isolation - loaded 1 company', { companyId: ctx.companyId });
    }

  } catch (error) {
    logger.error('[Bootstrap] Failed to fetch companies from Firestore', {
      mode: isAdmin ? 'Admin (navigation_companies)' : 'Tenant Isolation',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw new Error(
      `Failed to fetch companies from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Mode: ${isAdmin ? 'Admin' : 'Tenant'}. ` +
      `Check Firestore security rules and Admin SDK permissions.`
    );
  }

  // ============================================================================
  // 3. FETCH ALL PROJECTS (Admin SDK with chunking for `in` limit)
  // ============================================================================

  let allProjects: BootstrapProject[] = [];

  if (companyIds.length === 0) {
    logger.warn('[Bootstrap] No companies found - returning empty projects');
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
        logger.info('[Bootstrap] Chunking companies into queries', { count: companyIds.length, chunks: Math.ceil(companyIds.length / FIRESTORE_IN_LIMIT) });

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

      logger.info('[Bootstrap] Found total projects', { count: allProjects.length });

    } catch (error) {
      logger.error('[Bootstrap] Failed to fetch projects from Firestore', {
        collection: COLLECTIONS.PROJECTS,
        companyIdsCount: companyIds.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

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
      logger.info('[Bootstrap] Found total buildings', { count: allBuildingDocs.length });

      // Count buildings per project
      allBuildingDocs.forEach(doc => {
        const projectId = doc.data().projectId;
        if (projectId) {
          const count = buildingCountByProject.get(projectId) || 0;
          buildingCountByProject.set(projectId, count + 1);
        }
      });

    } catch (error) {
      logger.error('[Bootstrap] Failed to fetch buildings from Firestore', {
        collection: COLLECTIONS.BUILDINGS,
        projectIdsCount: projectIds.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // NON-BLOCKING: Buildings are optional - continue with zero counts
      logger.warn('[Bootstrap] Continuing with zero building counts (non-critical failure)');
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
  logger.info('[Bootstrap] Complete', { tenantId: ctx.companyId, companies: companies.length, projects: allProjects.length, durationMs: duration });

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
