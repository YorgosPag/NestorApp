/**
 * GET  /api/vendor/quote/[token] — fetch invite + RFQ details for the vendor portal
 * POST /api/vendor/quote/[token] — vendor submits / edits a quote
 *
 * Public (no Firebase auth). Vendor identity is bound to the HMAC-signed token.
 *
 * Security model (ADR-327 §11):
 * - HMAC validation BEFORE any Firestore lookup (no DB hit on forged tokens)
 * - Timing-safe HMAC compare (handled by token service)
 * - withHeavyRateLimit (10 req/min) keyed on hashed IP
 * - Storage uploads via Admin SDK only
 * - submitterIp hashed before persisting
 * - Audit trail append-only via service layer
 *
 * Quote write goes directly through `vendor-portal-submit-service` (Admin SDK)
 * because the portal flow has no Firebase AuthContext — vendor identity is the
 * invite token. See ADR-327 §17 P3 changelog for the rationale.
 *
 * @module api/vendor/quote/[token]/route
 * @enterprise ADR-327 §7 + §11 — Phase 3 Vendor Portal
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createHash } from 'crypto';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateQuoteId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  validateVendorPortalToken,
  validateVendorPortalTokenSignature,
} from '@/services/vendor-portal/vendor-portal-token-service';
import {
  getVendorInviteByToken,
  markInviteOpened,
  markInviteSubmitted,
} from '@/subapps/procurement/services/vendor-invite-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import {
  findExistingPortalQuote,
  persistVendorQuote,
} from '@/subapps/procurement/services/vendor-portal-submit-service';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';
import type { Quote } from '@/subapps/procurement/types/quote';
import { jsonError, readFiles, readSubmission } from './parsing';
import { uploadVendorFiles } from './upload';

const logger = createModuleLogger('VENDOR_PORTAL_API');

export const maxDuration = 60;

const EDIT_WINDOW_HOURS = 72;

function getClientIpHash(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// =============================================================================
// GET
// =============================================================================

const baseGET = async (
  _request: NextRequest,
  context?: { params: Promise<{ token: string }> },
): Promise<NextResponse> => {
  try {
    if (!context) return jsonError('missing_context', 500);
    const { token: rawToken } = await context.params;
    const token = decodeURIComponent(rawToken);

    const sig = validateVendorPortalTokenSignature(token);
    if (!sig.valid) return jsonError(sig.reason, 400);

    const invite = await getVendorInviteByToken(token);
    if (!invite) return jsonError('invite_not_found', 404);
    if (invite.status === 'declined') return jsonError('token_revoked', 410, { status: 'declined' });
    if (invite.status === 'expired') return jsonError('token_expired', 410);

    const rfq = await getRfq(invite.companyId, invite.rfqId);
    if (!rfq) return jsonError('rfq_not_found', 404);

    after(async () => {
      try {
        await markInviteOpened(invite.id);
      } catch (err) {
        logger.warn('markInviteOpened failed', {
          inviteId: invite.id,
          err: getErrorMessage(err, 'unknown'),
        });
      }
    });

    const editWindowOpen =
      invite.status === 'submitted' &&
      !!invite.editWindowExpiresAt &&
      invite.editWindowExpiresAt.toDate() > new Date();

    const existing =
      invite.status === 'submitted'
        ? await findExistingPortalQuote(invite.companyId, invite.rfqId, invite.vendorContactId)
        : null;

    return NextResponse.json({
      success: true,
      data: {
        invite: {
          id: invite.id,
          status: invite.status,
          rfqId: invite.rfqId,
          vendorContactId: invite.vendorContactId,
          expiresAt: invite.expiresAt.toDate().toISOString(),
          editWindowExpiresAt: invite.editWindowExpiresAt?.toDate().toISOString() ?? null,
          editWindowOpen,
        },
        rfq: {
          id: rfq.id,
          title: rfq.title,
          description: rfq.description,
          lines: rfq.lines,
          deadlineDate: rfq.deadlineDate?.toDate().toISOString() ?? null,
        },
        quote: existing
          ? {
              id: existing.data.id,
              lines: existing.data.lines,
              totals: existing.data.totals,
              paymentTerms: existing.data.paymentTerms,
              deliveryTerms: existing.data.deliveryTerms,
              warranty: existing.data.warranty,
              notes: existing.data.notes,
              validUntil: existing.data.validUntil?.toDate().toISOString() ?? null,
              attachments: existing.data.attachments,
              status: existing.data.status,
            }
          : null,
      },
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Vendor portal GET failed');
    logger.error('Vendor portal GET error', { error: message });
    return jsonError('server_error', 500);
  }
};

// =============================================================================
// POST
// =============================================================================

const basePOST = async (
  request: NextRequest,
  context?: { params: Promise<{ token: string }> },
): Promise<NextResponse> => {
  try {
    if (!context) return jsonError('missing_context', 500);
    const { token: rawToken } = await context.params;
    const token = decodeURIComponent(rawToken);

    const validation = await validateVendorPortalToken(token, { markUsed: false });
    if (!validation.valid) return jsonError(validation.reason, 400);

    const invite = await getVendorInviteByToken(token);
    if (!invite) return jsonError('invite_not_found', 404);
    if (invite.status === 'declined') return jsonError('token_revoked', 410);
    if (invite.status === 'expired') return jsonError('token_expired', 410);

    const isFirstSubmission = invite.status !== 'submitted';
    if (!isFirstSubmission) {
      const editWindowOpen =
        !!invite.editWindowExpiresAt && invite.editWindowExpiresAt.toDate() > new Date();
      if (!editWindowOpen) return jsonError('edit_window_closed', 410);
    }

    const formData = await request.formData();
    const submission = readSubmission(formData);
    if ('error' in submission) return submission.error;
    const filesResult = readFiles(formData);
    if ('error' in filesResult) return filesResult.error;

    const rfq = await getRfq(invite.companyId, invite.rfqId);
    if (!rfq) return jsonError('rfq_not_found', 404);

    const ipHash = getClientIpHash(request);
    const userAgent = request.headers.get('user-agent') ?? 'unknown';
    const existing = await findExistingPortalQuote(
      invite.companyId,
      invite.rfqId,
      invite.vendorContactId,
    );

    // Resolve quote ID upfront so file upload + Firestore write share scope.
    const quoteId = existing?.id ?? generateQuoteId();
    const newAttachments = await uploadVendorFiles(
      invite.companyId,
      quoteId,
      invite.id,
      invite.vendorContactId,
      filesResult.files,
    );

    // Multi-trade RFQs: tag the quote with the dominant trade (first line),
    // fall back to materials_general for line-less RFQs (package quotes).
    const dominantTrade: Quote['trade'] = rfq.lines[0]?.trade ?? 'materials_general';

    await persistVendorQuote({
      isFirstSubmission,
      quoteId,
      companyId: invite.companyId,
      rfqId: invite.rfqId,
      rfqProjectId: rfq.projectId,
      rfqBuildingId: rfq.buildingId,
      rfqTrade: dominantTrade,
      vendorContactId: invite.vendorContactId,
      inviteId: invite.id,
      ipHash,
      userAgent,
      payload: submission,
      newAttachments,
      existing,
    });

    if (isFirstSubmission) {
      await markInviteSubmitted(invite.id);
    }

    after(async () => {
      try {
        const eventType = isFirstSubmission
          ? NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_RECEIVED
          : NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_EDITED;
        const titleKey = isFirstSubmission
          ? 'quotes:quotes.notifications.quoteSubmittedViaPortal'
          : 'quotes:quotes.notifications.vendorEdited';
        const titleParams: Record<string, string> = isFirstSubmission
          ? { rfqTitle: rfq.title }
          : { vendorName: invite.recipientName ?? invite.vendorContactId, rfqTitle: rfq.title };
        await dispatchProcurementNotification(
          eventType,
          rfq.createdBy,
          invite.companyId,
          isFirstSubmission ? `Νέα προσφορά για ${rfq.title}` : 'Ο προμηθευτής ενημέρωσε την προσφορά',
          `${invite.id}_${isFirstSubmission ? 'submit' : 'edit'}_${Date.now()}`,
          {
            entityId: quoteId,
            entityType: NOTIFICATION_ENTITY_TYPES.QUOTE,
            titleKey,
            titleParams,
          },
        );
      } catch (err) {
        logger.warn('PM notification failed (non-blocking)', {
          inviteId: invite.id,
          err: getErrorMessage(err, 'unknown'),
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        quoteId,
        status: 'submitted',
        editWindowExpiresAt: isFirstSubmission
          ? new Date(Date.now() + EDIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
          : invite.editWindowExpiresAt?.toDate().toISOString() ?? null,
      },
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Vendor portal POST failed');
    logger.error('Vendor portal POST error', { error: message });
    return jsonError('server_error', 500);
  }
};

export const GET = withHeavyRateLimit(baseGET);
export const POST = withHeavyRateLimit(basePOST);
