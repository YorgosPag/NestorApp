import { NextRequest, NextResponse } from 'next/server';
import { firebaseServer } from '@/lib/firebase-server';
import { getContactDisplayName, getPrimaryPhone, getPrimaryEmail } from '@/types/contacts';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/** Customer info for building */
interface CustomerInfo {
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  unitsCount: number;
}

/** Response type for building customers API */
interface BuildingCustomersResponse {
  success: boolean;
  customers: CustomerInfo[];
  buildingId: string;
  summary: {
    customersCount: number;
    soldUnitsCount: number;
  };
  warning?: string;
  error?: string;
}

// Dynamic route handler wrapper
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  // Create authenticated handler
  const handler = withAuth<BuildingCustomersResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        // 🔒 TENANT ISOLATION: Log tenant context
        const tenantCompanyId = ctx.companyId;
        console.log(`🏠 API: Loading building customers for buildingId: ${buildingId} (tenant: ${tenantCompanyId})`);

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

        // 🔒 TENANT ISOLATION: First verify building belongs to tenant's company
        const buildingSnapshot = await firebaseServer.getDoc(COLLECTIONS.BUILDINGS, buildingId);
        if (!buildingSnapshot.exists()) {
          return NextResponse.json({
            success: false,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            error: 'Building not found'
          }, { status: 404 });
        }

        const buildingData = buildingSnapshot.data();
        if (buildingData?.companyId !== tenantCompanyId) {
          console.warn(`❌ Tenant isolation violation: User ${ctx.uid} (company: ${tenantCompanyId}) tried to access building ${buildingId} (company: ${buildingData?.companyId})`);
          return NextResponse.json({
            success: false,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            error: 'Access denied'
          }, { status: 403 });
        }

        // Get all units for this building (now verified to belong to tenant)
        console.log(`🏠 Fetching units for buildingId: ${buildingId}`);
        const unitsSnapshot = await firebaseServer.getDocs(COLLECTIONS.UNITS, [
          { field: 'buildingId', operator: '==', value: buildingId }
        ]);

        const units = unitsSnapshot.docs.map(unitDoc => ({
          id: unitDoc.id,
          ...unitDoc.data()
        }));

        console.log(`🏠 Total units found: ${units.length}`);

        // Filter sold units
        type UnitWithSoldTo = { id: string; status?: string; soldTo?: string };
        const soldUnits = units.filter((u): u is UnitWithSoldTo & { status: 'sold'; soldTo: string } =>
          (u as UnitWithSoldTo).status === 'sold' && !!(u as UnitWithSoldTo).soldTo
        );
        console.log(`💰 Sold units: ${soldUnits.length}`);

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
          customerUnitCount[unit.soldTo] = (customerUnitCount[unit.soldTo] || 0) + 1;
        });

        const customerIds = Object.keys(customerUnitCount);
        console.log(`👥 Unique customers: ${customerIds.length}`);

        if (customerIds.length === 0) {
          return NextResponse.json({
            success: true,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 }
          });
        }

        // Get contact details for customers (Firestore limit: max 10 in array)
        const contactsSnapshot = await firebaseServer.getDocs(COLLECTIONS.CONTACTS, [
          { field: '__name__', operator: 'in', value: customerIds.slice(0, 10) }
        ]);

        console.log(`📇 Contacts found: ${contactsSnapshot.docs.length}`);

        const customers: CustomerInfo[] = contactsSnapshot.docs.map(contactDoc => {
          const contact = { id: contactDoc.id, ...contactDoc.data() };
          return {
            contactId: contact.id,
            name: getContactDisplayName(contact),
            phone: getPrimaryPhone(contact) || null,
            email: getPrimaryEmail(contact) || null,
            unitsCount: customerUnitCount[contact.id] || 0,
          };
        });

        console.log(`✅ Building customers loaded successfully for buildingId: ${buildingId}`);

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

        return NextResponse.json({
          success: false,
          customers: [],
          buildingId,
          summary: { customersCount: 0, soldUnitsCount: 0 },
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'buildings:buildings:view' }
  );

  return handler(request);
}
