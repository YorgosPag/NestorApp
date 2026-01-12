import { NextRequest } from 'next/server';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { adminDb } from '@/lib/firebaseAdmin';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { CompanyContact, ContactStatus } from '@/types/contacts';

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
// API HANDLER
// ============================================================================

export const GET = withErrorHandling(async (request: NextRequest) => {
  console.log('🏢 API: Loading active companies (Admin SDK)...');

  try {
    // =========================================================================
    // STEP 0: Check cache first (Enterprise Caching)
    // =========================================================================
    const cachedCompanies = CacheHelpers.getCachedCompanies();
    if (cachedCompanies) {
      console.log(`⚡ API: CACHE HIT - Returning ${cachedCompanies.length} cached companies`);
      return apiSuccess({
        companies: cachedCompanies,
        count: cachedCompanies.length,
        cached: true
      }, `Found ${cachedCompanies.length} cached companies`);
    }

    console.log('🔍 API: Cache miss - Fetching from Firestore with Admin SDK...');

    // =========================================================================
    // STEP 1: Get navigation company IDs (manual additions)
    // =========================================================================
    const navigationSnapshot = await adminDb
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

    console.log(`📍 API: Navigation company IDs: ${navigationCompanyIds.length}`, navigationCompanyIds);

    // =========================================================================
    // STEP 2: Get all active companies from contacts
    // =========================================================================
    const companiesSnapshot = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('status', '==', 'active')
      .get();

    console.log(`🏢 API: Found ${companiesSnapshot.docs.length} active companies in contacts`);

    // Build company map using Data Mapper pattern
    const companyMap = new Map<string, CompanyContact>();
    companiesSnapshot.docs.forEach(doc => {
      const rawData = doc.data() as FirestoreCompanyData;
      const company = mapFirestoreToCompanyContact(doc.id, rawData);
      companyMap.set(doc.id, company);
    });

    // =========================================================================
    // STEP 3: Get companies that have projects
    // =========================================================================
    const projectsSnapshot = await adminDb
      .collection(COLLECTIONS.PROJECTS)
      .get();

    const companiesWithProjects = new Set<string>();
    projectsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const companyId = data.companyId;
      if (typeof companyId === 'string' && companyMap.has(companyId)) {
        companiesWithProjects.add(companyId);
      }
    });

    console.log(`🏗️ API: Companies with projects: ${companiesWithProjects.size}`);

    // =========================================================================
    // STEP 4: Combine navigation + projects (unique)
    // =========================================================================
    const allRelevantCompanyIds = new Set([
      ...navigationCompanyIds,
      ...Array.from(companiesWithProjects)
    ]);

    console.log(`🎯 API: Total relevant company IDs: ${allRelevantCompanyIds.size}`, Array.from(allRelevantCompanyIds));

    // =========================================================================
    // STEP 5: Filter and return relevant companies
    // =========================================================================
    const relevantCompanies: CompanyContact[] = [];

    // Convert Set to Array for iteration (TypeScript ES5 compatibility)
    const relevantIdsArray = Array.from(allRelevantCompanyIds);

    for (const companyId of relevantIdsArray) {
      const company = companyMap.get(companyId);
      if (company) {
        relevantCompanies.push(company);
        console.log(`✅ API: Including company: ${company.id} - ${company.companyName}`);
      } else {
        console.log(`⚠️ API: Company ${companyId} not found in active companies map`);
      }
    }

    // =========================================================================
    // STEP 6: Cache and return
    // =========================================================================
    CacheHelpers.cacheCompanies(relevantCompanies);

    console.log(`✅ API: Found ${relevantCompanies.length} active companies (cached for 5 minutes)`);

    return apiSuccess({
      companies: relevantCompanies,
      count: relevantCompanies.length,
      cached: false
    }, `Found ${relevantCompanies.length} active companies`);

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

    throw error; // Let withErrorHandling handle the response
  }
}, {
  operation: 'loadActiveCompanies',
  entityType: 'companies',
  entityId: 'all'
});