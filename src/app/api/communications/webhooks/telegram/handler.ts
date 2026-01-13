/**
 * =============================================================================
 * TELEGRAM WEBHOOK HANDLER - ENTERPRISE SECURITY
 * =============================================================================
 *
 * Handles incoming Telegram webhook requests with enterprise security:
 * - Secret token validation (fail-closed)
 * - Rate limiting via bot-security.ts
 * - CRM integration with conversation model
 *
 * @module api/communications/webhooks/telegram/handler
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isFirebaseAvailable } from './firebase/availability';
import { processMessage } from './message/process-message';
import { handleCallbackQuery } from './message/callback-query';
import { sendTelegramMessage } from './telegram/client';
import { storeMessageInCRM } from './crm/store';
import { BOT_IDENTITY } from '@/config/domain-constants';
import type { TelegramMessage, TelegramSendPayload } from './telegram/types';

// ============================================================================
// SECURITY: SECRET TOKEN VALIDATION (B5 - Enterprise Policy Documentation)
// ============================================================================
//
// WEBHOOK SECRET TOKEN VALIDATION POLICY
// =====================================
//
// 1. HOW IT WORKS:
//    - When you call Telegram's setWebhook API, you can set a `secret_token`
//    - Telegram will then send this token in the `X-Telegram-Bot-Api-Secret-Token` header
//    - We validate this header matches our configured secret
//
// 2. SECURITY MODEL (FAIL-CLOSED):
//    - Production (NODE_ENV=production): ALWAYS validates, rejects if not configured
//    - Development: Can be bypassed via TELEGRAM_ENFORCE_SECRET=false
//    - Missing secret in production = REJECT (not fail-open)
//    - Invalid secret = REJECT
//
// 3. RESPONSE POLICY:
//    - On rejection: Return HTTP 200 with { ok: true, rejected: true, error: '...' }
//    - WHY 200 for rejections? Telegram retries webhooks on 4xx/5xx status codes.
//      Returning 200 acknowledges receipt and stops retries, while the body
//      indicates the rejection reason for audit/monitoring purposes.
//    - ENTERPRISE DECISION: We explicitly choose to acknowledge unauthorized
//      requests to prevent retry loops. All rejections are audit-logged.
//    - Reference: Telegram Bot API retry behavior documentation
//
// 4. MONITORING & OBSERVABILITY:
//    - All rejections are logged with emoji prefixes for easy grep:
//      🚨 = Critical (secret not configured in production)
//      🔒 = Security event (invalid/missing token)
//      🚫 = Rejection summary
//    - Integration with getWebhookInfo monitoring:
//      - pending_update_count: High values may indicate webhook issues
//      - last_error_date/last_error_message: Telegram-side errors
//
// 5. SETUP REQUIREMENTS:
//    - Set TELEGRAM_WEBHOOK_SECRET in environment (Vercel/Firebase secrets)
//    - Call setWebhook with same secret_token value
//    - Verify with getWebhookInfo that webhook is properly configured
//
// ============================================================================

/**
 * Telegram webhook secret token from environment
 * @enterprise Set via Vercel/Firebase secrets - NEVER hardcode
 */
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Whether to enforce secret token validation
 * @enterprise Set to true in production, can be false for development
 */
const ENFORCE_SECRET_VALIDATION = process.env.NODE_ENV === 'production' ||
  process.env.TELEGRAM_ENFORCE_SECRET === 'true';

/**
 * Validate Telegram webhook secret token
 *
 * @enterprise FAIL-CLOSED: Rejects if secret not configured or mismatched
 *
 * @returns {valid: boolean, error?: string}
 * - valid=true: Request passes validation
 * - valid=false: Request rejected, error contains reason code
 *
 * Error codes:
 * - 'webhook_secret_not_configured': Production without TELEGRAM_WEBHOOK_SECRET
 * - 'missing_secret_token': Request missing X-Telegram-Bot-Api-Secret-Token header
 * - 'invalid_secret_token': Token doesn't match configured secret
 */
function validateSecretToken(request: NextRequest): { valid: boolean; error?: string } {
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  // Development mode bypass (if not enforced)
  if (!ENFORCE_SECRET_VALIDATION) {
    if (!secretHeader) {
      console.warn('⚠️ [DEV] No secret token provided, allowing (enforcement disabled)');
    }
    return { valid: true };
  }

  // Production: FAIL-CLOSED
  if (!TELEGRAM_WEBHOOK_SECRET) {
    console.error('🚨 SECURITY: TELEGRAM_WEBHOOK_SECRET not configured - rejecting request');
    return { valid: false, error: 'webhook_secret_not_configured' };
  }

  if (!secretHeader) {
    console.warn('🔒 Security: Missing X-Telegram-Bot-Api-Secret-Token header');
    return { valid: false, error: 'missing_secret_token' };
  }

  if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    console.warn('🔒 Security: Invalid secret token');
    return { valid: false, error: 'invalid_secret_token' };
  }

  return { valid: true };
}

/**
 * Main orchestrator for handling incoming Telegram webhook requests.
 */
async function processTelegramUpdate(webhookData: TelegramMessage): Promise<void> {
  let telegramResponse: TelegramSendPayload | null = null;

  if (webhookData.message) {
    console.log('💬 Processing regular message');
    telegramResponse = await processMessage(webhookData.message);
  }

  if (webhookData.callback_query) {
    console.log('🎯 Processing callback query');
    telegramResponse = await handleCallbackQuery(webhookData.callback_query);
  }

  // Send response to Telegram if we have one
  if (telegramResponse) {
    const sentResult = await sendTelegramMessage(telegramResponse);
    console.log('📤 Telegram response sent:', sentResult.success);

    // Store outbound message if Firebase is available - using domain constants (B3 fix)
    // B6 FIX: Use REAL provider message_id from Telegram response, not Date.now()
    if (sentResult.success && isFirebaseAvailable() && telegramResponse.text) {
      // Extract real message_id from Telegram API response
      const apiResult = sentResult.result?.result;
      const providerMessageId = typeof apiResult === 'object' && apiResult && 'message_id' in apiResult
        ? apiResult.message_id
        : null;

      // Only store outbound message if we have a real provider message_id
      // This ensures proper idempotency and traceability
      if (providerMessageId) {
        await storeMessageInCRM({
          chat: { id: telegramResponse.chat_id },
          from: { id: BOT_IDENTITY.ID, first_name: BOT_IDENTITY.DISPLAY_NAME },
          text: telegramResponse.text,
          message_id: providerMessageId
        }, 'outbound');
      } else {
        console.warn('⚠️ Outbound message not stored: no provider message_id in response');
      }
    }
  }
}

/**
 * Handles POST requests from the main route file.
 * @enterprise Security-first: validates secret token before processing
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Telegram webhook received');

    // 1. SECURITY: Validate secret token (FAIL-CLOSED in production)
    const secretValidation = validateSecretToken(request);
    if (!secretValidation.valid) {
      // AUDIT LOG: Security rejection event
      console.error(`🚫 Webhook rejected: ${secretValidation.error} | IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`);
      // B7 FIX: Return 200 to stop Telegram retries, with rejection metadata for audit
      // Enterprise policy: Acknowledge receipt but indicate rejection in body
      return NextResponse.json({ ok: true, rejected: true, error: secretValidation.error }, { status: 200 });
    }

    // 2. Check Firebase availability
    if (!isFirebaseAvailable()) {
      console.warn('⚠️ Firebase not available, returning minimal response');
      return NextResponse.json({ ok: true, status: 'firebase_unavailable' });
    }

    // 3. Parse and process webhook data
    const webhookData = await request.json();
    console.log('📦 Processing webhook data...');

    await processTelegramUpdate(webhookData);

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('❌ Telegram webhook error:', error);
    return NextResponse.json({ ok: true, error: 'internal_error' });
  }
}

/**
 * Handles GET requests from the main route file.
 */
export async function handleGET(): Promise<NextResponse> {
    return NextResponse.json({ 
        status: 'Telegram webhook endpoint is working',
        timestamp: new Date().toISOString(),
        firebase_available: isFirebaseAvailable(),
        features: [
          'Real property search',
          'Smart natural language processing', 
          'Security controls',
          'CRM integration',
          'Build-safe operation'
        ]
    });
}
