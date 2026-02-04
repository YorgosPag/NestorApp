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
  processInboundEmail,
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

async function handleMailgunInbound(request: NextRequest): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ ok: false, error: 'invalid_content_type' }, { status: 400 });
  }

  const formData = await request.formData();
  const signatureCheck = verifyMailgunSignature({
    timestamp: getFormString(formData, ['timestamp']),
    token: getFormString(formData, ['token']),
    signature: getFormString(formData, ['signature']),
    signingKey: MAILGUN_WEBHOOK_SIGNING_KEY,
  });

  if (!signatureCheck.valid) {
    logger.warn('Webhook rejected', { reason: signatureCheck.reason });
    return NextResponse.json({ ok: false, error: signatureCheck.reason }, { status: 401 });
  }

  const fromRaw = getFormString(formData, ['from', 'sender']);
  const sender = parseAddress(fromRaw);
  if (!sender) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 1 });
  }

  const toRaw = getFormString(formData, ['recipient', 'to']);
  const ccRaw = getFormString(formData, ['cc']);
  const recipients = [
    ...splitAddresses(toRaw),
    ...splitAddresses(ccRaw),
  ];

  if (recipients.length === 0) {
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

  const result = await processInboundEmail({
    provider: 'mailgun',
    providerMessageId,
    sender,
    recipients,
    subject,
    contentText,
    receivedAt,
    attachments,
    raw: {
      messageId,
      hasHtml: Boolean(htmlBody),
    },
  });

  return NextResponse.json({
    ok: true,
    processed: result.processed ? 1 : 0,
    skipped: result.skipped ? 1 : 0,
  });
}

export const POST = withWebhookRateLimit(handleMailgunInbound);

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: 'ok',
    service: 'mailgun-inbound',
    hasSigningKey: Boolean(MAILGUN_WEBHOOK_SIGNING_KEY),
  });
}
