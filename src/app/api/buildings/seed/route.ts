import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 🏢 ENTERPRISE: Database-driven company lookup (NO MORE HARDCODED IDs)
 */
async function getCompanyIdByName(companyName: string): Promise<string | null> {
  try {
    const companiesQuery = query(
      collection(db, 'contacts'),
      where('type', '==', 'company'),
      where('companyName', '==', companyName)
    );
    const snapshot = await getDocs(companiesQuery);
    return snapshot.empty ? null : snapshot.docs[0].id;
  } catch (error) {
    console.error(`🚨 Error loading company ID for ${companyName}:`, error);
    return null;
  }
}

// Real buildings for "Παλαιολόγου Πολυκατοικία" project
const realBuildings = [
  {
    id: "building_1_palaiologou",
    name: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_NAME || "ΚΤΙΡΙΟ Α - Main Building",
    description: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_DESC || "Κύριο κτίριο με 8 μονάδες υψηλών προδιαγραφών",
    address: process.env.NEXT_PUBLIC_DEFAULT_ADDRESS_1 || "Παλαιολόγου 45",
    city: process.env.NEXT_PUBLIC_DEFAULT_CITY || "Θεσσαλονίκη", 
    totalArea: parseFloat(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_TOTAL_AREA || '1850.50'),
    builtArea: parseFloat(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_BUILT_AREA || '1650.25'),
    floors: parseInt(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_FLOORS || '6'),
    units: parseInt(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_UNITS || '8'),
    status: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_STATUS || 'active',
    startDate: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_START_DATE || '2020-03-15',
    completionDate: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_END_DATE || '2023-06-30',
    progress: parseInt(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_PROGRESS || '95'),
    totalValue: parseFloat(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_TOTAL_VALUE || '1800000'),
    company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
    project: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_NAME || "Sample Development Project",
    projectId: "project_1_palaiologou", // From seedRealProjects.ts
    category: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_CATEGORY || 'residential',
    features: (process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_FEATURES || 'Θέρμανση Αυτονομίας,Ασανσέρ,Μπαλκόνια,Αποθήκες').split(',').map(f => f.trim()),
    buildingFloors: [
      { id: "floor_0", name: "Ισόγειο", number: 0, units: 1 },
      { id: "floor_1", name: "1ος Όροφος", number: 1, units: 2 },
      { id: "floor_2", name: "2ος Όροφος", number: 2, units: 2 },
      { id: "floor_3", name: "3ος Όροφος", number: 3, units: 2 },
      { id: "floor_4", name: "4ος Όροφος", number: 4, units: 1 }
    ]
  },
  {
    id: "building_2_palaiologou", 
    name: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_NAME || "ΚΤΙΡΙΟ Β - Auxiliary Building",
    description: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_DESC || "Βοηθητικό κτίριο με αποθήκες και κοινόχρηστους χώρους",
    address: process.env.NEXT_PUBLIC_DEFAULT_ADDRESS_2 || "Παλαιολόγου 47",
    city: process.env.NEXT_PUBLIC_DEFAULT_CITY || "Θεσσαλονίκη",
    totalArea: parseFloat(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_TOTAL_AREA || '450.75'),
    builtArea: parseFloat(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_BUILT_AREA || '380.50'),
    floors: parseInt(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_FLOORS || '2'),
    units: parseInt(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_UNITS || '6'),
    status: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_STATUS || 'construction',
    startDate: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_START_DATE || '2023-09-01',
    completionDate: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_END_DATE || '2024-12-15',
    progress: parseInt(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_PROGRESS || '65'),
    totalValue: parseFloat(process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_TOTAL_VALUE || '450000'),
    company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
    project: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_NAME || "Sample Development Project",
    projectId: "project_1_palaiologou", // From seedRealProjects.ts
    category: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_CATEGORY || 'storage',
    features: (process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_FEATURES || 'Αποθήκες,Χώρος Κοινής Ωφέλειας,Υπόγειο Πάρκινγκ').split(',').map(f => f.trim()),
    buildingFloors: [
      { id: "floor_-1", name: "Υπόγειο", number: -1, units: 3 },
      { id: "floor_0", name: "Ισόγειο", number: 0, units: 3 }
    ]
  }
];

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Starting enterprise building seeding (database-driven)...');

    // 🏢 ENTERPRISE: Load company ID από database αντί για hardcoded value
    const mainCompanyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company';
    const pagonisCompanyId = await getCompanyIdByName(mainCompanyName);

    if (!pagonisCompanyId) {
      return NextResponse.json({
        error: `Company "${mainCompanyName}" not found in database`,
        suggestion: 'Please ensure company data exists before seeding buildings'
      }, { status: 404 });
    }

    console.log(`✅ Found company in database: ${pagonisCompanyId}`);

    const results = [];

    for (const buildingTemplate of realBuildings) {
      console.log(`📝 Creating building: ${buildingTemplate.name}`);

      // 🏢 ENTERPRISE: Use database-driven companyId
      const building = {
        ...buildingTemplate,
        companyId: pagonisCompanyId, // Database-driven value
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Remove the old hardcoded companyId if it exists in template
      delete building.companyId;
      building.companyId = pagonisCompanyId;

      await setDoc(doc(db, 'buildings', building.id), building);

      console.log(`✅ Successfully created building with database-driven companyId: ${building.name}`);
      results.push({
        id: building.id,
        name: building.name,
        companyId: pagonisCompanyId,
        status: 'created'
      });
    }

    console.log('🎉 All real buildings have been successfully seeded to Firestore!');

    return NextResponse.json({
      success: true,
      message: 'Real buildings seeded successfully',
      results,
      summary: {
        totalBuildings: realBuildings.length,
        project: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_NAME || "Sample Development Project",
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || "Default Construction Company"
      }
    });

  } catch (error) {
    console.error('❌ Error seeding buildings:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to seed buildings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}