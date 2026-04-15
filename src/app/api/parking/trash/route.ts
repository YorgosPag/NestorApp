/**
 * 🗑️ PARKING TRASH ENDPOINT
 *
 * Returns parking spots with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted parking spots.
 *
 * @module api/parking/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System
 * @security Permission: units:units:view — same as normal list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ParkingTrashRoute');

type TrashListSuccess = { success: true; parkingSpots: unknown[]; count: number };
type TrashListError = { success: false; error: string; details?: string };
type TrashListResponse = TrashListSuccess | TrashListError;

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<TrashListResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<TrashListResponse>> => {
        try {
          const { searchParams } = new URL(request.url);
          const queryCompanyId = searchParams.get('companyId');

          const isSuperAdmin = isRoleBypass(ctx.globalRole);
          const tenantCompanyId = isSuperAdmin && queryCompanyId ? queryCompanyId : ctx.companyId;

          logger.info('Fetching deleted parking spots', { companyId: tenantCompanyId, userId: ctx.uid });

          const db = getAdminFirestore();
          let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.PARKING_SPACES);

          if (isSuperAdmin && queryCompanyId) {
            query = query.where(FIELDS.COMPANY_ID, '==', queryCompanyId);
          } else {
            query = query.where(FIELDS.COMPANY_ID, '==', tenantCompanyId);
          }

          // ADR-281: Fetch ONLY soft-deleted records
          query = query.where('status', '==', 'deleted');

          const snapshot = await query.get();
          const parkingSpots = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              const aNum = typeof (a as Record<string, unknown>).number === 'string' ? (a as Record<string, string>).number : '';
              const bNum = typeof (b as Record<string, unknown>).number === 'string' ? (b as Record<string, string>).number : '';
              return aNum.localeCompare(bNum);
            });

          logger.info('Found deleted parking spots', { count: parkingSpots.length });

          return NextResponse.json({ success: true, parkingSpots, count: parkingSpots.length });
        } catch (error) {
          logger.error('Error fetching deleted parking spots', { error: getErrorMessage(error) });
          return NextResponse.json(
            { success: false, error: 'Failed to fetch deleted parking spots', details: getErrorMessage(error) },
            { status: 500 }
          );
        }
      },
      { permissions: 'units:units:view' }
    );

    return handler(request);
  }
);
