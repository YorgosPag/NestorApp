import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SearchIndividualsRoute');

interface IndividualResult {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  amka: string | null;
}

interface SearchSuccessResponse {
  success: true;
  contacts: IndividualResult[];
  count: number;
}

interface SearchErrorResponse {
  success: false;
  error: string;
}

type SearchResponse = SearchSuccessResponse | SearchErrorResponse;

/**
 * 🏢 ENTERPRISE: Search individual contacts (for worker assignment)
 *
 * @route GET /api/contacts/search-individuals?q=term&exclude=id1,id2
 * @returns Tenant-scoped individual contacts matching search term
 * @security Admin SDK + withAuth + Tenant Isolation
 */
export const GET = withStandardRateLimit(
  withAuth<SearchResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const { searchParams } = new URL(request.url);
        const searchTerm = (searchParams.get('q') ?? '').trim().toLowerCase();
        const excludeIds = (searchParams.get('exclude') ?? '')
          .split(',')
          .filter(Boolean);

        if (searchTerm.length < 2) {
          return NextResponse.json({
            success: false,
            error: 'Search term must be at least 2 characters',
          }, { status: 400 });
        }

        const adminDb = getAdminFirestore();
        if (!adminDb) {
          return NextResponse.json({
            success: false,
            error: 'Database connection not available',
          }, { status: 503 });
        }

        // 🔒 SECURITY: Tenant-scoped query via Admin SDK
        const snapshot = await adminDb
          .collection(COLLECTIONS.CONTACTS)
          .where('type', '==', 'individual')
          .where('companyId', '==', ctx.companyId)
          .get();

        const results: IndividualResult[] = [];

        for (const doc of snapshot.docs) {
          if (excludeIds.includes(doc.id)) continue;

          const data = doc.data();
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
              id: doc.id,
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
        });

        return NextResponse.json({
          success: true,
          contacts: results,
          count: results.length,
        });
      } catch (error) {
        logger.error('Error searching individual contacts', { error });
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    },
    { permissions: 'crm:contacts:view' }
  )
);
