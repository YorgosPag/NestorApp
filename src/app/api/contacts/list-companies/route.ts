import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';

/** 🏢 ENTERPRISE: Discriminated union response types */
interface CompanyItem {
  id: string;
  companyName: unknown;
  industry: unknown;
  vatNumber: unknown;
  status: unknown;
  companyId: unknown;
}

interface ListCompaniesSuccessResponse {
  success: true;
  companies: CompanyItem[];
  count: number;
  tenantId: string;
}

interface ListCompaniesErrorResponse {
  success: false;
  error: string;
}

type ListCompaniesResponse = ListCompaniesSuccessResponse | ListCompaniesErrorResponse;

/**
 * 🏢 ENTERPRISE COMPANIES LIST ENDPOINT
 *
 * @route GET /api/contacts/list-companies
 * @returns Tenant-scoped companies list
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC + Tenant Isolation
 * @security Admin SDK + withAuth + Tenant Isolation
 * @permission contacts:contacts:view
 * @rateLimit HIGH (100 req/min) - List
 */

export const GET = withHighRateLimit(
  withAuth<ListCompaniesResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        console.log(`📋 Listing companies for companyId: ${ctx.companyId}`);
        console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);

        const adminDb = getAdminFirestore();
        if (!adminDb) {
          console.error('❌ Firebase Admin not initialized');
          return NextResponse.json({
            success: false,
            error: 'Database connection not available'
          }, { status: 503 });
        }
    const contactsSnapshot = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('status', '==', 'active')
      .where('companyId', '==', ctx.companyId)
      .get();

    const companies = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      companyName: doc.data().companyName,
      industry: doc.data().industry,
      vatNumber: doc.data().vatNumber,
      status: doc.data().status,
      companyId: doc.data().companyId
    }));

    console.log(`🏢 Found ${companies.length} companies for tenant ${ctx.companyId}`);
    companies.forEach(company => {
      console.log(`  - ${company.companyName} (ID: ${company.id})`);
    });
    console.log(`✅ Tenant isolation enforced: all companies.companyId === ${ctx.companyId}`);

    return NextResponse.json({
      success: true,
      companies,
      count: companies.length,
      tenantId: ctx.companyId
    });

      } catch (error) {
        console.error('❌ Error listing companies:', error);
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    },
    { permissions: 'crm:contacts:view' }
  )
);
