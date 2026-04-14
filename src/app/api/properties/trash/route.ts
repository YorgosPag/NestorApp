/**
 * 🗑️ PROPERTIES TRASH ENDPOINT
 *
 * Returns properties with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted properties.
 *
 * @module api/properties/trash
 * @security Permission: properties:properties:view — same as normal list
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

const logger = createModuleLogger('PropertiesTrashRoute');

type TrashListSuccess = { success: true; properties: unknown[]; count: number };
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

          logger.info('[Properties/Trash] Fetching deleted properties', { companyId: tenantCompanyId, userId: ctx.uid });

          const db = getAdminFirestore();
          let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.PROPERTIES);

          if (isSuperAdmin && queryCompanyId) {
            query = query.where(FIELDS.COMPANY_ID, '==', queryCompanyId);
          } else {
            query = query.where(FIELDS.COMPANY_ID, '==', tenantCompanyId);
          }

          // ADR-281: Fetch ONLY soft-deleted records
          query = query.where('status', '==', 'deleted');

          const snapshot = await query.get();
          const properties = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              const aName = typeof (a as Record<string, unknown>).name === 'string' ? (a as Record<string, string>).name : '';
              const bName = typeof (b as Record<string, unknown>).name === 'string' ? (b as Record<string, string>).name : '';
              return aName.localeCompare(bName);
            });

          logger.info('[Properties/Trash] Found deleted properties', { count: properties.length });

          return NextResponse.json({ success: true, properties, count: properties.length });
        } catch (error) {
          logger.error('[Properties/Trash] Error', { error: getErrorMessage(error) });
          return NextResponse.json({ success: false, error: 'Failed to fetch deleted properties', details: getErrorMessage(error) }, { status: 500 });
        }
      },
      { permissions: 'properties:properties:view' }
    );

    return handler(request);
  }
);
