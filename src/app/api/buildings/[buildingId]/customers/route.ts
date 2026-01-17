import { NextRequest, NextResponse } from 'next/server';
import { db as getAdminDb } from '@/lib/firebase-admin';
import { getContactDisplayName, getPrimaryPhone, getPrimaryEmail, type Contact } from '@/types/contacts';
import { COLLECTIONS, FIRESTORE_LIMITS } from '@/config/firestore-collections';
import { withAuth, requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
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
        // 🔐 ADMIN SDK: Get server-side Firestore instance
        const adminDb = getAdminDb();
        if (!adminDb) {
          return NextResponse.json({
            success: true,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            warning: 'Database connection not available'
          });
        }

        // 🔒 TENANT ISOLATION: Centralized validation
        try {
          await requireBuildingInTenant({
            ctx,
            buildingId,
            path: `/api/buildings/${buildingId}/customers`
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Access denied';
          const status = errorMessage.includes('not found') ? 404 : 403;
          return NextResponse.json({
            success: false,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            error: errorMessage
          }, { status });
        }

        // 🔒 TENANT ISOLATION: Query units with both companyId AND buildingId filters
        console.log(`🏠 Fetching units for buildingId: ${buildingId}`);
        const unitsSnapshot = await adminDb.collection(COLLECTIONS.UNITS)
          .where('companyId', '==', ctx.companyId)
          .where('buildingId', '==', buildingId)
          .get();

        const units = unitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
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

        // 🔒 TENANT ISOLATION: Get contacts with tenant filter
        // Note: Firestore 'in' query has limit of 10 items
        // For enterprise scale, implement chunking or denormalization
        const contactIdsToQuery = customerIds.slice(0, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);
        if (customerIds.length > FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS) {
          console.warn(`⚠️ Customer IDs exceed Firestore 'in' limit (${FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS}). Only first ${FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS} will be fetched.`);
        }

        // Query contacts with tenant isolation
        const contactsSnapshot = await adminDb.collection(COLLECTIONS.CONTACTS)
          .where('companyId', '==', ctx.companyId)
          .where('__name__', 'in', contactIdsToQuery)
          .get();

        console.log(`📇 Contacts found: ${contactsSnapshot.docs.length}`);

        const customers: CustomerInfo[] = contactsSnapshot.docs.map(doc => {
          // Cast Firestore data to Contact type for helper functions
          const contactData = doc.data() as Omit<Contact, 'id'>;
          const contact: Contact = { id: doc.id, ...contactData } as Contact;
          return {
            contactId: doc.id,
            name: getContactDisplayName(contact),
            phone: getPrimaryPhone(contact) || null,
            email: getPrimaryEmail(contact) || null,
            unitsCount: customerUnitCount[doc.id] || 0,
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
