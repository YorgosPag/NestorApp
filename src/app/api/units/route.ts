import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { db as adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🏠 Fetching units from Firestore...');

    // Get all units from the 'units' collection
    const unitsQuery = query(
      collection(db, 'units'),
      orderBy('name', 'asc')
    );
    
    const unitsSnapshot = await getDocs(unitsQuery);
    const units = unitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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
    const contactsSnapshot = await admin.getDocs(admin.collection(database, 'contacts'));
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
    const unitsSnapshot = await admin.getDocs(admin.collection(database, 'units'));
    const soldUnitsToLink = [];

    unitsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'sold' && (!data.soldTo || data.soldTo === 'Not sold')) {
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
      await admin.updateDoc(admin.doc(database, 'units', update.unitId), {
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