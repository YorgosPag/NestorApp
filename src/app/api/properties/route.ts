/**
 * 🏠 UNITS LIST ENDPOINT
 *
 * @module api/properties
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: properties:properties:view (GET)
 * - Global Role: super_admin (POST - utility)
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { UNIT_SALE_STATUS } from '@/constants/property-statuses-enterprise';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesRoute');

// Response types for type-safe withAuth
type UnitsListSuccess = {
  success: true;
  properties: unknown[];
  count: number;
};

type UnitsListError = {
  success: false;
  error: string;
  details?: string;
};

type UnitsListResponse = UnitsListSuccess | UnitsListError;

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<UnitsListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<UnitsListResponse>> => {
      try {
        // 🏢 ENTERPRISE: Extract query parameters for filtering
        const { searchParams } = new URL(request.url);
        const buildingId = searchParams.get('buildingId');
        const floorId = searchParams.get('floorId');
        const queryCompanyId = searchParams.get('companyId');

        // 🏢 ENTERPRISE: Super admin can access any company's properties
        const isSuperAdmin = isRoleBypass(ctx.globalRole);
        const tenantCompanyId = isSuperAdmin && queryCompanyId
          ? queryCompanyId
          : ctx.companyId;

        logger.info('[Properties/List] Fetching properties', { companyId: tenantCompanyId, userId: ctx.uid, buildingId: buildingId || 'all', floorId: floorId || 'all', isSuperAdmin });

        // ============================================================================
        // TENANT-SCOPED QUERY (Admin SDK + Tenant Isolation)
        // Super admin with buildingId: query by buildingId directly (units may
        // have different companyId than the building's companyId)
        // ============================================================================

        const db = getAdminFirestore();
        let unitsQuery;

        if (isSuperAdmin && buildingId) {
          // 🏢 ADR-232: Super admin by buildingId — skip companyId filter
          unitsQuery = db.collection(COLLECTIONS.PROPERTIES)
            .where(FIELDS.BUILDING_ID, '==', buildingId)
            .orderBy('name', 'asc');
        } else if (isSuperAdmin) {
          // 🏢 ADR-232: Super admin without buildingId — load ALL units
          unitsQuery = db.collection(COLLECTIONS.PROPERTIES)
            .orderBy('name', 'asc');
        } else {
          unitsQuery = db.collection(COLLECTIONS.PROPERTIES)
            .where(FIELDS.COMPANY_ID, '==', tenantCompanyId)
            .orderBy('name', 'asc');
        }

        const propertiesSnapshot = await unitsQuery.get();

        let properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        logger.info('[Properties/List] Found properties', { count: properties.length, companyId: tenantCompanyId, buildingId: buildingId || 'all' });

        // 🏢 ENTERPRISE: Filter by buildingId if provided (for non-super-admin path)
        if (buildingId && !isSuperAdmin) {
          properties = properties.filter(property => {
            const propData = property as Record<string, unknown> & { buildingId?: string };
            return propData.buildingId === buildingId;
          });
          logger.info('[Properties/List] Filtered by buildingId', { buildingId, count: properties.length });
        }

        // 🏢 ENTERPRISE: Filter by floorId if provided
        if (floorId) {
          properties = properties.filter(property => {
            const propData = property as Record<string, unknown> & { floorId?: string };
            return propData.floorId === floorId;
          });
          logger.info('[Properties/List] Filtered by floorId', { floorId, count: properties.length });
        }

        logger.info('[Properties/List] Complete', { count: properties.length });

        return NextResponse.json({
          success: true,
          properties,
          count: properties.length
        });

      } catch (error) {
        logger.error('[Properties/List] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch properties',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { permissions: 'properties:properties:view' }
  );

  return handler(request);
  }
);

// Response types for POST (utility)
type LinkUnitsSuccess = {
  success: true;
  message: string;
  linkedProperties: number;
  updates: Array<{
    propertyId: string;
    contactId: string;
    contactName: string;
  }>;
};

type LinkUnitsError = {
  success: false;
  error: string;
  details?: string;
};

type LinkUnitsResponse = LinkUnitsSuccess | LinkUnitsError;

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<LinkUnitsResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<LinkUnitsResponse>> => {
      try {
        logger.info('[Properties/LinkSold] Linking sold properties to contacts', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // ============================================================================
        // STEP 1: GET CONTACTS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/LinkSold] Getting contacts');
        const contactsSnapshot = await getAdminFirestore().collection(COLLECTIONS.CONTACTS).get();

        const contacts: Array<{ id: string; name: string }> = [];
        contactsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.firstName && typeof data.firstName === 'string' && data.firstName.trim()) {
            contacts.push({
              id: doc.id,
              name: `${data.firstName} ${data.lastName || ''}`.trim()
            });
          }
        });

        logger.info('[Properties/LinkSold] Found contacts with names', { count: contacts.length });

        if (contacts.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No contacts found',
            details: 'Create contacts first before linking properties'
          }, { status: 404 });
        }

        // ============================================================================
        // STEP 2: GET SOLD UNITS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/LinkSold] Getting sold properties');
        const propertiesSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).get();

        const soldPropertiesToLink: Array<{ id: string; buildingId?: unknown }> = [];
        propertiesSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.status === 'sold' && (!data.soldTo || data.soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            soldPropertiesToLink.push({
              id: doc.id,
              buildingId: data.buildingId
            });
          }
        });

        logger.info('[Properties/LinkSold] Found sold properties without contacts', { count: soldPropertiesToLink.length });

        if (soldPropertiesToLink.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'All sold properties already have contacts!',
            linkedProperties: 0,
            updates: []
          });
        }

        // ============================================================================
        // STEP 3: LINK UNITS TO CONTACTS (Admin SDK)
        // ============================================================================

        const updates: Array<{ propertyId: string; contactId: string; contactName: string }> = [];
        for (let i = 0; i < Math.min(soldPropertiesToLink.length, contacts.length * 3); i++) {
          const property = soldPropertiesToLink[i];
          const contact = contacts[i % contacts.length]; // Cycle through contacts

          updates.push({
            propertyId: property.id,
            contactId: contact.id,
            contactName: contact.name
          });
        }

        logger.info('[Properties/LinkSold] Linking properties to contacts', { count: updates.length });

        // Perform updates using Admin SDK
        for (const update of updates) {
          await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).doc(update.propertyId).update({
            soldTo: update.contactId
          });

          logger.info('[Properties/LinkSold] Property linked to contact', { propertyId: update.propertyId, contactName: update.contactName, contactId: update.contactId });
        }

        logger.info('[Properties/LinkSold] Complete', { linkedCount: updates.length });

        return NextResponse.json({
          success: true,
          message: `Successfully linked ${updates.length} properties to contacts!`,
          linkedProperties: updates.length,
          updates: updates
        });

      } catch (error) {
        logger.error('[Properties/LinkSold] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to link properties to contacts',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
  }
);
