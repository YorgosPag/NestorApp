/**
 * =============================================================================
 * DEBUG COMPANIES - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Debugs company data and relationships (contacts, projects, companyIds)
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin
 * @classification Debug utility (read-only data inspection)
 *
 * This endpoint inspects company data for debugging purposes:
 * - Lists all companies
 * - Shows project-company relationships
 * - Identifies primary company
 * - Counts projects per company
 *
 * @method GET - Debug company data (read-only)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:debug:read permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - NO audit logging (read-only operation)
 *
 * @technology Firebase Admin SDK (elevated read access)
 * @classification Debug utility (read-only)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

// 🏢 ENTERPRISE: Type-safe interfaces for debug data
interface CompanyInfo {
  id: string;
  companyName: string;
  status: string;
  type: string;
}

interface ProjectInfo {
  projectId: string;
  name: string;
  companyId: string;
  company: string;
}

interface DebugResult {
  totalContacts: number;
  totalCompanies: number;
  specificCompany: CompanyInfo | null;
  projectsForSpecificCompany: number;
  allProjectCompanyIds: ProjectInfo[];
  companyIdCounts: Record<string, number>;
  allCompanies: CompanyInfo[];
  primaryCompany?: {
    id: string;
    exists: boolean;
    companyName?: string;
    type?: string;
    status?: string;
  } | { exists: false };
  projectsForPrimaryCompany?: number;
}

/**
 * GET - Debug Companies (withAuth protected)
 * Read-only inspection of company data and relationships.
 *
 * @security withAuth + super_admin check + admin:debug:read permission
 */
export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleDebugCompanies(req, ctx);
  },
  { permissions: 'admin:debug:read' }
);

/**
 * Internal handler for GET (debug companies).
 */
async function handleDebugCompanies(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [GET /api/debug-companies] BLOCKED: Non-super_admin attempted company debug`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    console.log('🔍 Debugging Companies in Database...\n');

    const database = db();
    if (!database) {
      return NextResponse.json({ error: 'Firebase admin not initialized' }, { status: 500 });
    }

    const result: DebugResult = {
      totalContacts: 0,
      totalCompanies: 0,
      specificCompany: null,
      projectsForSpecificCompany: 0,
      allProjectCompanyIds: [],
      companyIdCounts: {},
      allCompanies: []
    };

    // 1. Παίρνουμε όλα τα contacts - Firebase Admin SDK syntax
    console.log('📋 Step 1: All contacts in database...');
    const allContactsSnapshot = await database.collection(COLLECTIONS.CONTACTS).get();
    result.totalContacts = allContactsSnapshot.docs.length;

    console.log(`Total contacts: ${result.totalContacts}\n`);

    // 2. Παίρνουμε μόνο τις εταιρείες - Firebase Admin SDK syntax
    console.log('📋 Step 2: Companies only...');
    const companiesSnapshot = await database
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .get();
    result.totalCompanies = companiesSnapshot.docs.length;

    console.log(`Total companies: ${result.totalCompanies}\n`);

    result.allCompanies = companiesSnapshot.docs.map(doc => {
      const data = doc.data();
      const companyInfo = {
        id: doc.id,
        companyName: data.companyName || 'undefined',
        status: data.status || 'undefined',
        type: data.type || 'undefined'
      };
      console.log(`🏢 Company ID: ${doc.id}, Name: ${data.companyName || 'undefined'}, Status: ${data.status || 'undefined'}`);
      return companyInfo;
    });

    // 🏢 ENTERPRISE: Dynamic company validation - no hardcoded IDs
    console.log('\n🔍 Step 3: Checking primary companies...');

    // Find primary company by name pattern instead of hardcoded ID
    const primarySnapshot = await database
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .get();

    let primaryCompany: { id: string; companyName?: string; type?: string; status?: string; isPrimary?: boolean } | null = null;
    primarySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.companyName?.toLowerCase().includes('παγωνη') || data.isPrimary) {
        primaryCompany = { id: doc.id, ...data };
      }
    });

    if (primaryCompany) {
      result.primaryCompany = {
        id: primaryCompany.id,
        exists: true,
        companyName: primaryCompany.companyName,
        type: primaryCompany.type,
        status: primaryCompany.status
      };
      console.log('✅ Primary company found:');
      console.log(`   ID: ${primaryCompany.id}`);
      console.log(`   Name: ${primaryCompany.companyName}`);
    } else {
      result.primaryCompany = { exists: false };
      console.log('❌ No primary company found in database');
    }

    // 4. Check projects for primary company
    if (primaryCompany) {
      console.log('\n🏗️ Step 4: Checking projects for primary company...');
      const projectsSnapshot = await database
        .collection(COLLECTIONS.PROJECTS)
        .where('companyId', '==', primaryCompany.id)
        .get();
      result.projectsForPrimaryCompany = projectsSnapshot.docs.length;
      console.log(`Projects found: ${result.projectsForPrimaryCompany}`);
    } else {
      result.projectsForPrimaryCompany = 0;
    }

    // 5. Ελέγχουμε όλα τα projects για να δούμε ποια companyIds υπάρχουν
    console.log('\n🏗️ Step 5: All projects and their company IDs...');
    const allProjectsSnapshot = await database.collection(COLLECTIONS.PROJECTS).get();

    console.log(`Total projects: ${allProjectsSnapshot.docs.length}\n`);

    allProjectsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const companyId = data.companyId || 'undefined';

      const projectInfo = {
        projectId: doc.id,
        name: data.name || 'undefined',
        companyId: companyId,
        company: data.company || 'undefined'
      };

      result.allProjectCompanyIds.push(projectInfo);
      result.companyIdCounts[companyId] = (result.companyIdCounts[companyId] || 0) + 1;

      console.log(`Project ID: ${doc.id}, Name: ${data.name || 'undefined'}, CompanyId: ${companyId}`);
    });

    console.log('\n📊 Company ID Summary:');
    Object.entries(result.companyIdCounts).forEach(([companyId, count]) => {
      console.log(`   ${companyId}: ${count} projects`);
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      executionTimeMs: duration,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('❌ Error:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: duration,
    }, { status: 500 });
  }
}
