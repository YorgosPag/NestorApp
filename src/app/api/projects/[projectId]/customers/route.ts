import { NextRequest, NextResponse } from 'next/server';
import { firebaseServer } from '@/lib/firebase-server';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    console.log(`👥 API: Loading project customers for projectId: ${projectId}`);

    // 🔧 Quick Firebase Check
    if (!firebaseServer.getFirestore()) {
      console.error('❌ Firebase not initialized properly');
      return NextResponse.json({
        success: false,
        error: 'Database connection not available - Firebase not initialized',
        projectId
      }, { status: 503 });
    }

    // Get buildings for this project (handle both string and number projectId)
    console.log(`🏢 Fetching buildings for projectId: ${projectId} (trying both string and number)`);

    // Try with string projectId first
    let buildingsSnapshot = await firebaseServer.getDocs('buildings', [
      { field: 'projectId', operator: '==', value: projectId }
    ]);

    // If no results, try with number projectId
    if (buildingsSnapshot.docs.length === 0) {
      console.log(`🔄 No buildings found with string projectId, trying number: ${parseInt(projectId)}`);
      buildingsSnapshot = await firebaseServer.getDocs('buildings', [
        { field: 'projectId', operator: '==', value: parseInt(projectId) }
      ]);
    }

    if (buildingsSnapshot.docs.length === 0) {
      console.log(`⚠️ No buildings found for projectId: ${projectId}`);
      return NextResponse.json([]);
    }

    console.log(`🏢 Found ${buildingsSnapshot.docs.length} buildings`);

    // Get all units from all buildings
    const buildingIds = buildingsSnapshot.docs.map(doc => doc.id);  // Use building ID directly
    const allUnits = [];

    for (const buildingId of buildingIds) {
      console.log(`🏠 Fetching units for buildingId: ${buildingId}`);
      const unitsSnapshot = await firebaseServer.getDocs('units', [
        { field: 'buildingId', operator: '==', value: buildingId }
      ]);

      const units = unitsSnapshot.docs.map(unitDoc => ({
        id: unitDoc.id,
        ...unitDoc.data()
      }));

      allUnits.push(...units);
    }

    console.log(`🏠 Total units found: ${allUnits.length}`);

    // Filter sold units and count by customer
    const soldUnits = allUnits.filter(u => u.status === 'sold' && u.soldTo);
    console.log(`💰 Sold units: ${soldUnits.length}`);

    // Debug: Show soldTo values
    const soldToValues = soldUnits.map(u => u.soldTo);
    console.log(`🔍 SoldTo values:`, soldToValues);

    if (soldUnits.length === 0) {
      console.log(`⚠️ No sold units found for projectId: ${projectId}`);
      return NextResponse.json({
        success: true,
        customers: [],
        projectId,
        summary: { customersCount: 0, soldUnitsCount: 0 }
      });
    }

    // Count units per customer
    const customerUnitCount: { [contactId: string]: number } = {};
    soldUnits.forEach(unit => {
      if (unit.soldTo) {
        customerUnitCount[unit.soldTo] = (customerUnitCount[unit.soldTo] || 0) + 1;
      }
    });

    const customerIds = Object.keys(customerUnitCount);
    console.log(`👥 Unique customers: ${customerIds.length}`, customerIds);

    if (customerIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get contact details for customers (Firestore limit: max 10 in array)
    const contactsSnapshot = await firebaseServer.getDocs('contacts', [
      { field: '__name__', operator: 'in', value: customerIds.slice(0, 10) }
    ]);

    console.log(`📇 Contacts found: ${contactsSnapshot.docs.length}`);

    // Debug mismatch between customerIds and found contacts
    const foundContactIds = contactsSnapshot.docs.map(doc => doc.id);
    console.log(`🔍 Searching for customerIds:`, customerIds);
    console.log(`✅ Found contact IDs:`, foundContactIds);
    console.log(`❌ Missing contact IDs:`, customerIds.filter(id => !foundContactIds.includes(id)));

    const customers = contactsSnapshot.docs.map(contactDoc => {
      const contact = { id: contactDoc.id, ...contactDoc.data() };
      return {
        contactId: contact.id,
        name: getContactDisplayName(contact),
        phone: getPrimaryPhone(contact) || null,
        unitsCount: customerUnitCount[contact.id] || 0,
      };
    });

    console.log(`✅ Project customers loaded successfully for projectId: ${projectId}`);
    console.log(`📊 Summary: ${customers.length} customers`);

    return NextResponse.json({
      success: true,
      customers,
      projectId,
      summary: {
        customersCount: customers.length,
        soldUnitsCount: soldUnits.length
      }
    });

  } catch (error) {
    console.error('❌ API: Error loading project customers:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Άγνωστο σφάλμα',
        projectId
      },
      { status: 500 }
    );
  }
}