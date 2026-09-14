/**
 * 🏢 ENTERPRISE MAILGUN INBOUND WEBHOOK
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * Pattern: "Acknowledge Fast, Process Later"
 * - Validate signature
 * - Extract email data
 * - Enqueue for background processing
 * - Return 200 OK immediately (<1.5s target)
 *
 * The actual email processing (AI analysis, file uploads, etc.)
 * happens in the background via the email-ingestion-worker.
 *
 * Βοηθητικά (CHECK 4 split): `inbound-form.ts` (ανάγνωση φόρμας) ·
 * `inbound-immediate-processing.ts` (after()) · `inbound-diagnostic.ts` (GET).
 *
 * @module api/communications/webhooks/mailgun/inbound
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Serverless Function max duration.
 * The AI pipeline runs OpenAI calls inside after(), which can exceed the default 10s.
 * @enterprise Required for full pipeline execution via after() callback
 */
export const maxDuration = 60;
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { hasMailgunSigningKey, verifyMailgunSignature } from '@/lib/communications/mailgun-webhook/mailgun-signature';
import {
  parseAddress,
  splitAddresses,
  resolveSubject,
  resolveProviderMessageId,
  enqueueInboundEmail,
} from '@/services/communications/inbound';

import { buildInboundDiagnostic } from './inbound-diagnostic';
import { buildFallbackKey, extractAttachments, extractMailgunStorageInfo, getFormString } from './inbound-form';
import { logEnqueueResult, scheduleImmediateProcessing } from './inbound-immediate-processing';

const logger = createModuleLogger('MAILGUN_INBOUND_WEBHOOK');

// 🔑 ADR-841 Α21.20 (N.0.2): η επαλήθευση υπογραφής ζούσε ΕΔΩ, ιδιωτική και αδοκίμαστη. Εξήχθη στο
//    `lib/communications/mailgun-webhook/mailgun-signature.ts` όταν τη χρειάστηκε και το route
//    συμβάντων παράδοσης — ίδιο κλειδί, ίδιος αλγόριθμος, ίδιο παράθυρο 5′ (ADR-252 SV-M1).

/**
 * Handle Mailgun Inbound Webhook
 *
 * ENTERPRISE PATTERN: "Acknowledge Fast, Process Later"
 *
 * This handler:
 * 1. Validates the webhook signature (security)
 * 2. Extracts email data from form data
 * 3. Enqueues the email for background processing
 * 4. Returns 200 OK immediately
 *
 * Target response time: <1.5 seconds (Mailgun timeout is ~10s)
 */
async function handleMailgunInbound(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    const contentType = request.headers.get('content-type') || '';
    // Mailgun can send multipart/form-data or application/x-www-form-urlencoded
    const isValidContentType =
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded');

    if (!isValidContentType) {
      logger.warn('Invalid content type', { contentType });
      return NextResponse.json({ ok: false, error: 'invalid_content_type', received: contentType }, { status: 400 });
    }

    logger.info('Received webhook request', { contentType });

    const formData = await request.formData();
    const signatureCheck = verifyMailgunSignature({
      timestamp: getFormString(formData, ['timestamp']),
      token: getFormString(formData, ['token']),
      signature: getFormString(formData, ['signature']),
    });

    if (!signatureCheck.valid) {
      logger.warn('Webhook signature rejected', { reason: signatureCheck.reason });
      return NextResponse.json({ ok: false, error: signatureCheck.reason }, { status: 401 });
    }

    const fromRaw = getFormString(formData, ['from', 'sender']);
    const sender = parseAddress(fromRaw);
    if (!sender) {
      logger.info('No valid sender found, skipping');
      return NextResponse.json({ ok: true, processed: 0, skipped: 1 });
    }

    const toRaw = getFormString(formData, ['recipient', 'to']);
    const ccRaw = getFormString(formData, ['cc']);
    const recipients = [
      ...splitAddresses(toRaw),
      ...splitAddresses(ccRaw),
    ];

    if (recipients.length === 0) {
      logger.info('No recipients found, skipping');
      return NextResponse.json({ ok: true, processed: 0, skipped: 1 });
    }

    const subject = resolveSubject(getFormString(formData, ['subject']));
    const textBody = getFormString(formData, ['stripped-text', 'body-plain', 'text']) || '';
    // 🏢 ENTERPRISE: Use 'body-html' FIRST (full HTML with formatting)
    // 'stripped-html' removes quotes/signatures and may lose inline styles/colors
    // Priority: body-html > html > stripped-html (fallback only)
    const htmlBody = getFormString(formData, ['body-html', 'html', 'stripped-html']) || '';
    // 🏢 ENTERPRISE: Dual-content pattern (Gmail/Outlook/Salesforce)
    // - contentText: Plain text for search/preview/fallback
    // - contentHtml: Rich HTML with formatting (colors, fonts, styles)
    const contentText = textBody || ''; // Plain text only, no HTML fallback
    const contentHtml = htmlBody || undefined; // HTML with formatting (colors preserved)
    const receivedAt = getFormString(formData, ['Date', 'date']);

    const messageId = getFormString(formData, ['Message-Id', 'message-id', 'messageId']);
    const fallbackKey = buildFallbackKey({
      senderEmail: sender.email,
      recipients,
      subject,
      timestamp: receivedAt,
      content: contentText,
    });
    const providerMessageId = resolveProviderMessageId('mailgun', fallbackKey, messageId);

    const attachments = extractAttachments(formData);

    // 🏢 ENTERPRISE: Extract Mailgun storage info for deferred attachment download
    // This enables the "Store Reference, Fetch Later" pattern
    const mailgunStorage = extractMailgunStorageInfo(formData);

    logger.info('Enqueuing inbound email for processing', {
      from: sender.email,
      to: recipients.join(', '),
      subject,
      attachmentCount: attachments.length,
      providerMessageId,
      hasMailgunStorage: Boolean(mailgunStorage),
      hasHtmlContent: Boolean(contentHtml),  // 🏢 NEW: Track HTML content presence
    });

    // 🏢 ENTERPRISE: Enqueue for background processing instead of sync processing
    // This is the "Acknowledge Fast, Process Later" pattern
    // Attachments are processed based on size:
    // - Small (< 1MB): Inline base64 for fast processing
    // - Large (>= 1MB): Deferred download from Mailgun Storage API
    // 🏢 ENTERPRISE: Enqueue with dual-content (text + HTML)
    const enqueueResult = await enqueueInboundEmail({
      provider: 'mailgun',
      providerMessageId,
      sender,
      recipients,
      subject,
      contentText,
      contentHtml,  // 🏢 NEW: HTML with formatting (colors, fonts, styles)
      emailReceivedAt: receivedAt,
      attachments,
      mailgunStorage,
      rawMetadata: {
        messageId,
        hasHtml: Boolean(htmlBody),
      },
    });

    const elapsed = Date.now() - startTime;
    logEnqueueResult(enqueueResult, { elapsedMs: elapsed, senderEmail: sender.email, recipients });

    if (enqueueResult.status === 'queued') {
      scheduleImmediateProcessing(enqueueResult.queueId);
    }

    // 🏢 ENTERPRISE: Always return 200 OK to Mailgun
    // Even if enqueue fails, we don't want Mailgun to retry immediately
    // because that could cause a flood of requests
    // Failed items will be handled by our own retry logic or alerting
    return NextResponse.json({
      ok: true,
      status: enqueueResult.status,
      queueId: enqueueResult.queueId,
      elapsedMs: elapsed,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Mailgun inbound webhook error', {
      error: errorMessage,
      stack: errorStack,
      elapsedMs: elapsed,
    });

    // 🏢 ENTERPRISE: Return 200 even on error to prevent Mailgun retry flood
    // We'll handle recovery through our queue monitoring and alerting
    return NextResponse.json({
      ok: false,
      error: 'internal_error',
      message: errorMessage,
      elapsedMs: elapsed,
    });
    // Note: Changed from status: 500 to 200 to prevent Mailgun retry storm
    // Errors are logged and will be monitored via our logging/alerting system
  }
}

export const POST = withWebhookRateLimit(handleMailgunInbound);

export async function GET(): Promise<Response> {
  const diagnostic = await buildInboundDiagnostic();

  return NextResponse.json({
    status: 'ok',
    service: 'mailgun-inbound',
    version: 'v2-queue',
    hasSigningKey: hasMailgunSigningKey(),
    hasMailgunDomain: Boolean(process.env.MAILGUN_DOMAIN),
    mailgunDomainValue: process.env.MAILGUN_DOMAIN?.trim() || 'NOT_SET',
    diagnostic,
  });
}
