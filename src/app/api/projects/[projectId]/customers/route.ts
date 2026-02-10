/**
 * 🏗️ PROJECT CUSTOMERS ENDPOINT
 *
 * Returns customers who have purchased units in a specific project.
 * Multi-level query: Project → Buildings → Units → Contacts
 *
 * @module api/projects/[projectId]/customers
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view
 * - Tenant isolation: Verifies project ownership before querying
 * - Multi-level tenant checks: Buildings, Units, Contacts
 *
 * @rateLimit STANDARD (60 req/min) - Customer list με multi-collection queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent, requireProjectInTenant, TenantIsolationError } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getContactDisplayName, getPrimaryPhone, getPrimaryEmail } from '@/types/contacts';
import type { Contact } from '@/types/contacts';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIRESTORE_LIMITS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        if (!getAdminFirestore()) {
          return NextResponse.json({
            success: false,
            error: 'Database connection not available',
            customers: [],
            projectId,
            summary: { customersCount: 0, soldUnitsCount: 0 }
          }, { status: 503 });
        }

        // ============================================================================
        // STEP 1: VERIFY PROJECT OWNERSHIP (Centralized Tenant Isolation)
        // ============================================================================

        try {
          await requireProjectInTenant({
            ctx,
            projectId,
            path: `/api/projects/${projectId}/customers`
          });
        } catch (error) {
          // Enterprise: Typed error with explicit status (NO string parsing)
          if (error instanceof TenantIsolationError) {
            return NextResponse.json({
              success: false,
              error: error.message,
              customers: [],
              projectId,
              summary: { customersCount: 0, soldUnitsCount: 0 }
            }, { status: error.status });
          }
          throw error; // Re-throw unexpected errors
        }

        // ============================================================================
        // STEP 2: GET BUILDINGS FOR THIS PROJECT (Admin SDK + Tenant Filter)
        // ============================================================================

        console.log(`🏢 Fetching buildings for project`);

        let buildingsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.BUILDINGS)
          .where('projectId', '==', projectId)
          .where('companyId', '==', ctx.companyId)
          .get();

        // If no results, try with number projectId
        if (buildingsSnapshot.docs.length === 0) {
          console.log(`🔄 Trying numeric projectId`);
          buildingsSnapshot = await getAdminFirestore()
            .collection(COLLECTIONS.BUILDINGS)
            .where('projectId', '==', parseInt(projectId))
            .where('companyId', '==', ctx.companyId)
            .get();
        }

        if (buildingsSnapshot.docs.length === 0) {
          console.log(`⚠️ No buildings found for project`);
          return NextResponse.json({
            success: true,
            customers: [],
            projectId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            message: 'No buildings found for this project'
          }, { status: 200 });
        }

        console.log(`🏢 Found ${buildingsSnapshot.docs.length} buildings`);

        // ============================================================================
        // STEP 3: GET ALL UNITS FROM ALL BUILDINGS (Admin SDK + Tenant Filter)
        // ============================================================================

        const buildingIds = buildingsSnapshot.docs.map(doc => doc.id);
        const allUnits = [];

        for (const buildingId of buildingIds) {
          const unitsSnapshot = await getAdminFirestore()
            .collection(COLLECTIONS.UNITS)
            .where('buildingId', '==', buildingId)
            .where('companyId', '==', ctx.companyId)
            .get();

          const units = unitsSnapshot.docs.map(unitDoc => ({
            id: unitDoc.id,
            ...unitDoc.data()
          } as Record<string, unknown> & { id: string; status?: string; soldTo?: string }));

          allUnits.push(...units);
        }

        console.log(`🏠 Total units found: ${allUnits.length}`);

        // ============================================================================
        // STEP 4: FILTER SOLD UNITS AND EXTRACT CUSTOMER IDs
        // ============================================================================

        const soldUnits = allUnits.filter(u => u.status === 'sold' && u.soldTo);
        console.log(`💰 Sold units: ${soldUnits.length}`);

        if (soldUnits.length === 0) {
          console.log(`⚠️ No sold units found`);
          return NextResponse.json({
            success: true,
            customers: [],
            projectId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            message: 'No sold units found for this project'
          }, { status: 200 });
        }

        // ============================================================================
        // STEP 5: COUNT UNITS PER CUSTOMER
        // ============================================================================

        const customerUnitCount: { [contactId: string]: number } = {};
        soldUnits.forEach(unit => {
          if (unit.soldTo) {
            customerUnitCount[unit.soldTo] = (customerUnitCount[unit.soldTo] || 0) + 1;
          }
        });

        const customerIds = Object.keys(customerUnitCount);
        console.log(`👥 Unique customers: ${customerIds.length}`);

        if (customerIds.length === 0) {
          return NextResponse.json({
            success: true,
            customers: [],
            projectId,
            summary: { customersCount: 0, soldUnitsCount: 0 },
            message: 'No customer IDs found in sold units'
          }, { status: 200 });
        }

        // ============================================================================
        // STEP 6: GET CONTACT DETAILS (Admin SDK + Tenant Filter)
        // ============================================================================

        console.log(`📇 Fetching contact details`);

        // Use centralized Firestore IN limit constant
        const limitedCustomerIds = customerIds.slice(0, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);

        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .where('__name__', 'in', limitedCustomerIds)
          .get();

        // Filter contacts to ensure tenant isolation (extra safety)
        const tenantContacts = contactsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.companyId === ctx.companyId;
        });

        console.log(`📇 Contacts found: ${tenantContacts.length}`);

        if (tenantContacts.length < contactsSnapshot.docs.length) {
          console.warn(`🚫 Filtered out ${contactsSnapshot.docs.length - tenantContacts.length} contacts`);
        }

        // ============================================================================
        // STEP 7: BUILD CUSTOMERS ARRAY
        // ============================================================================

        const customers = tenantContacts.map(contactDoc => {
          // Firestore DocumentData → Contact (ADR-172: proper typing, no double assertion)
          const contactData = { id: contactDoc.id, ...contactDoc.data() } as Contact & { id: string };

          return {
            contactId: contactData.id,
            name: getContactDisplayName(contactData),
            phone: getPrimaryPhone(contactData) || null,
            email: getPrimaryEmail(contactData) || null,
            unitsCount: customerUnitCount[contactData.id] || 0,
          };
        });

        console.log(`✅ [Projects/Customers] Complete: ${customers.length} customers with ${soldUnits.length} sold units`);

        // Audit successful access
        await logAuditEvent(ctx, 'data_accessed', projectId, 'project', {
          metadata: {
            path: `/api/projects/${projectId}/customers`,
            reason: `Project customers accessed (${customers.length} customers, ${soldUnits.length} units)`
          }
        });

        return NextResponse.json({
          success: true,
          customers,
          projectId,
          summary: {
            customersCount: customers.length,
            soldUnitsCount: soldUnits.length
          }
        }, { status: 200 });

      } catch (error) {
        console.error('❌ [Projects/Customers] Error:', {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : 'No stack trace'
        });

        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load project customers',
          customers: [],
          projectId,
          summary: { customersCount: 0, soldUnitsCount: 0 },
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    },
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
});
