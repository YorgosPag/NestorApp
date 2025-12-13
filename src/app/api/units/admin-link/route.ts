import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST() {
  try {
    console.log('🔥 ADMIN SDK: Ξεκινάω πραγματικά updates...');

    // Έλεγχος αν το Admin SDK είναι διαθέσιμο
    if (!adminDb) {
      return NextResponse.json({
        error: 'Firebase Admin SDK not initialized',
        details: 'Service account credentials required'
      }, { status: 500 });
    }

    const unitsSnapshot = await adminDb.collection('units').get();

    // Debug: Show all sold units and their soldTo values
    const allSoldUnits = unitsSnapshot.docs
      .map(doc => ({ id: doc.id, data: doc.data() }))
      .filter(unit => unit.data.status === 'sold');

    console.log(`🔍 DEBUG: Found ${allSoldUnits.length} units with status='sold'`);
    allSoldUnits.forEach(unit => {
      console.log(`📋 Unit ${unit.id}: soldTo="${unit.data.soldTo}" (type: ${typeof unit.data.soldTo})`);
    });

    const soldUnitsToLink = unitsSnapshot.docs
      .map(doc => ({ id: doc.id, data: doc.data() }))
      .filter(unit => {
        const needsLinking = unit.data.status === 'sold' && (
          !unit.data.soldTo ||
          unit.data.soldTo === 'Not sold' ||
          unit.data.soldTo === 'customer...' ||
          typeof unit.data.soldTo === 'string' && unit.data.soldTo.startsWith('customer')
        );
        if (needsLinking) {
          console.log(`🔍 Unit ${unit.id} needs linking: soldTo="${unit.data.soldTo}"`);
        }
        return needsLinking;
      });

    console.log(`Βρέθηκαν ${soldUnitsToLink.length} units για σύνδεση`);

    if (soldUnitsToLink.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Δεν βρέθηκαν units που χρειάζονται linking',
        linkedCount: 0
      });
    }

    const mockContactIds = [
      'customer_001', 'customer_002', 'customer_003', 'customer_004',
      'customer_005', 'customer_006', 'customer_007', 'customer_008'
    ];

    const mockContactNames = [
      'Γιώργος Παπαδόπουλος', 'Μαρία Νικολάου', 'Δημήτρης Κωνσταντίνου', 'Άννα Παπαγιάννη',
      'Νίκος Αθανασίου', 'Ελένη Μιχαηλίδου', 'Κώστας Δημητρίου', 'Σοφία Γεωργίου'
    ];

    // STEP 1: Create real contact records first
    console.log('📝 Step 1: Creating contact records...');
    const createdContacts = [];

    for (let i = 0; i < mockContactNames.length; i++) {
      const contactName = mockContactNames[i];
      const contactId = mockContactIds[i];

      try {
        // Create actual contact in database
        await adminDb.collection('contacts').doc(contactId).set({
          firstName: contactName.split(' ')[0],
          lastName: contactName.split(' ')[1] || '',
          displayName: contactName,
          email: `${contactName.replace(/\s/g, '').toLowerCase()}@example.com`,
          phone: `+30 69${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
          type: 'individual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        createdContacts.push({ id: contactId, name: contactName });
        console.log(`✅ Created contact: ${contactName} (${contactId})`);

      } catch (contactError) {
        console.error(`❌ Failed to create contact ${contactName}:`, contactError);
      }
    }

    // STEP 2: Link units to contacts
    console.log('🔗 Step 2: Linking units to contacts...');
    let linked = 0;
    const updates = [];

    for (let i = 0; i < soldUnitsToLink.length; i++) {
      const unit = soldUnitsToLink[i];
      const contactId = mockContactIds[i % mockContactIds.length];
      const contactName = mockContactNames[i % mockContactNames.length];

      try {
        await adminDb.collection('units').doc(unit.id).update({
          soldTo: contactId
        });

        updates.push({
          unitId: unit.id,
          unitName: unit.data.name || 'Unknown Unit',
          contactId: contactId,
          contactName: contactName
        });

        console.log(`✅ LINKED: Unit "${unit.data.name}" (${unit.id}) → Contact "${contactName}" (${contactId})`);
        linked++;

      } catch (updateError) {
        console.error(`❌ Failed to update unit ${unit.id}:`, updateError);
      }
    }

    console.log(`🎉 ADMIN SDK COMPLETE: Successfully linked ${linked} units!`);

    return NextResponse.json({
      success: true,
      message: `🔥 ADMIN SDK: Created ${createdContacts.length} contacts and linked ${linked} units!`,
      contactsCreated: createdContacts.length,
      linkedCount: linked,
      updates: updates,
      createdContacts
    });

  } catch (error: any) {
    console.error('❌ Admin SDK error:', error);
    return NextResponse.json({
      error: error.message,
      details: 'Check server logs for more info'
    }, { status: 500 });
  }
}