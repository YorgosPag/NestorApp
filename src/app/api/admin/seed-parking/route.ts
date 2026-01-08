/**
 * 🅿️ ENTERPRISE: API για seeding parking spots
 *
 * Αυτό το endpoint:
 * 1. Διαγράφει παλιά parking spots με legacy IDs (1,2,3...)
 * 2. Δημιουργεί νέα parking spots με enterprise IDs (park_xxxx...)
 * 3. Τα συνδέει με το σωστό buildingId
 *
 * @method GET - Προεπισκόπηση (dry run)
 * @method POST - Εκτέλεση seeding
 * @method DELETE - Διαγραφή όλων των parking spots
 *
 * USAGE:
 * - GET /api/admin/seed-parking → Preview τι θα γίνει
 * - POST /api/admin/seed-parking → Εκτέλεση seeding
 * - DELETE /api/admin/seed-parking → Διαγραφή όλων
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, doc, setDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateParkingId } from '@/services/enterprise-id.service';

// =============================================================================
// 🏢 ENTERPRISE CONFIGURATION
// =============================================================================

/**
 * Target building για τα νέα parking spots
 * Αυτό είναι το ΚΤΙΡΙΟ Α - Παλαιολόγου
 */
const TARGET_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
};

/**
 * 🅿️ Parking spot types
 */
type ParkingSpotType = 'standard' | 'handicapped' | 'motorcycle' | 'electric' | 'visitor';

/**
 * 🅿️ Parking spot status
 */
type ParkingSpotStatus = 'available' | 'occupied' | 'reserved' | 'sold' | 'maintenance';

/**
 * 🅿️ Enterprise Parking Spot Template
 */
interface ParkingSpotTemplate {
  number: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
  floor: string;
  location: string;
  area: number;
  price: number;
  notes?: string;
}

/**
 * 🅿️ 10 Parking spots templates με πλήρη δεδομένα
 */
const PARKING_TEMPLATES: ParkingSpotTemplate[] = [
  {
    number: 'P-001',
    type: 'standard',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Δεξιά της εισόδου',
    area: 12.5,
    price: 15000,
    notes: 'Εύκολη πρόσβαση από την κεντρική είσοδο',
  },
  {
    number: 'P-002',
    type: 'standard',
    status: 'sold',
    floor: 'Υπόγειο -1',
    location: 'Δεξιά της εισόδου',
    area: 12.5,
    price: 15000,
    notes: 'Πωλήθηκε στον ιδιοκτήτη Α1',
  },
  {
    number: 'P-003',
    type: 'handicapped',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Κοντά στον ανελκυστήρα',
    area: 15.0,
    price: 18000,
    notes: 'Θέση ΑμεΑ με ευρύτερο χώρο',
  },
  {
    number: 'P-004',
    type: 'standard',
    status: 'reserved',
    floor: 'Υπόγειο -1',
    location: 'Αριστερά της εισόδου',
    area: 12.5,
    price: 15000,
    notes: 'Κρατημένη για διαμέρισμα Β1',
  },
  {
    number: 'P-005',
    type: 'electric',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Κοντά στον πίνακα ρεύματος',
    area: 13.0,
    price: 20000,
    notes: 'Με σταθμό φόρτισης ηλεκτρικού οχήματος',
  },
  {
    number: 'P-006',
    type: 'motorcycle',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Γωνία βόρεια',
    area: 5.0,
    price: 5000,
    notes: 'Θέση μηχανής/σκούτερ',
  },
  {
    number: 'P-007',
    type: 'motorcycle',
    status: 'sold',
    floor: 'Υπόγειο -1',
    location: 'Γωνία βόρεια',
    area: 5.0,
    price: 5000,
    notes: 'Θέση μηχανής - πωλήθηκε',
  },
  {
    number: 'P-008',
    type: 'standard',
    status: 'available',
    floor: 'Υπόγειο -2',
    location: 'Κεντρική περιοχή',
    area: 12.5,
    price: 12000,
    notes: 'Υπόγειο -2, χαμηλότερη τιμή',
  },
  {
    number: 'P-009',
    type: 'visitor',
    status: 'available',
    floor: 'Ισόγειο',
    location: 'Μπροστά από την είσοδο',
    area: 14.0,
    price: 0,
    notes: 'Θέση επισκεπτών - κοινόχρηστη',
  },
  {
    number: 'P-010',
    type: 'standard',
    status: 'maintenance',
    floor: 'Υπόγειο -2',
    location: 'Πίσω αριστερά',
    area: 12.5,
    price: 12000,
    notes: 'Υπό συντήρηση - επισκευή δαπέδου',
  },
];

// =============================================================================
// 🅿️ API HANDLERS
// =============================================================================

/**
 * GET /api/admin/seed-parking
 * Preview - δείχνει τι θα γίνει χωρίς να αλλάξει τίποτα
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Fetch existing parking spots
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);
    const snapshot = await getDocs(query(parkingRef));

    const existingSpots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Generate preview of new IDs
    const previewIds = PARKING_TEMPLATES.map((template, index) => ({
      number: template.number,
      previewId: `park_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (θα δημιουργηθεί)`,
      buildingId: TARGET_BUILDING.id,
      type: template.type,
      status: template.status,
    }));

    return NextResponse.json({
      success: true,
      preview: true,
      message: 'Προεπισκόπηση seeding - δεν έγιναν αλλαγές',
      existing: {
        count: existingSpots.length,
        spots: existingSpots,
        willBeDeleted: true,
      },
      toCreate: {
        count: PARKING_TEMPLATES.length,
        targetBuilding: TARGET_BUILDING,
        spots: previewIds,
      },
      instructions: [
        'POST /api/admin/seed-parking → Για να εκτελεστεί το seeding',
        'DELETE /api/admin/seed-parking → Για να διαγραφούν όλα τα parking spots',
      ],
    });

  } catch (error) {
    console.error('Error in GET /api/admin/seed-parking:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to preview parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/seed-parking
 * Εκτέλεση seeding - διαγράφει τα παλιά και δημιουργεί νέα
 */
export async function POST(): Promise<NextResponse> {
  try {
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);

    // =======================================================================
    // STEP 1: Διαγραφή υπαρχόντων parking spots
    // =======================================================================
    console.log('🗑️ Διαγραφή υπαρχόντων parking spots...');

    const existingSnapshot = await getDocs(query(parkingRef));
    const deletedIds: string[] = [];

    for (const docSnapshot of existingSnapshot.docs) {
      await deleteDoc(doc(db, COLLECTIONS.PARKING_SPACES, docSnapshot.id));
      deletedIds.push(docSnapshot.id);
      console.log(`  ✓ Διαγράφηκε: ${docSnapshot.id}`);
    }

    console.log(`✅ Διαγράφηκαν ${deletedIds.length} parking spots`);

    // =======================================================================
    // STEP 2: Δημιουργία νέων parking spots με enterprise IDs
    // =======================================================================
    console.log('🅿️ Δημιουργία νέων parking spots...');

    const createdSpots: Array<{ id: string; number: string }> = [];
    const now = new Date();

    for (const template of PARKING_TEMPLATES) {
      // Generate enterprise ID
      const parkingId = generateParkingId();

      // Create full document
      const parkingDoc = {
        number: template.number,
        buildingId: TARGET_BUILDING.id,
        projectId: TARGET_BUILDING.projectId,
        type: template.type,
        status: template.status,
        floor: template.floor,
        location: template.location,
        area: template.area,
        price: template.price,
        notes: template.notes || '',
        // Metadata
        createdAt: now,
        updatedAt: now,
        createdBy: 'seed-parking-api',
      };

      // Use setDoc with enterprise ID (not addDoc which auto-generates)
      await setDoc(doc(db, COLLECTIONS.PARKING_SPACES, parkingId), parkingDoc);

      createdSpots.push({ id: parkingId, number: template.number });
      console.log(`  ✓ Δημιουργήθηκε: ${parkingId} (${template.number})`);
    }

    console.log(`✅ Δημιουργήθηκαν ${createdSpots.length} parking spots`);

    return NextResponse.json({
      success: true,
      message: `Seeding ολοκληρώθηκε! Διαγράφηκαν ${deletedIds.length}, δημιουργήθηκαν ${createdSpots.length} parking spots`,
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      created: {
        count: createdSpots.length,
        targetBuilding: TARGET_BUILDING,
        spots: createdSpots,
      },
    });

  } catch (error) {
    console.error('Error in POST /api/admin/seed-parking:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to seed parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/seed-parking
 * Διαγραφή όλων των parking spots
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);
    const snapshot = await getDocs(query(parkingRef));

    const deletedIds: string[] = [];

    for (const docSnapshot of snapshot.docs) {
      await deleteDoc(doc(db, COLLECTIONS.PARKING_SPACES, docSnapshot.id));
      deletedIds.push(docSnapshot.id);
    }

    return NextResponse.json({
      success: true,
      message: `Διαγράφηκαν ${deletedIds.length} parking spots`,
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/seed-parking:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
