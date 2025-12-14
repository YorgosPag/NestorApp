import { NextRequest, NextResponse } from 'next/server';
import { firebaseServer } from '@/lib/firebase-server';
import { getContactDisplayName, getPrimaryPhone, getPrimaryEmail } from '@/types/contacts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectId = 'unknown';

  try {
    // 🔧 ENTERPRISE: Safe parameter extraction
    const resolvedParams = await params;
    projectId = resolvedParams.projectId;
    console.log(`🏢 ENTERPRISE API: Loading project customers for projectId: ${projectId}`);

    // 🎯 ENTERPRISE Firebase Connection Test
    const firebaseDB = firebaseServer.getFirestore();
    console.log('🔍 FIREBASE CONNECTION TEST:', {
      isInitialized: !!firebaseDB,
      timestamp: new Date().toISOString()
    });

    if (!firebaseDB) {
      console.error('🚨 FIREBASE NOT INITIALIZED');
      return NextResponse.json({
        success: false,
        error: 'FIREBASE_NOT_INITIALIZED',
        message: 'Firebase database connection not available',
        customers: [],
        projectId,
        summary: { customersCount: 0, soldUnitsCount: 0 }
      }, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ FIREBASE INITIALIZED - Proceeding with customer lookup');

    // 🏢 STEP 1: Get buildings for this project (handle both string and number projectId)
    console.log(`🏢 Fetching buildings for projectId: ${projectId}`);

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
      return NextResponse.json({
        success: true,
        customers: [],
        projectId,
        summary: { customersCount: 0, soldUnitsCount: 0 },
        message: `No buildings found for project ${projectId}`
      }, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🏢 Found ${buildingsSnapshot.docs.length} buildings`);

    // 🏠 STEP 2: Get all units from all buildings
    const buildingIds = buildingsSnapshot.docs.map(doc => doc.id);
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

    // 💰 STEP 3: Filter sold units and extract customer IDs
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
        summary: { customersCount: 0, soldUnitsCount: 0 },
        message: 'No sold units found for this project'
      }, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 👥 STEP 4: Count units per customer
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
        projectId,
        summary: { customersCount: 0, soldUnitsCount: 0 },
        message: 'No customer IDs found in sold units'
      }, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 📇 STEP 5: Get contact details for customers (max 10 due to Firestore limit)
    console.log(`📇 Fetching contact details for ${customerIds.length} customers`);

    const contactsSnapshot = await firebaseServer.getDocs('contacts', [
      { field: '__name__', operator: 'in', value: customerIds.slice(0, 10) }
    ]);

    console.log(`📇 Contacts found in database: ${contactsSnapshot.docs.length}`);

    // Debug: Show which contacts were found vs missing
    const foundContactIds = contactsSnapshot.docs.map(doc => doc.id);
    console.log(`✅ Found contact IDs:`, foundContactIds);
    console.log(`❌ Missing contact IDs:`, customerIds.filter(id => !foundContactIds.includes(id)));

    // 🏢 STEP 6: Build customers array with contact details
    const customers = contactsSnapshot.docs.map(contactDoc => {
      const contact = { id: contactDoc.id, ...contactDoc.data() };
      return {
        contactId: contact.id,
        name: getContactDisplayName(contact),
        phone: getPrimaryPhone(contact) || null,
        email: getPrimaryEmail(contact) || null,
        unitsCount: customerUnitCount[contact.id] || 0,
      };
    });

    console.log(`✅ PROJECT CUSTOMERS LOADED SUCCESSFULLY`);
    console.log(`📊 Summary: ${customers.length} customers with ${soldUnits.length} sold units`);

    return NextResponse.json({
      success: true,
      customers,
      projectId,
      summary: {
        customersCount: customers.length,
        soldUnitsCount: soldUnits.length
      }
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🚨 ENTERPRISE ERROR: Critical failure in project customers API');
    console.error('📊 ERROR DETAILS:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'No stack trace available',
      projectId
    });

    return NextResponse.json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: error instanceof Error ? error.message : 'Critical system error occurred',
      customers: [],
      projectId: projectId,
      summary: { customersCount: 0, soldUnitsCount: 0 },
      timestamp: new Date().toISOString()
    }, {
      status: 200, // Return 200 to ensure JSON parsing
      headers: { 'Content-Type': 'application/json' }
    });
  }
}