import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting to fix project company IDs...');

    // 1. Πάρε όλες τις εταιρείες από contacts
    const contactsQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const contactsSnapshot = await getDocs(contactsQuery);

    console.log(`📁 Found ${contactsSnapshot.docs.length} companies in contacts`);

    const companyMapping: Record<string, string> = {};
    contactsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`🏢 Company: ${data.companyName} -> ID: ${doc.id}`);
      companyMapping[data.companyName] = doc.id;
    });

    // 2. Πάρε όλα τα projects
    const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
    console.log(`🏗️ Found ${projectsSnapshot.docs.length} projects`);

    // 3. Διόρθωσε τα companyIds
    const batch = writeBatch(db);
    let updatedCount = 0;
    const updates: Array<{
      projectId: string;
      projectName: string;
      companyName: string;
      oldCompanyId: string;
      newCompanyId: string;
    }> = [];

    for (const projectDoc of projectsSnapshot.docs) {
      const projectData = projectDoc.data();
      const companyName = projectData.company;
      const currentCompanyId = projectData.companyId;
      const correctCompanyId = companyMapping[companyName];

      if (correctCompanyId && currentCompanyId !== correctCompanyId) {
        console.log(`🔄 Updating project "${projectData.name}"`);
        console.log(`   Company: ${companyName}`);
        console.log(`   Old companyId: ${currentCompanyId}`);
        console.log(`   New companyId: ${correctCompanyId}`);

        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectDoc.id);
        batch.update(projectRef, {
          companyId: correctCompanyId,
          updatedAt: new Date().toISOString()
        });

        updates.push({
          projectId: projectDoc.id,
          projectName: projectData.name,
          companyName,
          oldCompanyId: currentCompanyId,
          newCompanyId: correctCompanyId
        });

        updatedCount++;
      } else if (!correctCompanyId) {
        console.log(`⚠️  No matching company found for: ${companyName}`);
      } else {
        console.log(`✅ Project "${projectData.name}" already has correct companyId`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Updated ${updatedCount} projects successfully!`);
    }

    // 4. Επαλήθευση - δείξε τα τελικά αποτελέσματα
    console.log('\n📊 Final verification:');
    const finalProjectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));

    const finalProjects = finalProjectsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        company: data.company,
        companyId: data.companyId
      };
    });

    finalProjects.forEach(project => {
      console.log(`🏗️ Project: ${project.name} -> Company: ${project.company} -> CompanyId: ${project.companyId}`);
    });

    return NextResponse.json({
      success: true,
      message: `Fixed ${updatedCount} project company IDs`,
      companyMapping,
      updates,
      finalProjects,
      stats: {
        companiesFound: contactsSnapshot.docs.length,
        projectsFound: projectsSnapshot.docs.length,
        projectsUpdated: updatedCount
      }
    });

  } catch (error) {
    console.error('❌ Error fixing project company IDs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}