import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getCurrentSecurityPolicy } from '@/config/environment-security-config';
import {
  parseAddress,
  splitAddresses,
  resolveSubject,
  resolveProviderMessageId,
  processInboundEmail,
  type InboundEmailAttachment,
} from '@/services/communications/inbound';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('BREVO_INBOUND_WEBHOOK');

// =============================================================================
// TYPES
// =============================================================================

interface BrevoAttachment {
  Name?: string;
  ContentType?: string;
  Size?: number;
  DownloadToken?: string;
}

interface BrevoInboundItem {
  MessageId?: string;
  MessageUuid?: string;
  From?: string;
  To?: string;
  Cc?: string;
  Subject?: string;
  Text?: string;
  Html?: string;
  RawTextBody?: string;
  ExtractedMarkdownMessage?: string;
  Date?: string;
  Attachments?: BrevoAttachment[];
  AttachmentsNumber?: number;
}

interface BrevoInboundPayload {
  items?: BrevoInboundItem[];
}


// =============================================================================
// CONFIG
// =============================================================================

const BREVO_API_BASE_URL = process.env.BREVO_API_BASE_URL;
const BREVO_INBOUND_WEBHOOK_SECRET = process.env.BREVO_INBOUND_WEBHOOK_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// =============================================================================
// HELPERS: VALIDATION & PARSING
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBrevoPayload(payload: unknown): BrevoInboundPayload {
  if (!isRecord(payload)) {
    return {};
  }

  const items = payload.items;
  if (Array.isArray(items)) {
    return { items: items as BrevoInboundItem[] };
  }

  return {};
}

function extractMessageText(item: BrevoInboundItem): string {
  return (
    item.ExtractedMarkdownMessage ||
    item.RawTextBody ||
    item.Text ||
    item.Html ||
    ''
  );
}

function buildFallbackKey(item: BrevoInboundItem, senderEmail: string, recipients: string[]): string {
  const subject = item.Subject || '';
  const timestamp = item.Date || '';
  const recipientKey = recipients.join(',');
  const content = extractMessageText(item).slice(0, 256);
  return [senderEmail, recipientKey, subject, timestamp, content].join('|');
}

// =============================================================================
// HELPERS: SECURITY
// =============================================================================

function getProvidedWebhookToken(request: NextRequest): string | null {
  const headerToken = request.headers.get('x-webhook-token');
  if (headerToken) return headerToken;

  const url = new URL(request.url);
  return url.searchParams.get('token');
}

function validateWebhookSecret(request: NextRequest): { valid: boolean; reason?: string } {
  const policy = getCurrentSecurityPolicy();
  const provided = getProvidedWebhookToken(request);

  if (policy.requireWebhookSecrets && !BREVO_INBOUND_WEBHOOK_SECRET) {
    return { valid: false, reason: 'webhook_secret_missing' };
  }

  if (BREVO_INBOUND_WEBHOOK_SECRET) {
    if (!provided) {
      return { valid: false, reason: 'webhook_token_missing' };
    }
    if (provided !== BREVO_INBOUND_WEBHOOK_SECRET) {
      return { valid: false, reason: 'webhook_token_invalid' };
    }
  }

  return { valid: true };
}

// =============================================================================
// HELPERS: ATTACHMENTS
// =============================================================================

async function downloadBrevoAttachment(downloadToken: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!BREVO_API_BASE_URL || !BREVO_API_KEY) {
    logger.error('Brevo API configuration missing', {
      hasBaseUrl: Boolean(BREVO_API_BASE_URL),
      hasApiKey: Boolean(BREVO_API_KEY),
    });
    return null;
  }

  const url = `${BREVO_API_BASE_URL.replace(/\/$/, '')}/v3/inbound/attachments/${downloadToken}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': BREVO_API_KEY,
    },
  });

  if (!response.ok) {
    logger.error('Brevo attachment download failed', {
      status: response.status,
      statusText: response.statusText,
    });
    return null;
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}


// =============================================================================
// MAIN HANDLER
// =============================================================================

async function handleBrevoInbound(request: NextRequest): Promise<Response> {
  const secretValidation = validateWebhookSecret(request);
  if (!secretValidation.valid) {
    logger.warn('Webhook rejected', { reason: secretValidation.reason });
    return NextResponse.json({ ok: false, error: secretValidation.reason }, { status: 401 });
  }

  const payload = parseBrevoPayload(await request.json());
  if (!payload.items || payload.items.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let skipped = 0;

  for (const item of payload.items) {
    const sender = parseAddress(item.From);
    if (!sender) {
      skipped++;
      continue;
    }

    const recipients = [
      ...splitAddresses(item.To),
      ...splitAddresses(item.Cc),
    ];

    if (recipients.length === 0) {
      skipped++;
      continue;
    }

    const fallbackKey = buildFallbackKey(item, sender.email, recipients);
    const providerMessageId = resolveProviderMessageId(
      'brevo',
      fallbackKey,
      item.MessageId,
      item.MessageUuid
    );

    const contentText = extractMessageText(item).trim();
    const subject = resolveSubject(item.Subject);
    const receivedAt = item.Date;

    const attachments = (item.Attachments || [])
      .map((attachment): InboundEmailAttachment | null => {
        if (!attachment.DownloadToken) return null;
        return {
          filename: attachment.Name || `attachment_${attachment.DownloadToken}`,
          contentType: attachment.ContentType || 'application/octet-stream',
          sizeBytes: attachment.Size,
          download: () => downloadBrevoAttachment(attachment.DownloadToken || ''),
        };
      })
      .filter((attachment): attachment is InboundEmailAttachment => Boolean(attachment));

    const result = await processInboundEmail({
      provider: 'brevo',
      providerMessageId,
      sender,
      recipients,
      subject,
      contentText,
      receivedAt,
      attachments,
      raw: {
        messageId: item.MessageId || item.MessageUuid,
        receivedAt: item.Date,
        hasHtml: Boolean(item.Html),
      },
    });

    if (result.processed) {
      processed++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, processed, skipped });
}

export const POST = withWebhookRateLimit(handleBrevoInbound);

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: 'ok',
    service: 'brevo-inbound',
    hasWebhookSecret: Boolean(BREVO_INBOUND_WEBHOOK_SECRET),
    hasApiKey: Boolean(BREVO_API_KEY),
    hasApiBaseUrl: Boolean(BREVO_API_BASE_URL),
  });
}
