/**
 * POST /api/vendor/quote/decline — vendor declines invite (Q23).
 *
 * Public, withHeavyRateLimit, `Authorization: Bearer <link>` (ADR-876 §5). Goes through the
 * ONE door + resolver: it used to re-implement the chain and accepted an EXPIRED invite (Σ4).
 * Stops further reminders + notifies PM.
 *
 * @module api/vendor/quote/decline
 * @enterprise ADR-327 §17 Q23 · ADR-876 §5
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { markInviteDeclined } from '@/subapps/procurement/services/vendor-invite-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';
import {
  vendorDoorRefusal,
  withVendorLinkDoor,
  type OpenVendorInvite,
} from '@/server/vendor-portal/vendor-link-door';

const logger = createModuleLogger('VENDOR_PORTAL_DECLINE_API');

const MAX_REASON_CHARS = 1000;

async function readReason(request: NextRequest): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return null;
  const reason = (body as { reason?: unknown }).reason;
  return typeof reason === 'string' ? reason.trim().slice(0, MAX_REASON_CHARS) || null : null;
}

function notifyPm(opened: OpenVendorInvite): void {
  const { invite } = opened;
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
          titleKey: 'common-shared:quoteNotifications.vendorDeclined',
          titleParams: { vendorName: invite.recipientName ?? invite.vendorContactId, rfqTitle: rfq.title },
        },
      );
    } catch (err) {
      logger.warn('PM decline notification failed (non-blocking)', {
        inviteId: invite.id,
        err: getErrorMessage(err, 'unknown'),
      });
    }
  });
}

const basePOST = withVendorLinkDoor(
  {
    purpose: 'decline',
    // Δεύτερη άρνηση ⇒ ο αναλυτής βρίσκει `declined` και απαντά `alreadyDeclined` πριν από κάθε
    // εγγραφή· η εγγραφή είναι σκέτο `set` κατάστασης. Καμία πράξη δεν εκτελείται δύο φορές.
    idempotency: { mode: 'natural', why: 'second decline resolves to invite_declined before any write; the write is a plain status set' },
    onRefusal: (reason) =>
      reason === 'invite_declined'
        ? NextResponse.json({ success: true, data: { alreadyDeclined: true } })
        : vendorDoorRefusal(reason),
  },
  async (request, opened) => {
    await markInviteDeclined(opened.invite.id, await readReason(request));
    notifyPm(opened);
    return NextResponse.json({ success: true, data: { declined: true } });
  },
);

export const POST = withHeavyRateLimit(basePOST);
