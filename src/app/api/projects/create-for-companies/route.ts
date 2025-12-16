import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUILDING_IDS } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: Load project templates from environment or use fallbacks
const getProjectTemplates = () => {
  try {
    const envTemplates = process.env.NEXT_PUBLIC_PROJECT_TEMPLATES_JSON;
    if (envTemplates) {
      return JSON.parse(envTemplates);
    }
  } catch (error) {
    console.warn('⚠️ Invalid PROJECT_TEMPLATES_JSON, using fallbacks');
  }

  return [
    {
      name: process.env.NEXT_PUBLIC_TEMPLATE_1_NAME || "Κέντρο Εμπορίου",
      title: process.env.NEXT_PUBLIC_TEMPLATE_1_TITLE || "Ανέγερση σύγχρονου εμπορικού κέντρου",
      address: process.env.NEXT_PUBLIC_TEMPLATE_1_ADDRESS || "Κεντρική Πλατεία",
      city: process.env.NEXT_PUBLIC_DEFAULT_CITY || "Αθήνα",
      status: process.env.NEXT_PUBLIC_TEMPLATE_1_STATUS || "planning",
      progress: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_1_PROGRESS || '15'),
      startDate: process.env.NEXT_PUBLIC_TEMPLATE_1_START_DATE || "2024-01-15",
      completionDate: process.env.NEXT_PUBLIC_TEMPLATE_1_COMPLETION_DATE || "2026-12-30",
      totalValue: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_1_TOTAL_VALUE || '2500000'),
      totalArea: parseFloat(process.env.NEXT_PUBLIC_TEMPLATE_1_TOTAL_AREA || '3500.5'),
      buildings: [
        {
          id: process.env.NEXT_PUBLIC_TEMPLATE_1_BUILDING_ID || "building_1_commercial",
          name: process.env.NEXT_PUBLIC_TEMPLATE_1_BUILDING_NAME || "ΚΤΙΡΙΟ Α - Καταστήματα",
          description: process.env.NEXT_PUBLIC_TEMPLATE_1_BUILDING_DESC || "Κύριο κτίριο με καταστήματα",
          status: process.env.NEXT_PUBLIC_TEMPLATE_1_BUILDING_STATUS || "planning",
          totalArea: parseFloat(process.env.NEXT_PUBLIC_TEMPLATE_1_BUILDING_AREA || '2800.5'),
          units: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_1_BUILDING_UNITS || '12'),
          floors: [
            {
              id: process.env.NEXT_PUBLIC_TEMPLATE_1_FLOOR_0_ID || "floor_0",
              name: process.env.NEXT_PUBLIC_TEMPLATE_1_FLOOR_0_NAME || "Ισόγειο",
              number: 0,
              units: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_1_FLOOR_0_UNITS || '8')
            },
            {
              id: process.env.NEXT_PUBLIC_TEMPLATE_1_FLOOR_1_ID || "floor_1",
              name: process.env.NEXT_PUBLIC_TEMPLATE_1_FLOOR_1_NAME || "1ος Όροφος",
              number: 1,
              units: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_1_FLOOR_1_UNITS || '4')
            }
          ]
      }
    ]
    },
    {
      name: process.env.NEXT_PUBLIC_TEMPLATE_2_NAME || "Βιομηχανικό Συγκρότημα",
      title: process.env.NEXT_PUBLIC_TEMPLATE_2_TITLE || "Ανάπτυξη βιομηχανικού συγκροτήματος",
      address: process.env.NEXT_PUBLIC_TEMPLATE_2_ADDRESS || "Βιομηχανική Περιοχή",
      city: process.env.NEXT_PUBLIC_SECONDARY_CITY || "Θεσσαλονίκη",
      status: process.env.NEXT_PUBLIC_TEMPLATE_2_STATUS || "in_progress",
      progress: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_2_PROGRESS || '45'),
      startDate: process.env.NEXT_PUBLIC_TEMPLATE_2_START_DATE || "2023-06-01",
      completionDate: process.env.NEXT_PUBLIC_TEMPLATE_2_COMPLETION_DATE || "2025-10-15",
      totalValue: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_2_TOTAL_VALUE || '1800000'),
      totalArea: parseFloat(process.env.NEXT_PUBLIC_TEMPLATE_2_TOTAL_AREA || '4200.75'),
      buildings: [
        {
          id: process.env.NEXT_PUBLIC_TEMPLATE_2_BUILDING_ID || "building_1_factory",
          name: process.env.NEXT_PUBLIC_TEMPLATE_2_BUILDING_NAME || "ΚΤΙΡΙΟ Α - Παραγωγή",
          description: process.env.NEXT_PUBLIC_TEMPLATE_2_BUILDING_DESC || "Κύριο βιομηχανικό κτίριο",
          status: process.env.NEXT_PUBLIC_TEMPLATE_2_BUILDING_STATUS || "construction",
          totalArea: parseFloat(process.env.NEXT_PUBLIC_TEMPLATE_2_BUILDING_AREA || '3500.5'),
          units: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_2_BUILDING_UNITS || '6'),
          floors: [
            {
              id: process.env.NEXT_PUBLIC_TEMPLATE_2_FLOOR_0_ID || "floor_0",
              name: process.env.NEXT_PUBLIC_TEMPLATE_2_FLOOR_0_NAME || "Ισόγειο",
              number: 0,
              units: parseInt(process.env.NEXT_PUBLIC_TEMPLATE_2_FLOOR_0_UNITS || '6')
            }
          ]
        }
      ]
    }
  ];
};

const projectTemplates = getProjectTemplates();

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Creating projects for all companies...');

    // 1. Πάρε όλες τις εταιρείες
    const contactsQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
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
        await setDoc(doc(db, COLLECTIONS.PROJECTS, projectId), project);
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
    const allProjectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));

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