/**
 * =============================================================================
 * GET /api/admin/role-management/audit-log — Query Audit Logs
 * =============================================================================
 *
 * Returns paginated audit log entries for the company.
 * Supports cursor-based pagination and filters (date range, actor, target, action).
 *
 * Auth: withAuth (super_admin, company_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/audit-log
 * @enterprise ADR-244 Phase B — Audit Log
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache, AuditAction } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:AuditLog');

// SSoT: Subcollection name from centralized config
import { SUBCOLLECTIONS } from '@/config/firestore-collections';
const AUDIT_COLLECTION = SUBCOLLECTIONS.COMPANY_AUDIT_LOGS;
const PAGE_SIZE = 50;

// =============================================================================
// TYPES
// =============================================================================

interface RawAuditDoc {
  action: string;
  actorId: string;
  targetId: string;
  targetType: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  timestamp: FirebaseFirestore.Timestamp;
  metadata: Record<string, unknown>;
}

// =============================================================================
// GET — Query Audit Logs (Paginated + Filtered)
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        const { searchParams } = new URL(request.url);

        // Parse query params
        const cursor = searchParams.get('cursor') ?? null;
        const dateFrom = searchParams.get('dateFrom') ?? null;
        const dateTo = searchParams.get('dateTo') ?? null;
        const actorId = searchParams.get('actorId') ?? null;
        const targetId = searchParams.get('targetId') ?? null;
        const action = searchParams.get('action') ?? null;
        const limit = Math.min(
          parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10),
          100
        );

        // Build base query — always ordered by timestamp DESC
        const auditRef = db
          .collection(COLLECTIONS.COMPANIES)
          .doc(ctx.companyId)
          .collection(AUDIT_COLLECTION);

        let query: FirebaseFirestore.Query = auditRef.orderBy('timestamp', 'desc');

        // Apply filters
        if (action && action !== 'all') {
          query = query.where('action', '==', action);
        }
        if (actorId) {
          query = query.where('actorId', '==', actorId);
        }
        if (targetId) {
          query = query.where('targetId', '==', targetId);
        }
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (!isNaN(fromDate.getTime())) {
            query = query.where('timestamp', '>=', fromDate);
          }
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          if (!isNaN(toDate.getTime())) {
            // Add 1 day to include the entire end date
            toDate.setDate(toDate.getDate() + 1);
            query = query.where('timestamp', '<=', toDate);
          }
        }

        // Cursor-based pagination
        if (cursor) {
          const cursorDoc = await auditRef.doc(cursor).get();
          if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
          }
        }

        // Fetch one extra to determine if there's a next page
        const snapshot = await query.limit(limit + 1).get();
        const hasMore = snapshot.docs.length > limit;
        const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

        // Collect unique user IDs for display name enrichment
        const userIds = new Set<string>();
        for (const doc of docs) {
          const data = doc.data() as RawAuditDoc;
          if (data.actorId) userIds.add(data.actorId);
          if (data.targetId && data.targetType === 'user') userIds.add(data.targetId);
        }

        // Batch-fetch user display names
        const userDisplayNames = new Map<string, string | null>();
        const userIdArray = Array.from(userIds);
        if (userIdArray.length > 0) {
          // Firestore IN query limit is 30, batch if needed
          const batches: string[][] = [];
          for (let i = 0; i < userIdArray.length; i += 30) {
            batches.push(userIdArray.slice(i, i + 30));
          }
          for (const batch of batches) {
            const usersSnap = await db
              .collection(COLLECTIONS.USERS)
              .where('__name__', 'in', batch)
              .select('displayName', 'email')
              .get();
            for (const userDoc of usersSnap.docs) {
              const userData = userDoc.data();
              userDisplayNames.set(
                userDoc.id,
                (userData.displayName as string) || (userData.email as string) || null
              );
            }
          }
        }

        // Map to frontend entries
        const entries = docs.map((doc) => {
          const data = doc.data() as RawAuditDoc;
          return {
            id: doc.id,
            action: data.action as AuditAction,
            actorId: data.actorId,
            actorDisplayName: userDisplayNames.get(data.actorId) ?? null,
            targetId: data.targetId,
            targetDisplayName: data.targetType === 'user'
              ? (userDisplayNames.get(data.targetId) ?? null)
              : null,
            targetType: data.targetType,
            previousValue: data.previousValue ?? null,
            newValue: data.newValue ?? null,
            timestamp: data.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            metadata: data.metadata ?? {},
          };
        });

        const nextCursor = hasMore ? docs[docs.length - 1].id : null;

        return NextResponse.json({
          success: true,
          data: {
            entries,
            total: entries.length,
            nextCursor,
          },
        });
      } catch (error) {
        logger.error('[AuditLog] Failed to fetch audit logs:', { error });
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 }
        );
      }
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] }
  )
);
