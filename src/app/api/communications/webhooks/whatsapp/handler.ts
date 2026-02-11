/**
 * =============================================================================
 * WHATSAPP WEBHOOK HANDLER — ENTERPRISE SECURITY
 * =============================================================================
 *
 * Handles incoming WhatsApp Cloud API webhook events:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming messages + status updates
 *
 * Security:
 * - Webhook signature verification (X-Hub-Signature-256) with App Secret
 * - Idempotent message processing (deterministic doc IDs)
 * - Rate limiting via withWebhookRateLimit
 *
 * @module api/communications/webhooks/whatsapp/handler
 * @enterprise ADR-174 - Meta Omnichannel Integration
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { storeWhatsAppMessage, updateMessageDeliveryStatus } from './crm-adapter';
import { markWhatsAppMessageRead } from './whatsapp-client';
import type {
  WhatsAppWebhookPayload,
  WhatsAppChangeValue,
  WhatsAppMessage,
  WhatsAppContact,
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WhatsAppWebhookHandler');

// ============================================================================
// GET — WEBHOOK VERIFICATION
// ============================================================================

/**
 * Meta sends a GET request when you configure the webhook URL.
 * We must respond with the hub.challenge value if the verify token matches.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export async function handleGET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    // Must return JUST the challenge string with 200 status
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('WhatsApp webhook verification failed', { mode, tokenMatch: token === verifyToken });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================================
// POST — INCOMING MESSAGES & STATUS UPDATES
// ============================================================================

/**
 * Handle incoming webhook events from WhatsApp Cloud API.
 *
 * IMPORTANT: Always return 200 to prevent Meta from retrying.
 * Meta retries on non-2xx responses.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature (security)
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifySignature(rawBody, signature)) {
      logger.warn('WhatsApp webhook signature verification failed');
      // Return 200 to prevent retries but log rejection
      return NextResponse.json({ ok: true, rejected: true, reason: 'invalid_signature' });
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      logger.warn('Unexpected webhook object', { object: payload.object });
      return NextResponse.json({ ok: true });
    }

    // 3. Process each entry
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await processChangeValue(change.value);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('WhatsApp webhook processing error', { error });
    // Return 200 even on error to prevent Meta from retrying
    return NextResponse.json({ ok: true, error: 'Processing error' });
  }
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processChangeValue(value: WhatsAppChangeValue): Promise<void> {
  // Handle status updates (sent, delivered, read)
  if (value.statuses && value.statuses.length > 0) {
    for (const status of value.statuses) {
      await updateMessageDeliveryStatus(status.id, status.status);
    }
  }

  // Handle incoming messages
  if (value.messages && value.messages.length > 0) {
    for (const message of value.messages) {
      await processIncomingMessage(message, value.contacts);
    }
  }

  // Handle errors from Meta
  if (value.errors && value.errors.length > 0) {
    for (const error of value.errors) {
      logger.error('WhatsApp API error from webhook', {
        code: error.code,
        title: error.title,
        message: error.message,
      });
    }
  }
}

async function processIncomingMessage(
  message: WhatsAppMessage,
  contacts: WhatsAppContact[] | undefined
): Promise<void> {
  // Find matching contact info
  const contact = contacts?.find(c => c.wa_id === message.from);

  logger.info('Processing WhatsApp message', {
    type: message.type,
    from: message.from.slice(-4), // Last 4 digits only (privacy)
    id: message.id,
  });

  // Skip reaction messages for now (Phase 2)
  if (message.type === 'reaction') {
    logger.info('Skipping reaction message (Phase 2)');
    return;
  }

  // Store in CRM
  const result = await storeWhatsAppMessage(message, contact, 'inbound');

  if (result.messageDocId) {
    // Mark as read (sends blue checkmarks)
    await markWhatsAppMessageRead(message.id);
    logger.info('WhatsApp message processed', {
      docId: result.messageDocId,
      conversationId: result.conversationId,
      isNew: result.isNewConversation,
    });
  }

  // TODO (Phase 2): Feed to AI pipeline for auto-reply
  // Similar to telegram handler's after() + feedTelegramToPipeline pattern
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify the X-Hub-Signature-256 header using HMAC-SHA256 with App Secret.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();

  // If no app secret configured, skip verification in development
  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('META_APP_SECRET not configured in production — rejecting');
      return false;
    }
    logger.warn('META_APP_SECRET not configured — skipping signature verification (dev mode)');
    return true;
  }

  if (!signature) {
    logger.warn('No X-Hub-Signature-256 header present');
    return false;
  }

  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  try {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    // Fallback (should never happen in Node.js)
    return signature === expectedSignature;
  }
}
