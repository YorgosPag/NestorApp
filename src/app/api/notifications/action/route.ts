/**
 * 🔔 NOTIFICATIONS API - EXECUTE ACTION
 *
 * Records user's execution of a notification action (e.g., "View", "Dismiss", "Remind me later").
 *
 * @module api/notifications/action
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added RBAC protection + ownership validation
 *
 * 🔒 SECURITY:
 * - Permission: notifications:notifications:view
 * - Admin SDK for secure server-side operations
 * - Ownership validation: User can only execute actions on their own notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// Response types for type-safe withAuth
type ActionSuccess = {
  success: true;
  message: string;
};

type ActionError = {
  success: false;
  error: string;
  details?: string;
};

type ActionResponse = ActionSuccess | ActionError;

export async function POST(request: NextRequest) {
  const handler = withAuth<ActionResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ActionResponse>> => {
      try {
        const body = await req.json();
        const { id, actionId } = body;

        if (!id || !actionId) {
          return NextResponse.json({
            success: false,
            error: 'Invalid request: id and actionId are required'
          }, { status: 400 });
        }

        console.log(`🔔 [Notifications/Action] User ${ctx.uid} executing action ${actionId} on notification ${id}...`);

        // CRITICAL: Ownership validation - verify notification belongs to this user
        const notificationRef = adminDb.collection(COLLECTIONS.NOTIFICATIONS).doc(id);
        const notificationDoc = await notificationRef.get();

        if (!notificationDoc.exists) {
          return NextResponse.json({
            success: false,
            error: 'Notification not found'
          }, { status: 404 });
        }

        const notificationData = notificationDoc.data();
        if (notificationData?.userId !== ctx.uid) {
          console.warn(`⚠️ [Notifications/Action] Unauthorized attempt to execute action:`, {
            userId: ctx.uid,
            notificationId: id,
            notificationOwnerId: notificationData?.userId
          });

          return NextResponse.json({
            success: false,
            error: 'Unauthorized: You can only execute actions on your own notifications'
          }, { status: 403 });
        }

        // Record the action
        await notificationRef.update({
          actionTaken: actionId,
          actionTakenAt: new Date().toISOString()
        });

        console.log(`✅ [Notifications/Action] Action recorded successfully`);

        return NextResponse.json({
          success: true,
          message: 'Notification action recorded successfully'
        });
      } catch (error) {
        console.error('❌ [Notifications/Action] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to record notification action',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
}
