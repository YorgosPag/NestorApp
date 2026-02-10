import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getContactDisplayName, getPrimaryPhone, getPrimaryEmail, type Contact } from '@/types/contacts';
import { COLLECTIONS, FIRESTORE_LIMITS } from '@/config/firestore-collections';
import { withAuth, requireBuildingInTenant, TenantIsolationError } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingCustomersRoute');

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

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
// Dynamic route handler wrapper
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  // Create authenticated handler
  const handler = withStandardRateLimit(withAuth<BuildingCustomersResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        // 🔐 ADMIN SDK: Verify Firestore connection
        if (!getAdminFirestore()) {
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
          // Enterprise: Typed error with explicit status (NO string parsing)
          if (error instanceof TenantIsolationError) {
            return NextResponse.json({
              success: false,
              customers: [],
              buildingId,
              summary: { customersCount: 0, soldUnitsCount: 0 },
              error: error.message
            }, { status: error.status });
          }
          throw error; // Re-throw unexpected errors
        }

        // 🔒 TENANT ISOLATION: Query units with both companyId AND buildingId filters
        logger.info('Fetching units for building', { buildingId });
        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS)
          .where('companyId', '==', ctx.companyId)
          .where('buildingId', '==', buildingId)
          .get();

        const units = unitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        logger.info('Total units found', { count: units.length });

        // Filter sold units
        type UnitWithSoldTo = { id: string; status?: string; soldTo?: string };
        const soldUnits = units.filter((u): u is UnitWithSoldTo & { status: 'sold'; soldTo: string } =>
          (u as UnitWithSoldTo).status === 'sold' && !!(u as UnitWithSoldTo).soldTo
        );
        logger.info('Sold units', { count: soldUnits.length });

        if (soldUnits.length === 0) {
          logger.info('No sold units found for building', { buildingId });
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
        logger.info('Unique customers', { count: customerIds.length });

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
          logger.warn('Customer IDs exceed Firestore in limit', { limit: FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS, total: customerIds.length });
        }

        // Query contacts with tenant isolation
        const contactsSnapshot = await getAdminFirestore().collection(COLLECTIONS.CONTACTS)
          .where('companyId', '==', ctx.companyId)
          .where('__name__', 'in', contactIdsToQuery)
          .get();

        logger.info('Contacts found', { count: contactsSnapshot.docs.length });

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

        logger.info('Building customers loaded successfully', { buildingId });

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
        logger.error('Error loading building customers', { error });

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
  ));

  return handler(request);
}
