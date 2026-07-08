/**
 * =============================================================================
 * META WEBHOOK SIGNATURE VERIFICATION — SHARED SSoT
 * =============================================================================
 *
 * Single Source of Truth for verifying the `X-Hub-Signature-256` header that
 * Meta attaches to every Graph API webhook delivery (Instagram / Messenger /
 * WhatsApp). All Meta Platform products sign with the same App Secret, so the
 * verification logic is identical across platforms — this module owns it once.
 *
 * @module lib/communications/meta-webhook/meta-signature
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { Logger } from '@/lib/telemetry';

/**
 * Verify the `X-Hub-Signature-256` header using HMAC-SHA256 with `META_APP_SECRET`.
 *
 * Behaviour (identical across all Meta platforms):
 * - No `META_APP_SECRET` configured → allow with a warning (temporary dev fallback).
 * - Missing signature header → reject.
 * - Otherwise → constant-time compare against the computed signature.
 *
 * @param rawBody   The raw (unparsed) request body — signature is over the exact bytes.
 * @param signature The `x-hub-signature-256` header value (or null).
 * @param logger    Module logger for the calling platform handler.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signature: string | null,
  logger: Logger
): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();

  // If no app secret configured, allow with warning (temporary until META_APP_SECRET is set)
  if (!appSecret) {
    logger.warn('META_APP_SECRET not configured — skipping signature verification (TEMPORARY)');
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
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    // Fallback (should never happen in Node.js)
    return signature === expectedSignature;
  }
}
