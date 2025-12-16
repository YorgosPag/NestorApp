import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUILDING_IDS } from '@/config/building-ids-config';

const projectTemplates = [
  {
    name: "Κέντρο Εμπορίου",
    title: "Ανέγερση σύγχρονου εμπορικού κέντρου",
    address: "Κεντρική Πλατεία",
    city: "Αθήνα",
    status: "planning",
    progress: 15,
    startDate: "2024-01-15",
    completionDate: "2026-12-30",
    totalValue: 2500000,
    totalArea: 3500.5,
    buildings: [
      {
        id: "building_1_commercial",
        name: "ΚΤΙΡΙΟ Α - Καταστήματα",
        description: "Κύριο κτίριο με καταστήματα",
        status: "planning",
        totalArea: 2800.5,
        units: 12,
        floors: [
          { id: "floor_0", name: "Ισόγειο", number: 0, units: 8 },
          { id: "floor_1", name: "1ος Όροφος", number: 1, units: 4 }
        ]
      }
    ]
  },
  {
    name: "Βιομηχανικό Συγκρότημα",
    title: "Ανάπτυξη βιομηχανικού συγκροτήματος",
    address: "Βιομηχανική Περιοχή",
    city: "Θεσσαλονίκη",
    status: "in_progress",
    progress: 45,
    startDate: "2023-06-01",
    completionDate: "2025-10-15",
    totalValue: 1800000,
    totalArea: 4200.75,
    buildings: [
      {
        id: "building_1_factory",
        name: "ΚΤΙΡΙΟ Α - Παραγωγή",
        description: "Κύριο βιομηχανικό κτίριο",
        status: "construction",
        totalArea: 3500.5,
        units: 6,
        floors: [
          { id: "floor_0", name: "Ισόγειο", number: 0, units: 6 }
        ]
      }
    ]
  }
];

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Creating projects for all companies...');

    // 1. Πάρε όλες τις εταιρείες
    const contactsQuery = query(
      collection(db, 'contacts'),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const contactsSnapshot = await getDocs(contactsQuery);

    if (contactsSnapshot.docs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No companies found'
      });
    }

    console.log(`🏢 Found ${contactsSnapshot.docs.length} companies`);

    const companies = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 🏢 ENTERPRISE: Δημιούργησε projects για κάθε εταιρεία - configurable starting index
    let projectIndex = BUILDING_IDS.PROJECT_ID + 1; // Starting after configured base project
    const createdProjects: any[] = [];

    for (const company of companies) {
      console.log(`\n🏢 Creating project for: ${company.companyName}`);

      // Επέλεξε template based on company index
      const template = projectTemplates[createdProjects.length % projectTemplates.length];
      const projectId = `${projectIndex}`;

      const project = {
        ...template,
        companyId: company.id, // ΣΩΣΤΟ company ID!
        company: company.companyName,
        lastUpdate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: `${template.name} ${company.companyName}`,
        title: `${template.title} - ${company.companyName}`,
      };

      try {
        await setDoc(doc(db, 'projects', projectId), project);
        console.log(`✅ Created project: ${project.name} (ID: ${projectId})`);

        createdProjects.push({
          id: projectId,
          name: project.name,
          company: company.companyName,
          companyId: company.id
        });

        projectIndex++;
      } catch (error) {
        console.error(`❌ Failed to create project for ${company.companyName}:`, error);
      }
    }

    // 3. Επαλήθευση
    console.log('\n📊 Verification:');
    const allProjectsSnapshot = await getDocs(collection(db, 'projects'));

    const allProjects = allProjectsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      company: doc.data().company,
      companyId: doc.data().companyId
    }));

    console.log(`🏗️ Total projects in database: ${allProjects.length}`);

    return NextResponse.json({
      success: true,
      message: `Created ${createdProjects.length} projects successfully`,
      createdProjects,
      allProjects,
      stats: {
        companiesFound: companies.length,
        projectsCreated: createdProjects.length,
        totalProjectsInDb: allProjects.length
      }
    });

  } catch (error) {
    console.error('❌ Error creating projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}