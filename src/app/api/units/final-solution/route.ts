import { NextRequest, NextResponse } from 'next/server';
import { UNIT_SALE_STATUS } from '@/core/status/StatusConstants';
import { COLLECTIONS } from '@/config/firestore-collections';

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
    const unitsCollection = collection(db, COLLECTIONS.UNITS);
    const unitsSnapshot = await getDocs(unitsCollection);

    const soldUnitsWithoutCustomers = [];
    unitsSnapshot.docs.forEach(docRef => {
      const unitData = docRef.data();
      if (unitData.status === 'sold' && (!unitData.soldTo || unitData.soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
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
    const contactsCollection = collection(db, COLLECTIONS.CONTACTS);

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

    // Αν δεν υπάρχουν contacts, δημιουργούμε sample ones
    if (availableContacts.length === 0) {
      // 🏢 ENTERPRISE: Create contacts via create-sample API instead of hardcoded data
      console.log('📝 No existing contacts found, triggering contact creation...');

      try {
        // Trigger the create-sample API to create proper contacts with secure IDs
        const createResponse = await fetch('/api/contacts/create-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (createResponse.ok) {
          const createResult = await createResponse.json();
          console.log(`✅ Created ${createResult.contactsCount} contacts via API`);

          // Reload contacts from database
          const newContactsSnapshot = await adminDb.collection(COLLECTIONS.CONTACTS)
            .where('type', '==', 'individual')
            .limit(8)
            .get();

          availableContacts = newContactsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: `${doc.data().firstName} ${doc.data().lastName}`
          }));
        } else {
          throw new Error('Failed to create contacts via API');
        }
      } catch (error) {
        console.error('⚠️ Could not create contacts via API, using fallback:', error);

        // 🏢 ENTERPRISE: Generate contacts από environment configuration
        const fallbackNames = (
          process.env.NEXT_PUBLIC_SAMPLE_CONTACT_NAMES ||
          'Customer 1,Customer 2,Customer 3,Customer 4,Customer 5,Customer 6,Customer 7,Customer 8'
        ).split(',').map(name => name.trim());

        availableContacts = Array.from({ length: 8 }, (_, index) => ({
          id: `temp_contact_${Date.now()}_${index}`,
          name: fallbackNames[index] || `Customer ${index + 1}`
        }));
      }
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
        const unitDocRef = doc(db, COLLECTIONS.UNITS, unit.id);

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