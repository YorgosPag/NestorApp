import { NextRequest, NextResponse } from 'next/server';
import { firebaseServer } from '@/lib/firebase-server';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 🚀 Next.js 15: params must be awaited before accessing properties
  const { projectId } = await params;

  try {
    console.log(`🏗️ API: Loading project structure for projectId: ${projectId}`);

    // Get project details
    console.log(`🔍 Fetching project with ID: ${projectId}`);
    const projectSnapshot = await firebaseServer.getDoc(COLLECTIONS.PROJECTS, projectId);

    if (!projectSnapshot.exists) {
      console.log(`❌ Project with ID ${projectId} not found`);
      return NextResponse.json(
        { success: false, error: `Δεν βρέθηκε έργο με ID: ${projectId}` },
        { status: 404 }
      );
    }

    const project = { id: projectSnapshot.id, ...projectSnapshot.data() };
    console.log(`✅ Project found: ${project.name}`);

    // Get buildings for this project (handle both string and number projectId)
    console.log(`🏢 Fetching buildings for projectId: ${projectId} (trying both string and number)`);

    // Try with string projectId first
    let buildingsSnapshot = await firebaseServer.getDocs(COLLECTIONS.BUILDINGS, [
      { field: 'projectId', operator: '==', value: projectId }
    ]);

    // If no results, try with number projectId
    if (buildingsSnapshot.docs.length === 0) {
      console.log(`🔄 No buildings found with string projectId, trying number: ${parseInt(projectId)}`);
      buildingsSnapshot = await firebaseServer.getDocs(COLLECTIONS.BUILDINGS, [
        { field: 'projectId', operator: '==', value: parseInt(projectId) }
      ]);
    }

    console.log(`🏢 Found ${buildingsSnapshot.docs.length} buildings`);

    const buildings = [];

    // Get units for each building
    for (const buildingDoc of buildingsSnapshot.docs) {
      const building = { id: buildingDoc.id, ...buildingDoc.data() };
      const buildingKey = building.id;  // Use building ID directly

      console.log(`🏠 Fetching units for buildingId: ${buildingKey}`);
      const unitsSnapshot = await firebaseServer.getDocs(COLLECTIONS.UNITS, [
        { field: 'buildingId', operator: '==', value: buildingKey }
      ]);

      const units = unitsSnapshot.docs.map(unitDoc => ({
        id: unitDoc.id,
        ...unitDoc.data()
      }));

      console.log(`🏠 Building ${building.id}: Found ${units.length} units`);
      buildings.push({ ...building, units });
    }

    const structure = {
      project,
      buildings
    };

    console.log(`✅ Project structure loaded successfully for projectId: ${projectId}`);
    console.log(`📊 Summary: ${buildings.length} buildings, ${buildings.reduce((sum, b) => sum + b.units.length, 0)} total units`);

    return NextResponse.json({
      success: true,
      structure,
      projectId,
      summary: {
        buildingsCount: buildings.length,
        totalUnits: buildings.reduce((sum, b) => sum + b.units.length, 0)
      }
    });

  } catch (error) {
    console.error('❌ API: Error loading project structure:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Άγνωστο σφάλμα',
        projectId
      },
      { status: 500 }
    );
  }
}