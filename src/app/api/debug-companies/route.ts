// Debug API endpoint για να εξετάσουμε το company ID issue

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging Companies in Database...\n');

    const database = db();
    if (!database) {
      return NextResponse.json({ error: 'Firebase admin not initialized' }, { status: 500 });
    }

    const result = {
      totalContacts: 0,
      totalCompanies: 0,
      specificCompany: null,
      projectsForSpecificCompany: 0,
      allProjectCompanyIds: [] as any[],
      companyIdCounts: {} as { [key: string]: number },
      allCompanies: [] as any[]
    };

    // 1. Παίρνουμε όλα τα contacts
    console.log('📋 Step 1: All contacts in database...');
    const allContactsQuery = query(collection(database, 'contacts'));
    const allContactsSnapshot = await getDocs(allContactsQuery);
    result.totalContacts = allContactsSnapshot.docs.length;

    console.log(`Total contacts: ${result.totalContacts}\n`);

    // 2. Παίρνουμε μόνο τις εταιρείες
    console.log('📋 Step 2: Companies only...');
    const companiesQuery = query(
      collection(database, 'contacts'),
      where('type', '==', 'company')
    );
    const companiesSnapshot = await getDocs(companiesQuery);
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

    // 3. Ελέγχουμε το specific company ID που προβληματίζει
    console.log('\n🔍 Step 3: Checking specific company ID: kGKmSIbhoRlDdrtDnUgD...');
    const specificCompanyRef = doc(database, 'contacts', 'kGKmSIbhoRlDdrtDnUgD');
    const specificCompanySnapshot = await getDoc(specificCompanyRef);

    if (specificCompanySnapshot.exists()) {
      const data = specificCompanySnapshot.data();
      result.specificCompany = {
        id: 'kGKmSIbhoRlDdrtDnUgD',
        exists: true,
        ...data
      };
      console.log('✅ Company EXISTS in database:');
      console.log(`   ID: kGKmSIbhoRlDdrtDnUgD`);
      console.log(`   Type: ${data.type || 'undefined'}`);
      console.log(`   CompanyName: ${data.companyName || 'undefined'}`);
      console.log(`   Status: ${data.status || 'undefined'}`);
    } else {
      result.specificCompany = { id: 'kGKmSIbhoRlDdrtDnUgD', exists: false };
      console.log('❌ Company does NOT exist in database');
    }

    // 4. Ελέγχουμε αν υπάρχουν projects για αυτό το company
    console.log('\n🏗️ Step 4: Checking projects for company kGKmSIbhoRlDdrtDnUgD...');
    const projectsQuery = query(
      collection(database, 'projects'),
      where('companyId', '==', 'kGKmSIbhoRlDdrtDnUgD')
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    result.projectsForSpecificCompany = projectsSnapshot.docs.length;

    console.log(`Projects found: ${result.projectsForSpecificCompany}`);

    // 5. Ελέγχουμε όλα τα projects για να δούμε ποια companyIds υπάρχουν
    console.log('\n🏗️ Step 5: All projects and their company IDs...');
    const allProjectsQuery = query(collection(database, 'projects'));
    const allProjectsSnapshot = await getDocs(allProjectsQuery);

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}