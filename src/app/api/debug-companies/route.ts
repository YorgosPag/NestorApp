// Debug API endpoint για να εξετάσουμε το company ID issue

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';

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

export async function GET(request: NextRequest) {
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

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
