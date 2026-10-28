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
import { readRfqLinesPublic } from '@/subapps/procurement/services/rfq-line-service';
import { vendorInvitePermits } from '@/subapps/procurement/services/vendor-invite-resolver';
import { vendorQuoteEditWindowEnd } from '@/subapps/procurement/utils/vendor-invite-status';
import {
  findExistingPortalQuote,
  persistVendorQuote,
} from '@/subapps/procurement/services/vendor-portal-submit-service';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';
import type { Quote } from '@/subapps/procurement/types/quote';
import { rfqLeadTrade, type RFQ, type RfqResponseLock } from '@/subapps/procurement/types/rfq';
import type { PublicRfqLine } from '@/subapps/procurement/types/rfq-line';
import {
  vendorPortalError,
  withVendorLinkDoor,
  type OpenVendorInvite,
} from '@/server/vendor-portal/vendor-link-door';
import { applyRfqLineAuthority, checkRfqLineAnswers } from '@/subapps/procurement/utils/rfq-line-binding';
import { resolveResponseLock } from '@/subapps/procurement/utils/rfq-response-lock';
import { vendorSnapshotFromInvite } from '@/subapps/procurement/utils/quote-vendor-identity';
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

/**
 * Μόνο ό,τι χρειάζεται η φόρμα — καμία εσωτερική σημείωση RFQ (τιμές, BOQ, προέλευση).
 * Οι γραμμές έρχονται ΗΔΗ καθαρισμένες από τον ΕΝΑ αναγνώστη (`readRfqLinesPublic`, ADR-327 Q29):
 * μέχρι 2026-10-27 εδώ διαβαζόταν το legacy `rfq.lines`, που στα νέα RFQ είναι `[]` ⇒ άδεια φόρμα.
 */
function rfqView(rfq: RFQ, lines: PublicRfqLine[]) {
  return {
    id: rfq.id,
    title: rfq.title,
    description: rfq.description,
    lines,
    deadlineDate: rfq.deadlineDate?.toDate().toISOString() ?? null,
    /** §8.5 Β — η πύλη δείχνει τα κλειδωμένα πεδία μόνο-ανάγνωσης· η επιβολή γίνεται στο `bindSubmission`. */
    responseLock: resolveResponseLock(rfq),
  };
}

function quoteView(existing: ExistingQuote) {
  if (!existing) return null;
  const { data } = existing;
  return {
    id: data.id,
    lines: data.lines,
    alternates: data.alternates ?? [],
    scopeResponses: data.scopeResponses ?? [],
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
  const [lines, existing] = await Promise.all([
    readRfqLinesPublic(rfq),
    invite.status === 'submitted' ? findExistingPortalQuote(invite) : null,
  ]);
  return NextResponse.json({
    success: true,
    data: { invite: inviteView(opened), rfq: rfqView(rfq, lines), quote: quoteView(existing) },
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
        : { vendorName: vendorSnapshotFromInvite(invite).name, rfqTitle: rfq.title };
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

/**
 * ADR-327 §8.5 — οι απαντήσεις **απέναντι στις γραμμές του RFQ της πρόσκλησης** (ποτέ εμπιστοσύνη στον client):
 * ξένο/διπλό id ή αναπάντητη γραμμή ⇒ 400 `binding:<code>`. Μετά: η γραμμή RFQ είναι η αυθεντία του ΤΙ ζητήθηκε.
 */
function bindSubmission(
  submission: ParsedSubmission,
  lines: readonly PublicRfqLine[],
  lock: RfqResponseLock,
): { submission: ParsedSubmission } | { error: NextResponse } {
  const error = checkRfqLineAnswers(lines, submission, { requireEveryLine: lines.length > 0 });
  if (error) return { error: vendorPortalError(`binding:${error.code}`, 400) };
  return { submission: { ...submission, ...applyRfqLineAuthority(lines, submission, lock) } };
}

/** Αρχεία + προσφορά. Ίδιο `quoteId` σε κάθε επανάληψη: η δεύτερη αποστολή γίνεται επεξεργασία, όχι δεύτερη προσφορά. */
async function saveSubmission(
  request: NextRequest,
  opened: OpenVendorInvite,
  rfq: RFQ,
  lines: readonly PublicRfqLine[],
  submission: ParsedSubmission,
  files: PreparedFiles['files'],
  editWindowEnd: Date,
): Promise<string> {
  const { invite } = opened;
  const existing = await findExistingPortalQuote(invite);
  const quoteId = existing?.id ?? generateQuoteId();
  const newAttachments = await uploadVendorFiles(invite.companyId, quoteId, invite.id, invite.vendorContactId, files);
  // Multi-trade RFQs: tag with the lead trade (first line); line-less RFQs → materials_general.
  const dominantTrade: Quote['trade'] = rfqLeadTrade({ lines }) ?? 'materials_general';
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
    vendorSnapshot: vendorSnapshotFromInvite(invite),
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
  const rfqLines = await readRfqLinesPublic(rfq);
  const bound = bindSubmission(submission, rfqLines, resolveResponseLock(rfq));
  if ('error' in bound) return bound.error;

  // ΜΙΑ στιγμή λήξης για προσφορά + πρόσκληση + απάντηση (ADR-876 §5 Σ17). Σε επεξεργασία μένει η αρχική.
  // (Επεξεργασία ⇒ ο αναλυτής εγγυάται ανοιχτό παράθυρο, άρα `editWindowExpiresAt` υπάρχει.)
  const editWindowEnd =
    (!isFirstSubmission && invite.editWindowExpiresAt?.toDate()) || vendorQuoteEditWindowEnd(Date.now());
  const quoteId = await saveSubmission(request, opened, rfq, rfqLines, bound.submission, filesResult.files, editWindowEnd);
  if (isFirstSubmission) await markInviteSubmitted(invite.id, editWindowEnd, quoteId);
  notifyPm(opened, rfq, quoteId, isFirstSubmission);

  return NextResponse.json({
    success: true,
    data: { quoteId, status: 'submitted', editWindowExpiresAt: editWindowEnd.toISOString() },
  });
});

export const GET = withHeavyRateLimit(baseGET);
export const POST = withHeavyRateLimit(basePOST);
