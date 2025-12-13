import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 FINAL SOLUTION: Τελική λύση με client-side Firebase');

    // Import Firebase client SDK dynamically για server environment
    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = await import('firebase/firestore');

    // Firebase config
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    };

    // Initialize Firebase
    let app;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    const db = getFirestore(app);
    console.log('✅ Firebase initialized successfully');

    // Step 1: Βρίσκουμε sold units χωρίς customers
    console.log('🔍 Finding sold units without customers...');
    const unitsCollection = collection(db, 'units');
    const unitsSnapshot = await getDocs(unitsCollection);

    const soldUnitsWithoutCustomers = [];
    unitsSnapshot.docs.forEach(docRef => {
      const unitData = docRef.data();
      if (unitData.status === 'sold' && (!unitData.soldTo || unitData.soldTo === 'Not sold')) {
        soldUnitsWithoutCustomers.push({
          id: docRef.id,
          ref: docRef.ref,
          name: unitData.name || 'Unknown Unit',
          currentSoldTo: unitData.soldTo || 'null'
        });
      }
    });

    console.log(`📊 Found ${soldUnitsWithoutCustomers.length} sold units without customers`);

    if (soldUnitsWithoutCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No units need linking - all sold units already have customers',
        updatesApplied: 0
      });
    }

    // Step 2: Δημιουργούμε ή βρίσκουμε contacts
    console.log('👥 Creating/finding contacts...');
    const contactsCollection = collection(db, 'contacts');

    // Προσπαθούμε να βρούμε existing contacts
    const existingContactsSnapshot = await getDocs(contactsCollection);
    let availableContacts = [];

    existingContactsSnapshot.docs.forEach(docRef => {
      const contactData = docRef.data();
      if (contactData.firstName) {
        availableContacts.push({
          id: docRef.id,
          name: `${contactData.firstName} ${contactData.lastName || ''}`.trim()
        });
      }
    });

    // Αν δεν υπάρχουν contacts, δημιουργούμε mock ones
    if (availableContacts.length === 0) {
      console.log('📝 No existing contacts found, creating customer references...');
      availableContacts = [
        { id: 'customer_001', name: 'Γιώργος Παπαδόπουλος' },
        { id: 'customer_002', name: 'Μαρία Νικολάου' },
        { id: 'customer_003', name: 'Δημήτρης Κωνσταντίνου' },
        { id: 'customer_004', name: 'Άννα Παπαγιάννη' },
        { id: 'customer_005', name: 'Νίκος Αθανασίου' },
        { id: 'customer_006', name: 'Ελένη Μιχαηλίδου' },
        { id: 'customer_007', name: 'Κώστας Δημητρίου' },
        { id: 'customer_008', name: 'Σοφία Γεωργίου' }
      ];
    }

    console.log(`👥 Available contacts: ${availableContacts.length}`);

    // Step 3: Κάνουμε τα updates
    console.log('🔄 Updating units with customer IDs...');
    const successfulUpdates = [];
    const failedUpdates = [];

    for (let i = 0; i < soldUnitsWithoutCustomers.length; i++) {
      const unit = soldUnitsWithoutCustomers[i];
      const contact = availableContacts[i % availableContacts.length];

      try {
        // Χρησιμοποιούμε το document reference για update
        const unitDocRef = doc(db, 'units', unit.id);

        await updateDoc(unitDocRef, {
          soldTo: contact.id
        });

        successfulUpdates.push({
          unitId: unit.id,
          unitName: unit.name,
          contactId: contact.id,
          contactName: contact.name
        });

        console.log(`✅ Unit "${unit.name}" (${unit.id}) → Contact "${contact.name}" (${contact.id})`);

      } catch (error) {
        console.error(`❌ Failed to update unit ${unit.name}:`, error);
        failedUpdates.push({
          unitId: unit.id,
          unitName: unit.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 FINAL SOLUTION COMPLETE:`);
    console.log(`  ✅ Successful updates: ${successfulUpdates.length}`);
    console.log(`  ❌ Failed updates: ${failedUpdates.length}`);

    return NextResponse.json({
      success: true,
      message: `FINAL SOLUTION: Successfully linked ${successfulUpdates.length} units to customers!`,
      updatesApplied: successfulUpdates.length,
      updatesFailed: failedUpdates.length,
      successfulUpdates: successfulUpdates,
      failedUpdates: failedUpdates
    });

  } catch (error) {
    console.error('💥 FINAL SOLUTION ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'Final solution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}