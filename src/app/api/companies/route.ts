import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { CompanyContact, ContactStatus } from '@/types/contacts';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';

// ============================================================================
// 🏢 ENTERPRISE: Admin SDK Companies Endpoint
// ============================================================================
//
// ARCHITECTURE DECISION:
// Χρησιμοποιεί Admin SDK (server-side) αντί για Client SDK
//
// ΑΙΤΙΟΛΟΓΗΣΗ:
// 1. Τα Firestore Security Rules απαιτούν authentication (request.auth != null)
// 2. Το Client SDK στον server ΔΕΝ έχει authentication context
// 3. Μόνο το Admin SDK μπορεί να παρακάμψει τα security rules
//
// PATTERN: Data Mapper Pattern (Enterprise)
// - Separates domain model from persistence model
// - Type-safe transformation from Firestore to TypeScript
// - Validation at the boundary
//
// ============================================================================

// ============================================================================
// FIRESTORE RAW DATA INTERFACE
// ============================================================================

/**
 * 🏢 Enterprise: Raw Firestore document data interface
 * Represents the actual data structure stored in Firestore
 */
interface FirestoreCompanyData {
  companyName?: string;
  legalName?: string;
  tradeName?: string;
  vatNumber?: string;
  companyVatNumber?: string; // Legacy field
  status?: string;
  type?: string;
  industry?: string;
  sector?: string;
  notes?: string;
  tags?: string[];
  isFavorite?: boolean;
  logoURL?: string;
  emails?: unknown[];
  phones?: unknown[];
  addresses?: unknown[];
  websites?: unknown[];
  socialMedia?: unknown[];
  contactPersons?: unknown[];
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  lastModifiedBy?: string;
  [key: string]: unknown; // Allow additional fields
}

// ============================================================================
// DATA MAPPER - ENTERPRISE PATTERN
// ============================================================================

/**
 * 🏢 Enterprise Data Mapper: Firestore → CompanyContact
 *
 * Transforms raw Firestore data to type-safe CompanyContact.
 * Follows the Data Mapper pattern used in SAP, Salesforce, Microsoft Dynamics.
 *
 * @param docId - Firestore document ID
 * @param data - Raw Firestore document data
 * @returns Type-safe CompanyContact object
 */
function mapFirestoreToCompanyContact(
  docId: string,
  data: FirestoreCompanyData
): CompanyContact {
  // Extract company name with fallback chain
  const companyName = data.companyName || data.tradeName || data.legalName || 'Unknown Company';

  // Extract VAT number (handle legacy field)
  const vatNumber = data.vatNumber || data.companyVatNumber || '';

  // Validate and cast status
  const rawStatus = data.status || 'active';
  const status: ContactStatus = isValidContactStatus(rawStatus) ? rawStatus : 'active';

  // Convert timestamp to Date if needed
  const now = new Date();
  const createdAt = parseFirestoreTimestamp(data.createdAt) || now;
  const updatedAt = parseFirestoreTimestamp(data.updatedAt) || now;

  return {
    // Required fields from BaseContact
    id: docId,
    type: 'company',
    status,
    isFavorite: data.isFavorite ?? false,
    createdAt,
    updatedAt,

    // Required field from CompanyContact
    companyName,
    vatNumber,

    // Optional fields
    legalName: data.legalName,
    tradeName: data.tradeName,
    industry: data.industry,
    sector: data.sector,
    notes: data.notes,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    logoURL: data.logoURL,
    createdBy: data.createdBy,
    lastModifiedBy: data.lastModifiedBy,

    // Arrays - only include if they are valid arrays
    emails: Array.isArray(data.emails) ? data.emails as CompanyContact['emails'] : undefined,
    phones: Array.isArray(data.phones) ? data.phones as CompanyContact['phones'] : undefined,
    addresses: Array.isArray(data.addresses) ? data.addresses as CompanyContact['addresses'] : undefined,
    websites: Array.isArray(data.websites) ? data.websites as CompanyContact['websites'] : undefined,
    socialMedia: Array.isArray(data.socialMedia) ? data.socialMedia as CompanyContact['socialMedia'] : undefined,
    contactPersons: Array.isArray(data.contactPersons) ? data.contactPersons as CompanyContact['contactPersons'] : undefined,
  };
}

/**
 * 🔧 Helper: Validate ContactStatus
 */
function isValidContactStatus(status: string): status is ContactStatus {
  return ['active', 'inactive', 'archived'].includes(status);
}

/**
 * 🔧 Helper: Parse Firestore Timestamp to Date
 */
function parseFirestoreTimestamp(timestamp: unknown): Date | null {
  if (!timestamp) return null;

  // Handle Firestore Timestamp object
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    const firestoreTs = timestamp as { toDate: () => Date };
    return firestoreTs.toDate();
  }

  // Handle Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // Handle ISO string
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Handle epoch milliseconds
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  return null;
}

// ============================================================================
// RESPONSE TYPES (Type-safe withAuth)
// ============================================================================

interface CompaniesResponse {
  companies: CompanyContact[];
  count: number;
  cached: boolean;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * GET /api/companies
 *
 * List active companies relevant to user's organization.
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: crm:contacts:view
 * - Tenant Isolation: Filters projects by user's companyId
 *
 * @rateLimit HIGH (100 req/min) - List endpoint με enterprise caching
 */
export const GET = withHighRateLimit(async function GET(request: NextRequest) {
  const handler = withAuth<CompaniesResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<CompaniesResponse>> => {
      return handleGetCompanies(req, ctx);
    },
    { permissions: 'crm:contacts:view' }
  );

  return handler(request);
});

async function handleGetCompanies(request: NextRequest, ctx: AuthContext): Promise<NextResponse<CompaniesResponse>> {
  console.log(`🏢 API: Loading companies for user ${ctx.email} (company: ${ctx.companyId}, role: ${ctx.globalRole})...`);

  // =========================================================================
  // 🏢 ENTERPRISE RBAC: Unified authorization logic
  // Same pattern as /api/audit/bootstrap (SAP/Salesforce standard)
  // =========================================================================
  const isAdmin = ctx.globalRole === 'super_admin' || ctx.globalRole === 'company_admin';

  try {
    // =========================================================================
    // STEP 0: Check cache first (Enterprise Caching - per-tenant)
    // =========================================================================
    // 🔒 TENANT ISOLATION: Cache key includes role for proper separation
    const tenantCacheKey = isAdmin ? 'companies:admin' : `companies:tenant:${ctx.companyId}`;
    const cachedCompanies = CacheHelpers.getCachedCompanies(tenantCacheKey);
    if (cachedCompanies) {
      console.log(`⚡ API: CACHE HIT (${tenantCacheKey}) - Returning ${cachedCompanies.length} cached companies`);
      // 🏢 ENTERPRISE: Type-safe cache return with proper cast
      return NextResponse.json({
        companies: cachedCompanies as CompanyContact[],
        count: cachedCompanies.length,
        cached: true
      });
    }

    console.log(`🔍 API: Cache miss (${tenantCacheKey}) - Fetching from Firestore with Admin SDK...`);

    // =========================================================================
    // 🏢 ENTERPRISE RBAC: Role-based company loading
    // =========================================================================
    let relevantCompanies: CompanyContact[] = [];

    if (isAdmin) {
      // =====================================================================
      // 🔓 ADMIN MODE: Load from navigation_companies (multi-company view)
      // Same logic as /api/audit/bootstrap for admins
      // =====================================================================
      console.log(`👑 API: Admin mode (${ctx.globalRole}) - Loading from navigation_companies...`);

      // Step 1: Get navigation company IDs
      const navigationSnapshot = await getAdminFirestore()
        .collection(COLLECTIONS.NAVIGATION)
        .get();

      const navigationCompanyIds: string[] = [];
      navigationSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const contactId = data.contactId;
        if (typeof contactId === 'string' && contactId.length > 0) {
          navigationCompanyIds.push(contactId);
        }
      });

      console.log(`📍 API: Navigation company IDs: ${navigationCompanyIds.length}`);

      if (navigationCompanyIds.length === 0) {
        console.warn('⚠️ API: No navigation companies found - admin has no companies configured');
        return NextResponse.json({
          companies: [],
          count: 0,
          cached: false
        });
      }

      // Step 2: Get company details from contacts
      const companiesSnapshot = await getAdminFirestore()
        .collection(COLLECTIONS.CONTACTS)
        .where('type', '==', 'company')
        .where('status', '==', 'active')
        .get();

      // Build company map
      const companyMap = new Map<string, CompanyContact>();
      companiesSnapshot.docs.forEach(doc => {
        const rawData = doc.data() as FirestoreCompanyData;
        const company = mapFirestoreToCompanyContact(doc.id, rawData);
        companyMap.set(doc.id, company);
      });

      // Step 3: Filter to navigation companies only
      for (const companyId of navigationCompanyIds) {
        const company = companyMap.get(companyId);
        if (company) {
          relevantCompanies.push(company);
        } else {
          console.log(`⚠️ API: Navigation company ${companyId} not found in active contacts`);
        }
      }

      console.log(`🏢 API: Admin loaded ${relevantCompanies.length} companies from navigation_companies`);

    } else {
      // =====================================================================
      // 🔒 TENANT ISOLATION: Internal user sees only their company
      // Same logic as /api/audit/bootstrap for non-admins
      // =====================================================================
      console.log(`🔒 API: Tenant isolation mode (${ctx.globalRole}) - Loading user's company only...`);

      if (!ctx.companyId) {
        console.warn('⚠️ API: User has no companyId in custom claims');
        return NextResponse.json({
          companies: [],
          count: 0,
          cached: false
        });
      }

      // Fetch only user's company
      const companyDoc = await getAdminFirestore()
        .collection(COLLECTIONS.CONTACTS)
        .doc(ctx.companyId)
        .get();

      if (!companyDoc.exists) {
        console.warn(`⚠️ API: User's company ${ctx.companyId} not found in database`);
        return NextResponse.json({
          companies: [],
          count: 0,
          cached: false
        });
      }

      const rawData = companyDoc.data() as FirestoreCompanyData;
      const company = mapFirestoreToCompanyContact(companyDoc.id, rawData);
      relevantCompanies.push(company);

      console.log(`🏢 API: Tenant isolation - loaded 1 company: ${company.companyName}`);
    }

    // =========================================================================
    // STEP FINAL: Cache and return
    // =========================================================================
    CacheHelpers.cacheCompanies(relevantCompanies, tenantCacheKey);

    console.log(`✅ API: Found ${relevantCompanies.length} companies (cached for 5 minutes)`);

    return NextResponse.json({
      companies: relevantCompanies,
      count: relevantCompanies.length,
      cached: false
    });

  } catch (error: unknown) {
    console.error('❌ API: Error loading companies:', error);

    // Enhanced error details for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      timestamp: new Date().toISOString()
    };

    console.error('❌ API: Detailed error info:', errorDetails);

    throw error; // Propagate to withAuth error handler
  }
}
