/**
 * 🔔 NOTIFICATIONS API - USER NOTIFICATION LIST
 *
 * Provides access to user's personal notifications.
 *
 * @module api/notifications
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added RBAC protection
 * @rateLimit STANDARD (60 req/min) - User notification list fetching
 *
 * 🔒 SECURITY:
 * - Permission: notifications:notifications:view
 * - Admin SDK for secure server-side operations
 * - User isolation: Query filtered by ctx.uid
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { fetchNotifications } from '@/services/notificationService';
import type { Notification } from '@/types/notification';

// Response types for type-safe withAuth
// 🏢 ENTERPRISE: NotificationItem extends Notification for API responses
interface NotificationItem extends Notification {
  // Already has all properties from Notification
}

type NotificationsListSuccess = {
  success: true;
  items: NotificationItem[];
  cursor?: string;
  stats: {
    total: number;
    unseen?: number;
  };
};

type NotificationsListError = {
  success: false;
  error: string;
  details?: string;
};

type NotificationsListResponse = NotificationsListSuccess | NotificationsListError;

const baseGET = async (request: NextRequest) => {
  const handler = withAuth<NotificationsListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<NotificationsListResponse>> => {
      try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const unseenOnly = searchParams.get('unseen') === '1';

        console.log(`🔔 [Notifications/List] Fetching notifications for user ${ctx.uid}...`);
        console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);
        console.log(`📋 Filters: limit=${limit}, unseenOnly=${unseenOnly}`);

        // CRITICAL FIX: Use authenticated user's ID from context (NOT hardcoded!)
        const { items, cursor } = await fetchNotifications({
          userId: ctx.uid,
          limit,
          unseenOnly
        });

        // 🏢 ENTERPRISE: Count unseen using delivery.state
        const unseenCount = items.filter((item: Notification) => item.delivery.state !== 'seen').length;

        console.log(`✅ [Notifications/List] Complete: ${items.length} notifications (${unseenCount} unseen)`);

        return NextResponse.json({
          success: true,
          items,
          cursor: cursor?.id,
          stats: {
            total: items.length,
            unseen: unseenCount
          }
        });
      } catch (error) {
        console.error('❌ [Notifications/List] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch notifications',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(baseGET);
