import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Real buildings for "Παλαιολόγου Πολυκατοικία" project
const realBuildings = [
  {
    id: "building_1_palaiologou",
    name: "ΚΤΙΡΙΟ Α - Παλαιολόγου",
    description: "Κύριο κτίριο της πολυκατοικίας με 8 διαμερίσματα υψηλών προδιαγραφών",
    address: "Παλαιολόγου 45",
    city: "Θεσσαλονίκη", 
    totalArea: 1850.50,
    builtArea: 1650.25,
    floors: 6,
    units: 8,
    status: 'active',
    startDate: '2020-03-15',
    completionDate: '2023-06-30',
    progress: 95,
    totalValue: 1800000,
    company: "Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.",
    companyId: "5djayaxc0X33wsE8T2uY",
    project: "Παλαιολόγου Πολυκατοικία",
    projectId: "project_1_palaiologou", // From seedRealProjects.ts
    category: 'residential',
    features: ['Θέρμανση Αυτονομίας', 'Ασανσέρ', 'Μπαλκόνια', 'Αποθήκες'],
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
    name: "ΚΤΙΡΙΟ Β - Βοηθητικές Εγκαταστάσεις",
    description: "Βοηθητικό κτίριο με αποθήκες και χώρους κοινής ωφέλειας",
    address: "Παλαιολόγου 47",
    city: "Θεσσαλονίκη",
    totalArea: 450.75,
    builtArea: 380.50,
    floors: 2,
    units: 6,
    status: 'construction',
    startDate: '2023-09-01',
    completionDate: '2024-12-15',
    progress: 65,
    totalValue: 450000,
    company: "Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.",
    companyId: "5djayaxc0X33wsE8T2uY",
    project: "Παλαιολόγου Πολυκατοικία",
    projectId: "project_1_palaiologou", // From seedRealProjects.ts
    category: 'storage',
    features: ['Αποθήκες', 'Χώρος Κοινής Ωφέλειας', 'Υπόγειο Πάρκινγκ'],
    buildingFloors: [
      { id: "floor_-1", name: "Υπόγειο", number: -1, units: 3 },
      { id: "floor_0", name: "Ισόγειο", number: 0, units: 3 }
    ]
  }
];

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Starting to seed real buildings to Firestore...');

    const results = [];

    for (const building of realBuildings) {
      console.log(`📝 Creating building: ${building.name}`);
      
      // Save to 'buildings' collection 
      await setDoc(doc(db, 'buildings', building.id), {
        ...building,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Successfully created building: ${building.name}`);
      results.push({
        id: building.id,
        name: building.name,
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
        project: "Παλαιολόγου Πολυκατοικία",
        company: "Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε."
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