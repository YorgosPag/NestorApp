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
 * @module api/communications/webhooks/mailgun/inbound
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getCurrentSecurityPolicy } from '@/config/environment-security-config';
import {
  parseAddress,
  splitAddresses,
  resolveSubject,
  resolveProviderMessageId,
  enqueueInboundEmail,
  type InboundEmailAttachment,
} from '@/services/communications/inbound';

const logger = createModuleLogger('MAILGUN_INBOUND_WEBHOOK');

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

function getFormString(formData: FormData, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function verifyMailgunSignature(params: {
  timestamp?: string;
  token?: string;
  signature?: string;
  signingKey?: string;
}): { valid: boolean; reason?: string } {
  const { timestamp, token, signature, signingKey } = params;
  const policy = getCurrentSecurityPolicy();

  if (policy.requireWebhookSecrets && !signingKey) {
    return { valid: false, reason: 'webhook_secret_missing' };
  }

  if (!signingKey) {
    return { valid: true };
  }

  if (!timestamp || !token || !signature) {
    return { valid: false, reason: 'signature_fields_missing' };
  }

  const digest = createHmac('sha256', signingKey)
    .update(timestamp + token)
    .digest('hex');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(digest);

  if (provided.length !== expected.length) {
    return { valid: false, reason: 'signature_invalid' };
  }

  const valid = timingSafeEqual(provided, expected);
  return valid ? { valid: true } : { valid: false, reason: 'signature_invalid' };
}

function extractAttachments(formData: FormData): InboundEmailAttachment[] {
  const attachments: InboundEmailAttachment[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('attachment-')) continue;
    if (!(value instanceof File)) continue;

    const filename = value.name || key;
    const contentType = value.type || 'application/octet-stream';
    const sizeBytes = value.size;

    attachments.push({
      filename,
      contentType,
      sizeBytes,
      download: async () => {
        const buffer = Buffer.from(await value.arrayBuffer());
        return { buffer, contentType };
      },
    });
  }

  return attachments;
}

function buildFallbackKey(params: {
  senderEmail: string;
  recipients: string[];
  subject: string;
  timestamp?: string;
  content: string;
}): string {
  const recipientKey = params.recipients.join(',');
  const timestamp = params.timestamp || '';
  const content = params.content.slice(0, 256);
  return [params.senderEmail, recipientKey, params.subject, timestamp, content].join('|');
}

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
      signingKey: MAILGUN_WEBHOOK_SIGNING_KEY,
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
    const textBody = getFormString(formData, ['stripped-text', 'text']) || '';
    const htmlBody = getFormString(formData, ['stripped-html', 'html']) || '';
    const contentText = textBody || htmlBody;
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

    logger.info('Enqueuing inbound email for processing', {
      from: sender.email,
      to: recipients.join(', '),
      subject,
      attachmentCount: attachments.length,
      providerMessageId,
    });

    // 🏢 ENTERPRISE: Enqueue for background processing instead of sync processing
    // This is the "Acknowledge Fast, Process Later" pattern
    const enqueueResult = await enqueueInboundEmail({
      provider: 'mailgun',
      providerMessageId,
      sender,
      recipients,
      subject,
      contentText,
      emailReceivedAt: receivedAt,
      attachments,
      rawMetadata: {
        messageId,
        hasHtml: Boolean(htmlBody),
      },
    });

    const elapsed = Date.now() - startTime;

    // Log the result
    if (enqueueResult.status === 'queued') {
      logger.info('Email enqueued successfully', {
        queueId: enqueueResult.queueId,
        elapsedMs: elapsed,
        from: sender.email,
      });
    } else if (enqueueResult.status === 'duplicate') {
      logger.info('Duplicate email detected, already in queue', {
        queueId: enqueueResult.queueId,
        elapsedMs: elapsed,
      });
    } else if (enqueueResult.status === 'routing_failed') {
      logger.warn('Email routing failed - no matching routing rule', {
        recipients,
        elapsedMs: elapsed,
      });
    } else {
      logger.error('Failed to enqueue email', {
        status: enqueueResult.status,
        elapsedMs: elapsed,
      });
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
  return NextResponse.json({
    status: 'ok',
    service: 'mailgun-inbound',
    version: 'v2-queue', // ADR-071: Queue-based processing
    hasSigningKey: Boolean(MAILGUN_WEBHOOK_SIGNING_KEY),
  });
}
