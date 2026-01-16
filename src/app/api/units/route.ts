/**
 * 🏠 UNITS LIST ENDPOINT
 *
 * @module api/units
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: units:units:view (GET)
 * - Global Role: super_admin (POST - utility)
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { UNIT_SALE_STATUS } from '@/constants/property-statuses-enterprise';
import { COLLECTIONS } from '@/config/firestore-collections';

// Response types for type-safe withAuth
type UnitsListSuccess = {
  success: true;
  units: unknown[];
  count: number;
};

type UnitsListError = {
  success: false;
  error: string;
  details?: string;
};

type UnitsListResponse = UnitsListSuccess | UnitsListError;

export async function GET(request: NextRequest) {
  const handler = withAuth<UnitsListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<UnitsListResponse>> => {
      try {
        // 🏢 ENTERPRISE: Extract query parameters for filtering
        const { searchParams } = new URL(request.url);
        const buildingId = searchParams.get('buildingId');
        const floorId = searchParams.get('floorId');

        console.log(`🏠 [Units/List] Fetching units for tenant ${ctx.companyId}...`);
        console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);
        console.log(`📋 Filters: buildingId=${buildingId || 'all'}, floorId=${floorId || 'all'}`);

        // ============================================================================
        // TENANT-SCOPED QUERY (Admin SDK + Tenant Isolation)
        // ============================================================================

        const unitsSnapshot = await adminDb
          .collection(COLLECTIONS.UNITS)
          .where('companyId', '==', ctx.companyId)
          .orderBy('name', 'asc')
          .get();

        let units = unitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log(`🏠 Found ${units.length} units for tenant ${ctx.companyId}`);

        // 🏢 ENTERPRISE: Filter by buildingId if provided
        if (buildingId) {
          units = units.filter(unit => {
            const unitData = unit as Record<string, unknown> & { buildingId?: string };
            return unitData.buildingId === buildingId;
          });
          console.log(`🔍 Filtered by buildingId=${buildingId}: ${units.length} units`);
        }

        // 🏢 ENTERPRISE: Filter by floorId if provided
        if (floorId) {
          units = units.filter(unit => {
            const unitData = unit as Record<string, unknown> & { floorId?: string };
            return unitData.floorId === floorId;
          });
          console.log(`🔍 Filtered by floorId=${floorId}: ${units.length} units`);
        }

        console.log(`✅ [Units/List] Complete: ${units.length} units returned`);

        return NextResponse.json({
          success: true,
          units,
          count: units.length
        });

      } catch (error) {
        console.error('❌ [Units/List] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch units',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'units:units:view' }
  );

  return handler(request);
}

// Response types for POST (utility)
type LinkUnitsSuccess = {
  success: true;
  message: string;
  linkedUnits: number;
  updates: Array<{
    unitId: string;
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

export async function POST(request: NextRequest) {
  const handler = withAuth<LinkUnitsResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<LinkUnitsResponse>> => {
      try {
        console.log('🔗 [Units/LinkSold] Linking sold units to contacts...');
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

        // ============================================================================
        // STEP 1: GET CONTACTS (Admin SDK)
        // ============================================================================

        console.log('👤 Getting contacts...');
        const contactsSnapshot = await adminDb.collection(COLLECTIONS.CONTACTS).get();

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

        console.log(`Found ${contacts.length} contacts with names`);

        if (contacts.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No contacts found',
            details: 'Create contacts first before linking units'
          }, { status: 404 });
        }

        // ============================================================================
        // STEP 2: GET SOLD UNITS (Admin SDK)
        // ============================================================================

        console.log('🏠 Getting sold units...');
        const unitsSnapshot = await adminDb.collection(COLLECTIONS.UNITS).get();

        const soldUnitsToLink: Array<{ id: string; buildingId?: unknown }> = [];
        unitsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.status === 'sold' && (!data.soldTo || data.soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            soldUnitsToLink.push({
              id: doc.id,
              buildingId: data.buildingId
            });
          }
        });

        console.log(`Found ${soldUnitsToLink.length} sold units without contacts`);

        if (soldUnitsToLink.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'All sold units already have contacts!',
            linkedUnits: 0,
            updates: []
          });
        }

        // ============================================================================
        // STEP 3: LINK UNITS TO CONTACTS (Admin SDK)
        // ============================================================================

        const updates: Array<{ unitId: string; contactId: string; contactName: string }> = [];
        for (let i = 0; i < Math.min(soldUnitsToLink.length, contacts.length * 3); i++) {
          const unit = soldUnitsToLink[i];
          const contact = contacts[i % contacts.length]; // Cycle through contacts

          updates.push({
            unitId: unit.id,
            contactId: contact.id,
            contactName: contact.name
          });
        }

        console.log(`🔗 Linking ${updates.length} units to contacts...`);

        // Perform updates using Admin SDK
        for (const update of updates) {
          await adminDb.collection(COLLECTIONS.UNITS).doc(update.unitId).update({
            soldTo: update.contactId
          });

          console.log(`✅ Unit ${update.unitId} → Contact ${update.contactName} (${update.contactId})`);
        }

        console.log(`✅ [Units/LinkSold] Complete: Linked ${updates.length} units`);

        return NextResponse.json({
          success: true,
          message: `Successfully linked ${updates.length} units to contacts!`,
          linkedUnits: updates.length,
          updates: updates
        });

      } catch (error) {
        console.error('❌ [Units/LinkSold] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to link units to contacts',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
}