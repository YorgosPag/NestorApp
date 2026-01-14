import { NextRequest, NextResponse } from 'next/server';
import { db as getAdminDb } from '@/lib/firebase-admin';
import { getContactDisplayName, getPrimaryPhone, getPrimaryEmail, type Contact } from '@/types/contacts';
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

// Firestore 'in' query limit
const FIRESTORE_IN_LIMIT = 10;

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
          console.error('❌ Firebase Admin not initialized');
          return NextResponse.json({
            success: true,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            warning: 'Database connection not available - Firebase Admin not initialized'
          });
        }

        // 🔒 TENANT ISOLATION: Get tenant context
        const tenantCompanyId = ctx.companyId;
        console.log(`🏠 API: Loading building customers for buildingId: ${buildingId} (tenant: ${tenantCompanyId})`);

        // 🔒 TENANT ISOLATION: First verify building belongs to tenant's company
        const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

        if (!buildingDoc.exists) {
          return NextResponse.json({
            success: false,
            customers: [],
            buildingId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            error: 'Building not found'
          }, { status: 404 });
        }

        const buildingData = buildingDoc.data();
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

        // 🔒 TENANT ISOLATION: Query units with both companyId AND buildingId filters
        console.log(`🏠 Fetching units for buildingId: ${buildingId}`);
        const unitsSnapshot = await adminDb.collection(COLLECTIONS.UNITS)
          .where('companyId', '==', tenantCompanyId)
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
        const contactIdsToQuery = customerIds.slice(0, FIRESTORE_IN_LIMIT);
        if (customerIds.length > FIRESTORE_IN_LIMIT) {
          console.warn(`⚠️ Customer IDs exceed Firestore 'in' limit (${FIRESTORE_IN_LIMIT}). Only first ${FIRESTORE_IN_LIMIT} will be fetched.`);
        }

        // Query contacts with tenant isolation
        const contactsSnapshot = await adminDb.collection(COLLECTIONS.CONTACTS)
          .where('companyId', '==', tenantCompanyId)
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
