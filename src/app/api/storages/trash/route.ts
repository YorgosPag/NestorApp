/**
 * 🗑️ STORAGES TRASH ENDPOINT
 *
 * Returns storage units with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted storage units.
 *
 * @module api/storages/trash
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

const logger = createModuleLogger('StoragesTrashRoute');

type TrashListSuccess = { success: true; storages: unknown[]; count: number };
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

          logger.info('Fetching deleted storage units', { companyId: tenantCompanyId, userId: ctx.uid });

          const db = getAdminFirestore();
          let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.STORAGE);

          if (isSuperAdmin && queryCompanyId) {
            query = query.where(FIELDS.COMPANY_ID, '==', queryCompanyId);
          } else {
            query = query.where(FIELDS.COMPANY_ID, '==', tenantCompanyId);
          }

          // ADR-281: Fetch ONLY soft-deleted records
          query = query.where('status', '==', 'deleted');

          const snapshot = await query.get();
          const storages = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              const aName = typeof (a as Record<string, unknown>).name === 'string' ? (a as Record<string, string>).name : '';
              const bName = typeof (b as Record<string, unknown>).name === 'string' ? (b as Record<string, string>).name : '';
              return aName.localeCompare(bName);
            });

          logger.info('Found deleted storage units', { count: storages.length });

          return NextResponse.json({ success: true, storages, count: storages.length });
        } catch (error) {
          logger.error('Error fetching deleted storage units', { error: getErrorMessage(error) });
          return NextResponse.json(
            { success: false, error: 'Failed to fetch deleted storage units', details: getErrorMessage(error) },
            { status: 500 }
          );
        }
      },
      { permissions: 'units:units:view' }
    );

    return handler(request);
  }
);
