import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { db as adminDb } from '@/lib/firebase-admin';
import { UNIT_SALE_STATUS } from '@/constants/property-statuses-enterprise';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(request: NextRequest) {
  try {
    // 🏢 ENTERPRISE: Extract query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const floorId = searchParams.get('floorId');

    console.log(`🏠 Fetching units from Firestore... (buildingId: ${buildingId || 'all'}, floorId: ${floorId || 'all'})`);

    // Get all units from the COLLECTIONS.UNITS collection
    const unitsQuery = query(
      collection(db, COLLECTIONS.UNITS),
      orderBy('name', 'asc')
    );

    const unitsSnapshot = await getDocs(unitsQuery);
    let units = unitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 🏢 ENTERPRISE: Filter by buildingId if provided
    if (buildingId) {
      units = units.filter(unit => {
        const unitData = unit as { buildingId?: string };
        return unitData.buildingId === buildingId;
      });
      console.log(`🔍 Filtered by buildingId=${buildingId}: ${units.length} units`);
    }

    // 🏢 ENTERPRISE: Filter by floorId if provided
    if (floorId) {
      units = units.filter(unit => {
        const unitData = unit as { floorId?: string };
        return unitData.floorId === floorId;
      });
      console.log(`🔍 Filtered by floorId=${floorId}: ${units.length} units`);
    }

    console.log(`✅ Successfully fetched ${units.length} units from Firestore`);

    return NextResponse.json({
      success: true,
      units,
      count: units.length
    });

  } catch (error) {
    console.error('❌ Error fetching units:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch units',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 Linking sold units to contacts...');

    const database = adminDb();
    if (!database) {
      return NextResponse.json({ error: 'Firebase admin not initialized' }, { status: 500 });
    }

    // Get Firebase Admin modules
    const admin = await import('firebase-admin/firestore');

    // Get contacts with names
    console.log('👤 Getting contacts...');
    const contactsSnapshot = await admin.getDocs(admin.collection(database, COLLECTIONS.CONTACTS));
    const contacts = [];
    contactsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.firstName && data.firstName.trim()) {
        contacts.push({
          id: doc.id,
          name: `${data.firstName} ${data.lastName || ''}`.trim()
        });
      }
    });

    console.log(`Found ${contacts.length} contacts with names:`, contacts);

    // Get sold units that are not linked
    console.log('🏠 Getting sold units...');
    const unitsSnapshot = await admin.getDocs(admin.collection(database, COLLECTIONS.UNITS));
    const soldUnitsToLink = [];

    unitsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'sold' && (!data.soldTo || data.soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
        soldUnitsToLink.push({
          id: doc.id,
          buildingId: data.buildingId
        });
      }
    });

    console.log(`Found ${soldUnitsToLink.length} sold units without contacts`);

    if (soldUnitsToLink.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All sold units already have contacts!',
        linkedUnits: 0
      });
    }

    // Link units to contacts (cycle through contacts)
    const updates = [];
    for (let i = 0; i < Math.min(soldUnitsToLink.length, contacts.length * 3); i++) {
      const unit = soldUnitsToLink[i];
      const contact = contacts[i % contacts.length]; // Cycle through contacts

      updates.push({
        unitId: unit.id,
        contactId: contact.id,
        contactName: contact.name
      });
    }

    console.log(`🔗 Linking ${updates.length} units to contacts...`);

    // Perform updates using Firebase Admin
    for (const update of updates) {
      await admin.updateDoc(admin.doc(database, COLLECTIONS.UNITS, update.unitId), {
        soldTo: update.contactId
      });

      console.log(`✅ Unit ${update.unitId} → Contact ${update.contactName} (${update.contactId})`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully linked ${updates.length} units to contacts!`,
      linkedUnits: updates.length,
      updates: updates
    });

  } catch (error) {
    console.error('❌ Error linking units:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to link units to contacts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}