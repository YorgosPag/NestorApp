/**
 * GET  /api/vendor/quote — invite + RFQ (+ existing quote) for the vendor portal
 * POST /api/vendor/quote — vendor submits / edits a quote (multipart)
 *
 * Public (no Firebase auth). The vendor IS the link: `Authorization: Bearer <link>`
 * (ADR-876 §5). The link used to live in the PATH (`/api/vendor/quote/<token>`), so every
 * request wrote the credential to the access logs.
 *
 * Security model (ADR-327 §11 · ADR-876 §5):
 * - `withVendorLinkDoor`: signature BEFORE any Firestore read · hashed credential lookup by ID ·
 *   constant-time nonce compare · the ONE resolver (revocation checked on every verb)
 * - withHeavyRateLimit (10 req/min) keyed on hashed IP
 * - Storage uploads via Admin SDK only · submitterIp hashed before persisting
 *
 * @module api/vendor/quote/route
 * @enterprise ADR-327 §7 + §11 · ADR-876 §5
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { clientIpFingerprint, clientIpOf } from '@/lib/http/client-ip';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateQuoteId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { touchVendorCredential } from '@/services/vendor-portal/vendor-invite-credential-store';
import {
  markInviteOpened,
  markInviteSubmitted,
} from '@/subapps/procurement/services/vendor-invite-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { vendorInvitePermits } from '@/subapps/procurement/services/vendor-invite-resolver';
import { vendorQuoteEditWindowEnd } from '@/subapps/procurement/utils/vendor-invite-status';
import {
  findExistingPortalQuote,
  persistVendorQuote,
} from '@/subapps/procurement/services/vendor-portal-submit-service';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import {
  vendorPortalError,
  withVendorLinkDoor,
  type OpenVendorInvite,
} from '@/server/vendor-portal/vendor-link-door';
import { readFiles, readSubmission, type ParsedSubmission, type PreparedFiles } from './parsing';
import { uploadVendorFiles } from './upload';

const logger = createModuleLogger('VENDOR_PORTAL_API');

export const maxDuration = 60;


/** Παρενέργειες ανάγνωσης — **μετά** την απάντηση, ποτέ φραγμός (άνοιγμα + τελευταία χρήση συνδέσμου). */
function recordPortalVisit(opened: OpenVendorInvite): void {
  after(async () => {
    try {
      await Promise.all([
        markInviteOpened(opened.invite.id),
        touchVendorCredential(opened.credential.id, nowISO()),
      ]);
    } catch (err) {
      logger.warn('Portal visit side effects failed', {
        inviteId: opened.invite.id,
        err: getErrorMessage(err, 'unknown'),
      });
    }
  });
}

type ExistingQuote = Awaited<ReturnType<typeof findExistingPortalQuote>>;

function inviteView(opened: OpenVendorInvite) {
  const { invite } = opened;
  return {
    id: invite.id,
    status: invite.status,
    rfqId: invite.rfqId,
    vendorContactId: invite.vendorContactId,
    // Η λήξη ΑΥΤΟΥ του συνδέσμου — όχι της πρόσκλησης (άλλος σύνδεσμος μπορεί να ζει περισσότερο).
    expiresAt: opened.credential.expiresAt,
    editWindowExpiresAt: invite.editWindowExpiresAt?.toDate().toISOString() ?? null,
    // Τα ρήματα από τον ΕΝΑ πίνακα πολιτικής — ο client δεν τα ξαναϋπολογίζει (ADR-876 §5 Σ16).
    permits: vendorInvitePermits(invite, Date.now()),
  };
}

/** Μόνο ό,τι χρειάζεται η φόρμα — καμία εσωτερική σημείωση RFQ (τιμές, BOQ, προέλευση). */
function rfqView(rfq: RFQ) {
  return {
    id: rfq.id,
    title: rfq.title,
    description: rfq.description,
    lines: rfq.lines.map(({ id, description, trade, quantity, unit, notes }) => ({ id, description, trade, quantity, unit, notes })),
    deadlineDate: rfq.deadlineDate?.toDate().toISOString() ?? null,
  };
}

function quoteView(existing: ExistingQuote) {
  if (!existing) return null;
  const { data } = existing;
  return {
    id: data.id,
    lines: data.lines,
    totals: data.totals,
    paymentTerms: data.paymentTerms,
    deliveryTerms: data.deliveryTerms,
    warranty: data.warranty,
    notes: data.notes,
    validUntil: data.validUntil?.toDate().toISOString() ?? null,
    attachments: data.attachments,
    status: data.status,
  };
}

// =============================================================================
// GET
// =============================================================================

const baseGET = withVendorLinkDoor({ purpose: 'read' }, async (_request, opened) => {
  const { invite } = opened;
  const rfq = await getRfq(invite.companyId, invite.rfqId);
  if (!rfq) return vendorPortalError('rfq_not_found', 404);
  recordPortalVisit(opened);
  const existing =
    invite.status === 'submitted'
      ? await findExistingPortalQuote(invite)
      : null;
  return NextResponse.json({
    success: true,
    data: { invite: inviteView(opened), rfq: rfqView(rfq), quote: quoteView(existing) },
  });
});

// =============================================================================
// POST
// =============================================================================

function notifyPm(opened: OpenVendorInvite, rfq: RFQ, quoteId: string, isFirstSubmission: boolean): void {
  const { invite } = opened;
  after(async () => {
    try {
      const titleParams: Record<string, string> = isFirstSubmission
        ? { rfqTitle: rfq.title }
        : { vendorName: invite.recipientName ?? invite.vendorContactId, rfqTitle: rfq.title };
      await dispatchProcurementNotification(
        isFirstSubmission
          ? NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_RECEIVED
          : NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_EDITED,
        rfq.createdBy,
        invite.companyId,
        isFirstSubmission ? `Νέα προσφορά για ${rfq.title}` : 'Ο προμηθευτής ενημέρωσε την προσφορά',
        `${invite.id}_${isFirstSubmission ? 'submit' : 'edit'}_${Date.now()}`,
        {
          entityId: quoteId,
          entityType: NOTIFICATION_ENTITY_TYPES.QUOTE,
          titleKey: isFirstSubmission
            ? 'common-shared:quoteNotifications.quoteSubmittedViaPortal'
            : 'common-shared:quoteNotifications.vendorEdited',
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
}

/** Αρχεία + προσφορά. Ίδιο `quoteId` σε κάθε επανάληψη: η δεύτερη αποστολή γίνεται επεξεργασία, όχι δεύτερη προσφορά. */
async function saveSubmission(
  request: NextRequest,
  opened: OpenVendorInvite,
  rfq: RFQ,
  submission: ParsedSubmission,
  files: PreparedFiles['files'],
  editWindowEnd: Date,
): Promise<string> {
  const { invite } = opened;
  const existing = await findExistingPortalQuote(invite);
  const quoteId = existing?.id ?? generateQuoteId();
  const newAttachments = await uploadVendorFiles(invite.companyId, quoteId, invite.id, invite.vendorContactId, files);
  // Multi-trade RFQs: tag with the dominant trade (first line); line-less RFQs → materials_general.
  const dominantTrade: Quote['trade'] = rfq.lines[0]?.trade ?? 'materials_general';
  await persistVendorQuote({
    isFirstSubmission: invite.status !== 'submitted',
    quoteId,
    companyId: invite.companyId,
    rfqId: invite.rfqId,
    rfqProjectId: rfq.projectId,
    rfqBuildingId: rfq.buildingId,
    rfqTrade: dominantTrade,
    vendorContactId: invite.vendorContactId,
    inviteId: invite.id,
    ipHash: clientIpFingerprint(clientIpOf(request.headers)),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    payload: submission,
    newAttachments,
    existing,
    editWindowEnd,
  });
  return quoteId;
}

const basePOST = withVendorLinkDoor({ purpose: 'submit' }, async (request, opened) => {
  const { invite } = opened;
  const isFirstSubmission = invite.status !== 'submitted';

  const formData = await request.formData();
  const submission = readSubmission(formData);
  if ('error' in submission) return submission.error;
  const filesResult = readFiles(formData);
  if ('error' in filesResult) return filesResult.error;

  const rfq = await getRfq(invite.companyId, invite.rfqId);
  if (!rfq) return vendorPortalError('rfq_not_found', 404);

  // ΜΙΑ στιγμή λήξης για προσφορά + πρόσκληση + απάντηση (ADR-876 §5 Σ17). Σε επεξεργασία μένει η αρχική.
  // (Επεξεργασία ⇒ ο αναλυτής εγγυάται ανοιχτό παράθυρο, άρα `editWindowExpiresAt` υπάρχει.)
  const editWindowEnd =
    (!isFirstSubmission && invite.editWindowExpiresAt?.toDate()) || vendorQuoteEditWindowEnd(Date.now());
  const quoteId = await saveSubmission(request, opened, rfq, submission, filesResult.files, editWindowEnd);
  if (isFirstSubmission) await markInviteSubmitted(invite.id, editWindowEnd, quoteId);
  notifyPm(opened, rfq, quoteId, isFirstSubmission);

  return NextResponse.json({
    success: true,
    data: { quoteId, status: 'submitted', editWindowExpiresAt: editWindowEnd.toISOString() },
  });
});

export const GET = withHeavyRateLimit(baseGET);
export const POST = withHeavyRateLimit(basePOST);
