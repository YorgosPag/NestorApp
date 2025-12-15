/**
 * Debug endpoint: Buildings-Floors Analysis (Admin SDK)
 * Αναλύει τις σχέσεις μεταξύ κτιρίων και ορόφων με elevated permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Admin SDK if not already initialized
let adminDb: FirebaseFirestore.Firestore;

try {
  if (getApps().length === 0) {
    const app = initializeApp({
      projectId: 'nestor-pagonis'
    });
    adminDb = getFirestore(app);
  } else {
    adminDb = getFirestore();
  }
} catch (error) {
  console.error('Failed to initialize Admin SDK:', error);
}

export async function GET() {
  try {
    console.log('🏢 BUILDINGS-FLOORS ADMIN ANALYSIS STARTING...');

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized');
    }

    // Step 1: Fetch all buildings
    console.log('📋 Step 1: Fetching buildings...');
    const buildingsSnapshot = await adminDb.collection('buildings').get();
    const buildings = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${buildings.length} buildings`);

    // Step 2: Fetch all floors
    console.log('📋 Step 2: Fetching floors...');
    const floorsSnapshot = await adminDb.collection('floors').get();
    const floors = floorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${floors.length} floors`);

    // Step 3: Check for alternative collections
    console.log('📋 Step 3: Checking alternative collections...');

    // Check if floors are stored in a different collection
    const unitsSnapshot = await adminDb.collection('units').get();
    const units = unitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${units.length} units`);

    // Step 4: Analyze building-floor relationships
    console.log('📋 Step 4: Analyzing building-floor relationships...');
    const buildingFloorAnalysis = [];

    for (const building of buildings) {
      // Find floors for this building using various possible field names
      const buildingFloors = floors.filter(floor =>
        floor.buildingId === building.id ||
        floor.building === building.name ||
        floor.buildingName === building.name ||
        floor.building_id === building.id ||
        floor.parentId === building.id
      );

      // Also check units that might have floor information
      const buildingUnits = units.filter(unit =>
        unit.buildingId === building.id ||
        unit.building === building.name ||
        unit.buildingName === building.name
      );

      // Extract unique floors from units
      const floorsFromUnits = new Set();
      buildingUnits.forEach(unit => {
        if (unit.floor) floorsFromUnits.add(unit.floor);
        if (unit.floorNumber) floorsFromUnits.add(unit.floorNumber);
        if (unit.floorName) floorsFromUnits.add(unit.floorName);
      });

      buildingFloorAnalysis.push({
        building: {
          id: building.id,
          name: building.name,
          projectId: building.projectId,
          projectName: building.projectName,
          address: building.address
        },
        floors: buildingFloors.map(floor => ({
          id: floor.id,
          name: floor.name || floor.floorName,
          number: floor.floorNumber || floor.number,
          buildingId: floor.buildingId,
          building: floor.building,
          buildingName: floor.buildingName
        })),
        floorsFromUnits: Array.from(floorsFromUnits),
        units: buildingUnits.map(unit => ({
          id: unit.id,
          name: unit.name,
          floor: unit.floor || unit.floorNumber || unit.floorName,
          buildingId: unit.buildingId
        })),
        floorCount: buildingFloors.length,
        unitCount: buildingUnits.length,
        floorsFromUnitsCount: floorsFromUnits.size,
        hasFloors: buildingFloors.length > 0,
        hasUnits: buildingUnits.length > 0
      });
    }

    // Step 5: Analyze orphan floors
    const orphanFloors = floors.filter(floor => {
      const hasBuilding = buildings.some(building =>
        floor.buildingId === building.id ||
        floor.building === building.name ||
        floor.buildingName === building.name ||
        floor.building_id === building.id ||
        floor.parentId === building.id
      );
      return !hasBuilding;
    });

    // Step 6: Statistics
    const stats = {
      totalBuildings: buildings.length,
      totalFloors: floors.length,
      totalUnits: units.length,
      buildingsWithFloors: buildingFloorAnalysis.filter(b => b.hasFloors).length,
      buildingsWithoutFloors: buildingFloorAnalysis.filter(b => !b.hasFloors).length,
      buildingsWithUnits: buildingFloorAnalysis.filter(b => b.hasUnits).length,
      buildingsWithoutUnits: buildingFloorAnalysis.filter(b => !b.hasUnits).length,
      orphanFloors: orphanFloors.length,
      connectedFloors: floors.length - orphanFloors.length
    };

    console.log('📊 Analysis Complete:');
    console.log(`   - Total buildings: ${stats.totalBuildings}`);
    console.log(`   - Total floors: ${stats.totalFloors}`);
    console.log(`   - Total units: ${stats.totalUnits}`);
    console.log(`   - Buildings with floors: ${stats.buildingsWithFloors}`);
    console.log(`   - Buildings without floors: ${stats.buildingsWithoutFloors}`);
    console.log(`   - Buildings with units: ${stats.buildingsWithUnits}`);
    console.log(`   - Orphan floors: ${stats.orphanFloors}`);

    return NextResponse.json({
      success: true,
      analysis: {
        buildings,
        floors,
        units: units.slice(0, 10), // Limit units for response size
        buildingFloorAnalysis,
        orphanFloors
      },
      stats,
      summary: `Found ${stats.totalBuildings} buildings, ${stats.totalFloors} floors, ${stats.totalUnits} units. ${stats.buildingsWithFloors} buildings have floors, ${stats.buildingsWithUnits} buildings have units.`,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Admin SDK'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ BUILDINGS-FLOORS ADMIN ANALYSIS FAILED: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}