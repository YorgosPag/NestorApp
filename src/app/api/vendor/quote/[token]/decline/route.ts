/**
 * POST /api/vendor/quote/[token]/decline — vendor declines invite (Q23).
 *
 * Public, withHeavyRateLimit. HMAC validated before Firestore lookup.
 * Stops further reminders + notifies PM.
 *
 * @module api/vendor/quote/[token]/decline
 * @enterprise ADR-327 §17 Q23
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { validateVendorPortalTokenSignature } from '@/services/vendor-portal/vendor-portal-token-service';
import {
  getVendorInviteByToken,
  markInviteDeclined,
} from '@/subapps/procurement/services/vendor-invite-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';

const logger = createModuleLogger('VENDOR_PORTAL_DECLINE_API');

const basePOST = async (
  request: NextRequest,
  context?: { params: Promise<{ token: string }> },
): Promise<NextResponse> => {
  try {
    if (!context) {
      return NextResponse.json({ success: false, error: 'missing_context' }, { status: 500 });
    }
    const { token: rawToken } = await context.params;
    const token = decodeURIComponent(rawToken);

    const sig = validateVendorPortalTokenSignature(token);
    if (!sig.valid) {
      return NextResponse.json({ success: false, error: sig.reason }, { status: 400 });
    }

    const invite = await getVendorInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ success: false, error: 'invite_not_found' }, { status: 404 });
    }
    if (invite.status === 'declined') {
      return NextResponse.json({ success: true, data: { alreadyDeclined: true } });
    }
    if (invite.status === 'submitted') {
      return NextResponse.json(
        { success: false, error: 'already_submitted' },
        { status: 409 },
      );
    }

    let reason: string | null = null;
    try {
      const body = await request.json().catch(() => null);
      if (body && typeof body === 'object' && typeof (body as { reason?: unknown }).reason === 'string') {
        reason = String((body as { reason: string }).reason).trim().slice(0, 1000) || null;
      }
    } catch {
      reason = null;
    }

    await markInviteDeclined(invite.id, reason);

    after(async () => {
      try {
        const rfq = await getRfq(invite.companyId, invite.rfqId);
        if (!rfq) return;
        await dispatchProcurementNotification(
          NOTIFICATION_EVENT_TYPES.PROCUREMENT_VENDOR_DECLINED,
          rfq.createdBy,
          invite.companyId,
          `Ο προμηθευτής αρνήθηκε το RFQ ${rfq.title}`,
          `${invite.id}_decline_${Date.now()}`,
          {
            entityId: invite.rfqId,
            entityType: NOTIFICATION_ENTITY_TYPES.RFQ,
            titleKey: 'quotes:quotes.notifications.vendorDeclined',
            titleParams: { vendorName: invite.vendorContactId, rfqTitle: rfq.title },
          },
        );
      } catch (err) {
        logger.warn('PM decline notification failed (non-blocking)', {
          inviteId: invite.id,
          err: getErrorMessage(err, 'unknown'),
        });
      }
    });

    return NextResponse.json({ success: true, data: { declined: true } });
  } catch (err) {
    const message = getErrorMessage(err, 'Vendor portal decline failed');
    logger.error('Vendor portal decline error', { error: message });
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
};

export const POST = withHeavyRateLimit(basePOST);
