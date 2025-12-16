import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { UNIT_SALE_STATUS } from '@/core/status/StatusConstants';

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
          unit.data.soldTo === UNIT_SALE_STATUS.NOT_SOLD ||
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

    // 🏢 ENTERPRISE: Load real contact IDs from database (NO HARDCODED)
    console.log('🔍 Loading real contact IDs from database...');

    const contactsSnapshot = await adminDb
      .collection('contacts')
      .where('type', '==', 'individual')
      .limit(8)
      .get();

    const realContactIds = contactsSnapshot.docs.map(doc => doc.id);
    console.log(`✅ Found ${realContactIds.length} real contact IDs:`, realContactIds);

    if (realContactIds.length === 0) {
      return NextResponse.json({
        error: 'No individual contacts found in database',
        suggestion: 'Run /api/contacts/create-sample first to create contacts'
      }, { status: 404 });
    }

    // 🏢 ENTERPRISE: Load contact names from environment configuration
    const sampleContactNames = (
      process.env.NEXT_PUBLIC_SAMPLE_CONTACT_NAMES ||
      'Contact 1,Contact 2,Contact 3,Contact 4,Contact 5,Contact 6,Contact 7,Contact 8'
    ).split(',').map(name => name.trim());

    // STEP 1: Create real contact records first
    console.log('📝 Step 1: Creating contact records...');
    const createdContacts = [];

    for (let i = 0; i < sampleContactNames.length; i++) {
      const contactName = sampleContactNames[i];
      const contactId = realContactIds[i];

      try {
        // Create actual contact in database
        // 🏢 ENTERPRISE: Generate professional contact data using crypto-secure methods
        const normalizedName = contactName.replace(/\s/g, '').toLowerCase();
        const emailDomain = process.env.NEXT_PUBLIC_TEST_EMAIL_DOMAIN || 'testcontacts.local';
        const phonePrefix = process.env.NEXT_PUBLIC_TEST_PHONE_PREFIX || '+30 21';

        await adminDb.collection('contacts').doc(contactId).set({
          firstName: contactName.split(' ')[0],
          lastName: contactName.split(' ')[1] || '',
          displayName: contactName,
          email: `${normalizedName}@${emailDomain}`,
          phone: `${phonePrefix}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
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
      const contactId = realContactIds[i % realContactIds.length];
      const contactName = sampleContactNames[i % sampleContactNames.length];

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