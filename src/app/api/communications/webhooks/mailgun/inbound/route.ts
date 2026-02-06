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
import { after } from 'next/server';
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
  type MailgunStorageInfo,
} from '@/services/communications/inbound';
import {
  processEmailIngestionBatch,
} from '@/server/comms/workers/email-ingestion-worker';

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

/**
 * 🏢 ENTERPRISE: Extract Mailgun storage info for deferred download
 *
 * Mailgun provides a message-url that allows retrieving the full message
 * with attachments later (up to 3 days). This enables the "Store Reference,
 * Fetch Later" pattern used by SAP, Salesforce, and enterprise systems.
 *
 * @see https://documentation.mailgun.com/en/latest/api-sending-messages.html#retrieving-stored-messages
 */
function extractMailgunStorageInfo(formData: FormData): MailgunStorageInfo | undefined {
  const messageUrl = getFormString(formData, ['message-url', 'Message-Url', 'message-headers']);

  if (!messageUrl) {
    return undefined;
  }

  // Extract storage key from URL (last path segment)
  const urlMatch = messageUrl.match(/messages\/([A-Za-z0-9_-]+)$/);
  const storageKey = urlMatch ? urlMatch[1] : undefined;

  return {
    messageUrl,
    storageKey,
    region: messageUrl.includes('europe') ? 'eu' : 'us',
  };
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

    // 🏢 ENTERPRISE: "Respond Fast, Process After" pattern (Next.js 15 after())
    // Vercel Hobby plan limits cron to daily, so we trigger immediate processing
    // after responding to Mailgun. The daily cron serves as backup for retries.
    // Pattern used by: Salesforce Platform Events, SAP Event Mesh, Google Cloud Tasks
    if (enqueueResult.status === 'queued') {
      after(async () => {
        try {
          logger.info('after(): Starting immediate email processing', {
            queueId: enqueueResult.queueId,
          });
          const result = await processEmailIngestionBatch();
          logger.info('after(): Immediate processing completed', {
            processed: result.processed,
            failed: result.failed,
          });
        } catch (afterError) {
          // Non-fatal: daily cron will retry failed items
          logger.warn('after(): Immediate processing failed (cron will retry)', {
            error: afterError instanceof Error ? afterError.message : 'Unknown',
          });
        }
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
  // Full diagnostic: routing rules + queue status
  const diagnostic: Record<string, unknown> = {
    routing: { rulesCount: 0, hasIntegrations: false, hasSettings: false, rules: [] as string[] },
    queue: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, latestItem: null as string | null },
  };

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const { COLLECTIONS } = await import('@/config/firestore-collections');
    const adminDb = getAdminFirestore();

    // Check routing rules
    const settingsDoc = await adminDb.collection(COLLECTIONS.SYSTEM).doc('settings').get();
    const routingInfo = diagnostic.routing as Record<string, unknown>;
    routingInfo.hasSettings = settingsDoc.exists;

    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      routingInfo.hasIntegrations = Boolean(data?.integrations);
      const rules = data?.integrations?.emailInboundRouting;
      if (Array.isArray(rules)) {
        routingInfo.rulesCount = rules.length;
        routingInfo.rules = rules.map((r: Record<string, unknown>) =>
          `${r.pattern} → ${typeof r.companyId === 'string' ? r.companyId.substring(0, 8) + '...' : 'none'} (active: ${r.isActive})`
        );
      }
    }

    // Check queue status
    const queueRef = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);
    const queueInfo = diagnostic.queue as Record<string, unknown>;

    const allItems = await queueRef.orderBy('createdAt', 'desc').limit(10).get();
    queueInfo.total = allItems.size;

    let pending = 0, processing = 0, completed = 0, failed = 0;
    const items: string[] = [];
    allItems.forEach(doc => {
      const d = doc.data();
      const status = d.status as string;
      if (status === 'pending') pending++;
      else if (status === 'processing') processing++;
      else if (status === 'completed') completed++;
      else if (status === 'failed' || status === 'dead_letter') failed++;
      items.push(`${doc.id}: ${status} | ${d.subject || 'no-subject'} | ${d.sender?.email || 'unknown'} | ${d.createdAt?.toDate?.()?.toISOString?.() || 'no-date'}`);
    });
    queueInfo.pending = pending;
    queueInfo.processing = processing;
    queueInfo.completed = completed;
    queueInfo.failed = failed;
    queueInfo.items = items;

  } catch (diagError) {
    diagnostic.error = diagError instanceof Error ? diagError.message : 'Unknown';
  }

  return NextResponse.json({
    status: 'ok',
    service: 'mailgun-inbound',
    version: 'v2-queue',
    hasSigningKey: Boolean(MAILGUN_WEBHOOK_SIGNING_KEY),
    hasMailgunDomain: Boolean(process.env.MAILGUN_DOMAIN),
    mailgunDomainValue: process.env.MAILGUN_DOMAIN?.trim() || 'NOT_SET',
    diagnostic,
  });
}
