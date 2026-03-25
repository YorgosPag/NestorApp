/**
 * =============================================================================
 * TELEGRAM WEBHOOK SECURITY — SECRET TOKEN VALIDATION
 * =============================================================================
 *
 * Enterprise security layer for Telegram webhook requests.
 * Extracted from handler.ts per ADR file-size standards (max 500 lines).
 *
 * @module api/communications/webhooks/telegram/telegram-security
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import type { NextRequest } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramSecurity');

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

/** Result of secret token validation */
export interface SecretValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate Telegram webhook secret token
 *
 * @enterprise FAIL-CLOSED: Rejects if secret not configured or mismatched
 *
 * @returns {SecretValidationResult}
 * - valid=true: Request passes validation
 * - valid=false: Request rejected, error contains reason code
 *
 * Error codes:
 * - 'webhook_secret_not_configured': Production without TELEGRAM_WEBHOOK_SECRET
 * - 'missing_secret_token': Request missing X-Telegram-Bot-Api-Secret-Token header
 * - 'invalid_secret_token': Token doesn't match configured secret
 */
export function validateSecretToken(request: NextRequest): SecretValidationResult {
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  // Development mode bypass (if not enforced)
  if (!ENFORCE_SECRET_VALIDATION) {
    if (!secretHeader) {
      logger.warn('[DEV] No secret token provided, allowing (enforcement disabled)');
    }
    return { valid: true };
  }

  // Production: FAIL-CLOSED
  if (!TELEGRAM_WEBHOOK_SECRET) {
    logger.error('SECURITY: TELEGRAM_WEBHOOK_SECRET not configured - rejecting request');
    return { valid: false, error: 'webhook_secret_not_configured' };
  }

  if (!secretHeader) {
    logger.warn('Security: Missing X-Telegram-Bot-Api-Secret-Token header');
    return { valid: false, error: 'missing_secret_token' };
  }

  if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    logger.warn('Security: Invalid secret token');
    return { valid: false, error: 'invalid_secret_token' };
  }

  return { valid: true };
}
