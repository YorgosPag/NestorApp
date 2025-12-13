import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('💥 FORCE UPDATE: Εξαναγκασμένη ενημέρωση βάσης δεδομένων!');

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    // STEP 1: Βρίσκουμε τα sold units που χρειάζονται update
    const unitsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/units`;
    const unitsResponse = await fetch(unitsUrl);

    if (!unitsResponse.ok) {
      throw new Error(`Failed to fetch units: ${unitsResponse.status}`);
    }

    const unitsData = await unitsResponse.json();
    console.log('📊 Raw units data:', unitsData);

    // Βρίσκουμε sold units χωρίς customers
    const unitsToUpdate = [];
    if (unitsData.documents) {
      unitsData.documents.forEach((doc, index) => {
        const fields = doc.fields || {};
        const status = fields.status?.stringValue;
        const soldTo = fields.soldTo?.stringValue;
        const name = fields.name?.stringValue;

        if (status === 'sold' && (!soldTo || soldTo === 'Not sold')) {
          unitsToUpdate.push({
            documentPath: doc.name,
            id: doc.name.split('/').pop(),
            name: name || `Unit ${index + 1}`,
            currentSoldTo: soldTo || 'null'
          });
        }
      });
    }

    console.log(`🎯 Βρέθηκαν ${unitsToUpdate.length} units για update`);
    console.log('📋 Units to update:', unitsToUpdate);

    if (unitsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Δεν βρέθηκαν units που χρειάζονται update',
        updatesApplied: 0
      });
    }

    // STEP 2: Δημιουργούμε απλούς contact IDs και τους εφαρμόζουμε
    const contactIds = [
      'customer_001',
      'customer_002',
      'customer_003',
      'customer_004',
      'customer_005',
      'customer_006',
      'customer_007',
      'customer_008'
    ];

    const successfulUpdates = [];
    const failedUpdates = [];

    // STEP 3: Κάνουμε τα updates ένα προς ένα
    for (let i = 0; i < unitsToUpdate.length; i++) {
      const unit = unitsToUpdate[i];
      const contactId = contactIds[i % contactIds.length];

      try {
        console.log(`🔄 Updating unit ${unit.name} (${unit.id}) → ${contactId}`);

        const updateUrl = `https://firestore.googleapis.com/v1/${unit.documentPath}?updateMask.fieldPaths=soldTo`;

        const updatePayload = {
          fields: {
            soldTo: {
              stringValue: contactId
            }
          }
        };

        console.log(`📤 UPDATE REQUEST:`, {
          url: updateUrl,
          payload: updatePayload
        });

        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatePayload)
        });

        const responseText = await updateResponse.text();
        console.log(`📥 UPDATE RESPONSE (${updateResponse.status}):`, responseText);

        if (updateResponse.ok) {
          successfulUpdates.push({
            unitId: unit.id,
            unitName: unit.name,
            contactId: contactId,
            previousSoldTo: unit.currentSoldTo
          });
          console.log(`✅ SUCCESS: Unit ${unit.name} updated successfully!`);
        } else {
          failedUpdates.push({
            unitId: unit.id,
            unitName: unit.name,
            error: `HTTP ${updateResponse.status}: ${responseText}`
          });
          console.log(`❌ FAILED: Unit ${unit.name} update failed: ${updateResponse.status}`);
        }

      } catch (error) {
        console.error(`💥 ERROR updating unit ${unit.name}:`, error);
        failedUpdates.push({
          unitId: unit.id,
          unitName: unit.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 FORCE UPDATE COMPLETE:`);
    console.log(`  ✅ Successful: ${successfulUpdates.length}`);
    console.log(`  ❌ Failed: ${failedUpdates.length}`);

    return NextResponse.json({
      success: true,
      message: `FORCE UPDATE: ${successfulUpdates.length} units updated successfully!`,
      updatesApplied: successfulUpdates.length,
      updatesFailed: failedUpdates.length,
      successfulUpdates: successfulUpdates,
      failedUpdates: failedUpdates
    });

  } catch (error) {
    console.error('💥 FORCE UPDATE ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'Force update failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}