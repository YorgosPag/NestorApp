import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SearchIndividualsRoute');

interface IndividualResult {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  amka: string | null;
}

interface SearchResponseData {
  contacts: IndividualResult[];
  count: number;
}

/**
 * 🏢 ENTERPRISE: Search individual contacts (for worker assignment)
 *
 * @route GET /api/contacts/search-individuals?q=term&exclude=id1,id2
 * @returns Tenant-scoped individual contacts matching search term
 * @security Admin SDK + withAuth + Tenant Isolation
 */
export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<SearchResponseData>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const { searchParams } = new URL(request.url);
      const searchTerm = (searchParams.get('q') ?? '').trim().toLowerCase();
      const excludeIds = (searchParams.get('exclude') ?? '')
        .split(',')
        .filter(Boolean);

      if (searchTerm.length < 2) {
        throw new ApiError(400, 'Search term must be at least 2 characters', 'VALIDATION_ERROR');
      }

      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database connection not available', 'DB_UNAVAILABLE');
      }

      // 🔒 SECURITY: Tenant-scoped query via Admin SDK
      // Query 1: Contacts with matching companyId (tenant isolation)
      const tenantSnapshot = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .where('type', '==', 'individual')
        .where('companyId', '==', ctx.companyId)
        .get();

      // Query 2: Legacy contacts without companyId (created by this user)
      const legacySnapshot = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .where('type', '==', 'individual')
        .where('createdBy', '==', ctx.uid)
        .get();

      // Merge results (deduplicate by doc ID)
      const docsMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      for (const doc of tenantSnapshot.docs) {
        docsMap.set(doc.id, doc);
      }
      for (const doc of legacySnapshot.docs) {
        if (!docsMap.has(doc.id)) {
          docsMap.set(doc.id, doc);
        }
      }

      const results: IndividualResult[] = [];

      for (const [docId, doc] of docsMap) {
        if (excludeIds.includes(docId)) continue;

        const data = doc.data();
        if (!data) continue;

        const firstName = (data.firstName ?? '').toLowerCase();
        const lastName = (data.lastName ?? '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const specialty = (data.specialty ?? '').toLowerCase();
        const amka = (data.amka ?? '') as string;

        if (
          fullName.includes(searchTerm) ||
          specialty.includes(searchTerm) ||
          amka.includes(searchTerm)
        ) {
          results.push({
            id: docId,
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            specialty: data.specialty ?? null,
            amka: data.amka ?? null,
          });
        }
      }

      logger.info('Individual contacts search', {
        term: searchTerm,
        found: results.length,
        tenant: ctx.companyId,
        tenantDocs: tenantSnapshot.size,
        legacyDocs: legacySnapshot.size,
      });

      return apiSuccess<SearchResponseData>({
        contacts: results,
        count: results.length,
      });
    },
    { permissions: 'crm:contacts:view' }
  )
);
