/**
 * =============================================================================
 * NOTIFICATION DISPATCH API ENDPOINT
 * =============================================================================
 *
 * Server-side API για dispatch notifications από realtime message events.
 * Thin adapter που καλεί το centralized notification orchestrator.
 *
 * @module api/notifications/dispatch
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added super_admin protection
 * @enterprise Protocol-compliant (ZERO hardcoded, ZERO any, ZERO duplicates)
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import {
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
  NOTIFICATION_SEVERITIES,
  getCurrentEnvironment,
} from '@/config/notification-events';
import { COLLECTIONS } from '@/config/firestore-collections';
import { adminDb } from '@/lib/firebaseAdmin';

// ============================================================================
// TYPES (Protocol: ZERO any)
// ============================================================================

/**
 * Request body interface
 */
interface DispatchNotificationRequest {
  messageId: string;
  conversationId: string;
  recipientId: string;
  tenantId: string;
  direction: 'inbound' | 'outbound';
  content: {
    text: string;
  };
  channel: string;
}

/**
 * Response interface
 */
interface DispatchNotificationResponse {
  success: boolean;
  notificationId?: string;
  error?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate request body
 */
function validateRequest(body: unknown): body is DispatchNotificationRequest {
  if (!body || typeof body !== 'object') return false;

  const req = body as Partial<DispatchNotificationRequest>;

  return !!(
    req.messageId &&
    req.conversationId &&
    req.recipientId &&
    req.tenantId &&
    req.direction &&
    req.content?.text &&
    req.channel
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/notifications/dispatch
 *
 * Dispatch notification για νέο message από realtime listener.
 *
 * 🔒 SECURITY: Protected with super_admin role (AUTHZ Phase 2)
 */
export async function POST(request: NextRequest) {
  const handler = withAuth<DispatchNotificationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleDispatch(req, ctx);
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
}

async function handleDispatch(request: NextRequest, ctx: AuthContext): Promise<NextResponse<DispatchNotificationResponse>> {
  try {
    console.log(`🔔 [Notifications/Dispatch] Starting dispatch...`);
    console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

    // Parse request body
    const body = await request.json();

    // Validate
    if (!validateRequest(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Only dispatch για inbound messages (από χρήστη προς εφαρμογή)
    if (body.direction !== 'inbound') {
      return NextResponse.json(
        { success: true },
        { status: 200 }
      );
    }

    // Get contact name για notification title
    let contactName = 'Unknown Contact';
    try {
      const conversationDoc = await adminDb
        .collection(COLLECTIONS.CONVERSATIONS)
        .doc(body.conversationId)
        .get();

      if (conversationDoc.exists) {
        const conversationData = conversationDoc.data();
        contactName = conversationData?.contactName || contactName;
      }
    } catch (error) {
      console.error('[Notification/Dispatch] Failed to fetch contact name:', error);
      // Continue with default name
    }

    // Dispatch notification using centralized orchestrator
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.CRM_NEW_COMMUNICATION,
      recipientId: body.recipientId,
      tenantId: body.tenantId,
      title: `New message from ${contactName}`,
      body: body.content.text.substring(0, 100), // Preview first 100 chars
      severity: NOTIFICATION_SEVERITIES.INFO,
      source: {
        service: SOURCE_SERVICES.CRM,
        feature: 'communications',
        env: getCurrentEnvironment(),
      },
      eventId: body.messageId, // Use messageId για idempotency
      entityId: body.conversationId,
      entityType: 'contact' as const,
    });

    if (!result.success) {
      console.error('[Notification/Dispatch] Failed:', result.reason);
      return NextResponse.json(
        { success: false, error: result.reason },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notificationId: result.notificationId,
    });
  } catch (error) {
    console.error('[Notification/Dispatch] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
