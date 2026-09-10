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
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { markNotificationsSeen } from '@/server/notifications/notification-read';

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

        // 🔑 ADR-848 — ΕΝΑΣ συγγραφέας του «διαβάστηκε», κοινός με τον σύνδεσμο του email
        // (`/n/{id}`). Ο έλεγχος ιδιοκτησίας γίνεται ΑΝΑ ΕΓΓΡΑΦΟ, μέσα στον συγγραφέα.
        const requested = ids.filter((id: unknown): id is string => typeof id === 'string');
        const { marked, refused } = await markNotificationsSeen(ctx.uid, requested);

        if (refused.length > 0) {
          logger.warn('[Notifications/Ack] Unauthorized attempt to ack notifications', {
            userId: ctx.uid,
            unauthorizedIds: refused
          });
        }
        if (marked.length > 0) {
          logger.info('[Notifications/Ack] Marked notifications as read', { count: marked.length });
        }

        return NextResponse.json({
          success: true,
          markedCount: marked.length,
          message: `Marked ${marked.length} notification(s) as read`
        });
      } catch (error) {
        logger.error('[Notifications/Ack] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to mark notifications as read',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);
