import { NextRequest, NextResponse } from 'next/server';
import { firebaseServer } from '@/lib/firebase-server';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildingId: string }> }
) {
  try {
    const { buildingId } = await params;
    console.log(`🏠 API: Loading building customers for buildingId: ${buildingId}`);

    // Firebase Check
    if (!firebaseServer.getFirestore()) {
      console.error('❌ Firebase not initialized properly');
      console.error('🔄 Returning empty customers list as fallback');
      return NextResponse.json({
        success: true,
        customers: [],
        buildingId,
        summary: { customersCount: 0, soldUnitsCount: 0 },
        warning: 'Database connection not available - Firebase not initialized'
      });
    }

    // Get all units for this building
    console.log(`🏠 Fetching units for buildingId: ${buildingId}`);
    const unitsSnapshot = await firebaseServer.getDocs('units', [
      { field: 'buildingId', operator: '==', value: buildingId }
    ]);

    const units = unitsSnapshot.docs.map(unitDoc => ({
      id: unitDoc.id,
      ...unitDoc.data()
    }));

    console.log(`🏠 Total units found: ${units.length}`);

    // Filter sold units
    const soldUnits = units.filter(u => u.status === 'sold' && u.soldTo);
    console.log(`💰 Sold units: ${soldUnits.length}`);

    // Debug: Show soldTo values
    const soldToValues = soldUnits.map(u => u.soldTo);
    console.log(`🔍 SoldTo values:`, soldToValues);

    if (soldUnits.length === 0) {
      console.log(`⚠️ No sold units found for buildingId: ${buildingId}`);
      return NextResponse.json({
        success: true,
        customers: [],
        buildingId,
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
      return NextResponse.json({
        success: true,
        customers: [],
        buildingId,
        summary: { customersCount: 0, soldUnitsCount: 0 }
      });
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

    console.log(`✅ Building customers loaded successfully for buildingId: ${buildingId}`);
    console.log(`📊 Summary: ${customers.length} customers`);

    return NextResponse.json({
      success: true,
      customers,
      buildingId,
      summary: {
        customersCount: customers.length,
        soldUnitsCount: soldUnits.length
      }
    });

  } catch (error) {
    console.error('❌ API: Error loading building customers:', error);

    // Always return valid JSON, never HTML
    const errorMessage = error instanceof Error ? error.message : 'Άγνωστο σφάλμα';
    console.error('🔄 Returning fallback response due to error:', errorMessage);

    return NextResponse.json({
      success: false,
      customers: [],
      buildingId: await params.then(p => p.buildingId).catch(() => 'unknown'),
      summary: { customersCount: 0, soldUnitsCount: 0 },
      error: errorMessage
    }, {
      status: 200,  // Return 200 instead of 500 to ensure JSON is parsed
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}