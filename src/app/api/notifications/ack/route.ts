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

        console.log(`🔔 [Notifications/Ack] User ${ctx.uid} marking ${ids.length} notifications as read...`);

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
          console.warn(`⚠️ [Notifications/Ack] Unauthorized attempt to ack notifications:`, {
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

          console.log(`✅ [Notifications/Ack] Marked ${ownedIds.length} notifications as read`);
        }

        return NextResponse.json({
          success: true,
          markedCount: ownedIds.length,
          message: `Marked ${ownedIds.length} notification(s) as read`
        });
      } catch (error) {
        console.error('❌ [Notifications/Ack] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
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
