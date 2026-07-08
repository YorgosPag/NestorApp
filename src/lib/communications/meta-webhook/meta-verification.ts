/**
 * =============================================================================
 * META WEBHOOK GET VERIFICATION — SHARED SSoT
 * =============================================================================
 *
 * Single Source of Truth for the Meta webhook verification handshake. When you
 * configure a webhook URL, Meta issues a GET with `hub.mode`, `hub.verify_token`
 * and `hub.challenge`; the endpoint must echo the challenge iff the token matches.
 * The flow is identical across Instagram / Messenger / WhatsApp — only the
 * per-platform verify-token env var and the log label differ, so those are
 * injected by the caller.
 *
 * @module lib/communications/meta-webhook/meta-verification
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { Logger } from '@/lib/telemetry';

/** Per-platform inputs for the Meta webhook GET verification handshake. */
export interface MetaWebhookVerificationConfig {
  /** The platform's configured verify token (already trimmed by the caller, or undefined). */
  verifyToken: string | undefined;
  /** Human-readable platform label used only in log lines (e.g. 'Instagram'). */
  platform: string;
  /** Module logger for the calling platform handler. */
  logger: Logger;
}

/**
 * Handle the Meta webhook verification GET request (`hub.challenge` echo).
 *
 * @returns 200 with the raw challenge string on success, 403 otherwise.
 */
export function handleMetaWebhookGet(
  request: NextRequest,
  { verifyToken, platform, logger }: MetaWebhookVerificationConfig
): NextResponse {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info(`${platform} webhook verified successfully`);
    // Must return JUST the challenge string with 200 status
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn(`${platform} webhook verification failed`, { mode, tokenMatch: token === verifyToken });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}
