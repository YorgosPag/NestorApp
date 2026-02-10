/**
 * 🔔 NOTIFICATIONS API - ACKNOWLEDGE (MARK AS READ)
 *
 * Marks user's notifications as read/seen.
 *
 * @module api/notifications/ack
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added RBAC protection + ownership validation
 * @rateLimit STANDARD (60 req/min) - Notification acknowledgment
 *
 * 🔒 SECURITY:
 * - Permission: notifications:notifications:view
 * - Admin SDK for secure server-side operations
 * - Ownership validation: User can only mark their own notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NotificationsAckRoute');

// Response types for type-safe withAuth
type AckSuccess = {
  success: true;
  markedCount: number;
  message: string;
};

type AckError = {
  success: false;
  error: string;
  details?: string;
};

type AckResponse = AckSuccess | AckError;

const basePOST = async (request: NextRequest) => {
  const handler = withAuth<AckResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<AckResponse>> => {
      try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Invalid request: ids must be a non-empty array'
          }, { status: 400 });
        }

        logger.info('[Notifications/Ack] Marking notifications as read', { userId: ctx.uid, count: ids.length });

        // CRITICAL: Ownership validation - fetch notifications to verify they belong to this user
        const notificationsRef = getAdminFirestore().collection(COLLECTIONS.NOTIFICATIONS);
        const notificationsSnapshot = await notificationsRef
          .where('__name__', 'in', ids.slice(0, 10)) // Firestore 'in' query limit is 10
          .get();

        // Validate ownership
        const ownedIds: string[] = [];
        const unauthorizedIds: string[] = [];

        notificationsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.userId === ctx.uid) {
            ownedIds.push(doc.id);
          } else {
            unauthorizedIds.push(doc.id);
          }
        });

        if (unauthorizedIds.length > 0) {
          logger.warn('[Notifications/Ack] Unauthorized attempt to ack notifications', {
            userId: ctx.uid,
            unauthorizedIds
          });
        }

        // Mark only owned notifications as read
        if (ownedIds.length > 0) {
          const batch = getAdminFirestore().batch();
          ownedIds.forEach(id => {
            const docRef = notificationsRef.doc(id);
            batch.update(docRef, {
              seen: true,
              seenAt: new Date().toISOString()
            });
          });
          await batch.commit();

          logger.info('[Notifications/Ack] Marked notifications as read', { count: ownedIds.length });
        }

        return NextResponse.json({
          success: true,
          markedCount: ownedIds.length,
          message: `Marked ${ownedIds.length} notification(s) as read`
        });
      } catch (error) {
        logger.error('[Notifications/Ack] Error', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.uid
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to mark notifications as read',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);
