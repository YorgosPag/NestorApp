import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, doc, addDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * 🏢 ENTERPRISE: API για μετάπτωση μονάδων από legacy σε enterprise
 *
 * Αυτό το endpoint:
 * 1. Διαγράφει μονάδες με legacy buildingIds
 * 2. Δημιουργεί νέες μονάδες με Firebase auto-generated IDs
 * 3. Τις συνδέει με enterprise buildings
 *
 * @method GET - Προεπισκόπηση (dry run)
 * @method POST - Εκτέλεση μετάπτωσης
 */

// 🏢 ENTERPRISE: Enterprise building για τις νέες μονάδες
const TARGET_ENTERPRISE_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
};

// 🏢 ENTERPRISE: Unit templates για τις νέες μονάδες
const UNIT_TEMPLATES = [
  {
    name: 'Διαμέρισμα Α1',
    type: 'apartment',
    status: 'for-sale',
    floor: 1,
    floorId: 'floor_1',
    area: 85,
    price: 180000,
    description: 'Διαμέρισμα 2 υπνοδωματίων με μπαλκόνι',
  },
  {
    name: 'Διαμέρισμα Α2',
    type: 'apartment',
    status: 'for-sale',
    floor: 1,
    floorId: 'floor_1',
    area: 95,
    price: 210000,
    description: 'Διαμέρισμα 3 υπνοδωματίων γωνιακό',
  },
  {
    name: 'Διαμέρισμα Β1',
    type: 'apartment',
    status: 'available',
    floor: 2,
    floorId: 'floor_2',
    area: 75,
    price: 165000,
    description: 'Διαμέρισμα 2 υπνοδωματίων με θέα',
  },
  {
    name: 'Στούντιο Γ1',
    type: 'studio',
    status: 'for-sale',
    floor: 3,
    floorId: 'floor_3',
    area: 45,
    price: 95000,
    description: 'Στούντιο ιδανικό για φοιτητές',
  },
  {
    name: 'Κατάστημα Ισογείου',
    type: 'shop',
    status: 'for-rent',
    floor: 0,
    floorId: 'floor_0',
    area: 120,
    price: 250000,
    description: 'Κατάστημα στο ισόγειο με βιτρίνα',
  },
  {
    name: 'Αποθήκη Υπογείου Α1',
    type: 'storage',
    status: 'available',
    floor: -1,
    floorId: 'floor_-1',
    area: 15,
    price: 12000,
    description: 'Αποθήκη στο υπόγειο',
  },
  {
    name: 'Μεζονέτα Δ1',
    type: 'maisonette',
    status: 'reserved',
    floor: 3,
    floorId: 'floor_3',
    area: 140,
    price: 320000,
    description: 'Μεζονέτα 3ου-4ου ορόφου με ταράτσα',
  },
];

interface UnitData {
  id: string;
  name: string;
  buildingId?: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    console.log('🔍 Analyzing units for migration...');

    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);

    const units: UnitData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      units.push({
        id: docSnap.id,
        name: data.name || 'UNNAMED',
        buildingId: data.buildingId,
        ...data,
      });
    });

    // Find legacy units (buildingId starts with "building_")
    const legacyUnits = units.filter((u) => {
      const bid = String(u.buildingId || '');
      return bid.startsWith('building_');
    });

    // Find enterprise units
    const enterpriseUnits = units.filter((u) => {
      const bid = String(u.buildingId || '');
      return !bid.startsWith('building_') && bid.length >= 20;
    });

    return NextResponse.json({
      success: true,
      mode: 'preview',
      totalUnits: units.length,
      legacyUnits: legacyUnits.length,
      enterpriseUnits: enterpriseUnits.length,
      legacyDetails: legacyUnits.map((u) => ({
        id: u.id,
        name: u.name,
        buildingId: u.buildingId,
      })),
      newUnitsToCreate: UNIT_TEMPLATES.length,
      targetBuilding: TARGET_ENTERPRISE_BUILDING,
      message: `Found ${legacyUnits.length} legacy units to delete. Will create ${UNIT_TEMPLATES.length} new enterprise units. Use POST to execute.`,
    });
  } catch (error) {
    console.error('❌ Error analyzing units:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze units',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting unit migration...');

    // Step 1: Get all units
    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);

    const units: UnitData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      units.push({
        id: docSnap.id,
        name: data.name || 'UNNAMED',
        buildingId: data.buildingId,
        ...data,
      });
    });

    // Step 2: Find and delete legacy units
    const legacyUnits = units.filter((u) => {
      const bid = String(u.buildingId || '');
      return bid.startsWith('building_');
    });

    console.log(`🗑️ Deleting ${legacyUnits.length} legacy units...`);

    let deletedCount = 0;
    for (const unit of legacyUnits) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.UNITS, unit.id));
        deletedCount++;
        console.log(`✅ Deleted: ${unit.id} (${unit.name})`);
      } catch (err) {
        console.error(`❌ Failed to delete ${unit.id}:`, err);
      }
    }

    // Step 3: Create new enterprise units
    console.log(`🏗️ Creating ${UNIT_TEMPLATES.length} new enterprise units...`);

    const createdUnits: Array<{ id: string; name: string }> = [];

    for (const template of UNIT_TEMPLATES) {
      try {
        const newUnit = {
          ...template,
          buildingId: TARGET_ENTERPRISE_BUILDING.id,
          projectId: TARGET_ENTERPRISE_BUILDING.projectId,
          building: TARGET_ENTERPRISE_BUILDING.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 🏢 ENTERPRISE: addDoc creates auto-generated Firebase ID (20 chars)
        const docRef = await addDoc(collection(db, COLLECTIONS.UNITS), newUnit);
        createdUnits.push({ id: docRef.id, name: template.name });
        console.log(`✅ Created: ${docRef.id} (${template.name})`);
      } catch (err) {
        console.error(`❌ Failed to create ${template.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete! Deleted ${deletedCount} legacy units, created ${createdUnits.length} enterprise units.`,
      deleted: deletedCount,
      created: createdUnits.length,
      createdUnits,
      targetBuilding: TARGET_ENTERPRISE_BUILDING,
    });
  } catch (error) {
    console.error('❌ Error during migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to migrate units',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
