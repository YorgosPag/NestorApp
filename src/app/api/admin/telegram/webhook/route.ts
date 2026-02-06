/**
 * =============================================================================
 * TELEGRAM WEBHOOK ADMIN API - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Manages Telegram bot webhook configuration
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Admin configuration (webhook management)
 *
 * This endpoint manages Telegram bot webhook configuration:
 * - GET: Get current webhook info (getWebhookInfo)
 * - POST: Set/update webhook URL and secret (setWebhook)
 * - DELETE: Remove webhook (debugging/testing)
 *
 * @method GET - Get webhook info
 * @method POST - Set/update webhook
 * @method DELETE - Remove webhook
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:system:configure permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logSystemOperation)
 *
 * @module api/admin/telegram/webhook
 * @enterprise EPIC C - Telegram Operationalization
 * @migration OLD auth (requireAdminContext) → NEW auth (withAuth)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/services/enterprise-id.service';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports (NEW auth system)
import { withAuth, logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withTelegramRateLimit } from '@/lib/middleware/with-rate-limit';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

// ============================================================================
// TELEGRAM API HELPERS
// ============================================================================

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function callTelegramApi<T>(method: string, params?: Record<string, unknown>): Promise<TelegramResponse<T>> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const url = `${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/${method}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    });

    return await response.json();
  } catch (error) {
    return {
      ok: false,
      description: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// GET - Get Webhook Info (withAuth protected)
// ============================================================================

/**
 * Get current webhook configuration and status
 * @enterprise Use this to verify webhook is properly configured
 * @security withAuth + super_admin check + admin:system:configure permission
 * @rateLimit TELEGRAM (15 req/min) - Get Telegram webhook configuration
 */
export const GET = withTelegramRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleGetWebhookInfo(req, ctx);
    },
    { permissions: 'admin:system:configure' }
  )
);

/**
 * Internal handler for GET (webhook info).
 */
async function handleGetWebhookInfo(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const operationId = generateRequestId();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [GET /api/admin/telegram/webhook] BLOCKED: Non-super_admin attempted webhook info`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole, operationId }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  console.log('📡 Admin: Getting Telegram webhook info...', { email: ctx.email, operationId });

  const result = await callTelegramApi<WebhookInfo>('getWebhookInfo');

  if (!result.ok) {
    return NextResponse.json({
      success: false,
      error: result.description || 'Failed to get webhook info',
    }, { status: 500 });
  }

  const webhookInfo = result.result;

  // Parse and enhance the response
  const status = {
    success: true,
    webhook: {
      url: webhookInfo?.url || '(not set)',
      isConfigured: !!webhookInfo?.url,
      pendingUpdates: webhookInfo?.pending_update_count || 0,
      hasCustomCertificate: webhookInfo?.has_custom_certificate || false,
      ipAddress: webhookInfo?.ip_address,
      maxConnections: webhookInfo?.max_connections,
      allowedUpdates: webhookInfo?.allowed_updates,
    },
    health: {
      hasErrors: !!webhookInfo?.last_error_date,
      lastErrorDate: webhookInfo?.last_error_date
        ? new Date(webhookInfo.last_error_date * 1000).toISOString()
        : null,
      lastErrorMessage: webhookInfo?.last_error_message || null,
      lastSyncErrorDate: webhookInfo?.last_synchronization_error_date
        ? new Date(webhookInfo.last_synchronization_error_date * 1000).toISOString()
        : null,
    },
    recommendations: [] as string[],
  };

  // Add recommendations based on status
  if (!status.webhook.isConfigured) {
    status.recommendations.push('Webhook URL not set. Use POST to configure.');
  }
  if (status.webhook.pendingUpdates > 10) {
    status.recommendations.push(`High pending update count (${status.webhook.pendingUpdates}). Check webhook handler.`);
  }
  if (status.health.hasErrors) {
    status.recommendations.push(`Recent errors detected: ${status.health.lastErrorMessage}`);
  }

  console.log('✅ Webhook info retrieved:', status.webhook.url);
  return NextResponse.json(status);
}

// ============================================================================
// POST - Set Webhook (withAuth protected)
// ============================================================================

interface SetWebhookRequest {
  url?: string;  // If not provided, will use auto-detected URL
  secret_token?: string;  // If not provided, will use TELEGRAM_WEBHOOK_SECRET
  drop_pending_updates?: boolean;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Set or update webhook configuration
 * @enterprise Includes secret_token for request validation
 * @security withAuth + super_admin check + audit logging + admin:system:configure permission
 * @rateLimit TELEGRAM (15 req/min) - Set Telegram webhook configuration
 */
export const POST = withTelegramRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleSetWebhook(req, ctx);
    },
    { permissions: 'admin:system:configure' }
  )
);

/**
 * Internal handler for POST (set webhook).
 */
async function handleSetWebhook(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/admin/telegram/webhook] BLOCKED: Non-super_admin attempted webhook configuration`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole, operationId }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  console.log('📡 Admin: Setting Telegram webhook...', { email: ctx.email, operationId });

  let body: SetWebhookRequest = {};

  try {
    body = await request.json();
  } catch {
    // Empty body is OK - will use defaults
  }

  // Determine webhook URL - ENTERPRISE: Use explicit env var first
  const webhookUrl = body.url || getDefaultWebhookUrl();

  if (!webhookUrl) {
    return NextResponse.json({
      success: false,
      error: 'Could not determine webhook URL. Please provide explicitly.',
    }, { status: 400 });
  }

  // Determine secret token
  const secretToken = body.secret_token || process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secretToken) {
    return NextResponse.json({
      success: false,
      error: 'TELEGRAM_WEBHOOK_SECRET not configured and no secret_token provided.',
      hint: 'Set TELEGRAM_WEBHOOK_SECRET in Vercel environment variables.',
    }, { status: 400 });
  }

  // Build setWebhook parameters
  const params: Record<string, unknown> = {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: body.allowed_updates || ['message', 'callback_query'],
  };

  if (body.drop_pending_updates) {
    params.drop_pending_updates = true;
  }

  if (body.max_connections) {
    params.max_connections = body.max_connections;
  }

  console.log(`🔧 Setting webhook to: ${webhookUrl}`);
  console.log(`🔒 Secret token: ${secretToken.substring(0, 4)}...${secretToken.substring(secretToken.length - 4)}`);

  const result = await callTelegramApi<boolean>('setWebhook', params);

  if (!result.ok) {
    console.error('❌ setWebhook failed:', result.description);
    return NextResponse.json({
      success: false,
      error: result.description || 'Failed to set webhook',
      errorCode: result.error_code,
    }, { status: 500 });
  }

  console.log('✅ Webhook configured successfully');

  // Get updated webhook info to confirm
  const verifyResult = await callTelegramApi<WebhookInfo>('getWebhookInfo');

  const duration = Date.now() - startTime;

  // 🏢 ENTERPRISE: Audit logging (non-blocking)
  const metadata = extractRequestMetadata(request);
  await logSystemOperation(
    ctx,
    'telegram_webhook_configure',
    {
      operation: 'set-telegram-webhook',
      webhookUrl,
      allowedUpdates: params.allowed_updates,
      dropPendingUpdates: body.drop_pending_updates || false,
      maxConnections: body.max_connections,
      verificationSuccess: verifyResult.ok,
      confirmedUrl: verifyResult.result?.url,
      pendingUpdates: verifyResult.result?.pending_update_count,
      executionTimeMs: duration,
      result: 'success',
      metadata,
    },
    `Telegram webhook configured by ${ctx.globalRole} ${ctx.email}`
  ).catch((err: unknown) => {
    console.error('⚠️ Audit logging failed (non-blocking):', err);
  });

  return NextResponse.json({
    success: true,
    message: 'Webhook configured successfully',
    webhook: {
      url: webhookUrl,
      secretConfigured: true,
      allowedUpdates: params.allowed_updates,
    },
    verification: verifyResult.ok ? {
      confirmedUrl: verifyResult.result?.url,
      pendingUpdates: verifyResult.result?.pending_update_count,
    } : null,
    executionTimeMs: duration,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get default webhook URL from explicit environment variable
 * @enterprise TELEGRAM_WEBHOOK_URL must be set - no guessing
 */
function getDefaultWebhookUrl(): string | null {
  // ENTERPRISE: Use explicit env var - no auto-detection
  const explicitUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  // Fallback for Vercel preview deployments only
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}/api/communications/webhooks/telegram`;
  }

  return null;
}

// ============================================================================
// DELETE - Remove Webhook (withAuth protected)
// ============================================================================

/**
 * Remove webhook (for debugging/testing)
 * @security withAuth + super_admin check + audit logging + admin:system:configure permission
 * @rateLimit TELEGRAM (15 req/min) - Delete Telegram webhook
 */
export const DELETE = withTelegramRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleDeleteWebhook(req, ctx);
    },
    { permissions: 'admin:system:configure' }
  )
);

/**
 * Internal handler for DELETE (remove webhook).
 */
async function handleDeleteWebhook(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [DELETE /api/admin/telegram/webhook] BLOCKED: Non-super_admin attempted webhook deletion`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole, operationId }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  console.log('📡 Admin: Removing Telegram webhook...', { email: ctx.email, operationId });

  const result = await callTelegramApi<boolean>('deleteWebhook', {
    drop_pending_updates: false,  // Keep pending updates by default
  });

  if (!result.ok) {
    return NextResponse.json({
      success: false,
      error: result.description || 'Failed to delete webhook',
    }, { status: 500 });
  }

  console.log('✅ Webhook removed');

  const duration = Date.now() - startTime;

  // 🏢 ENTERPRISE: Audit logging (non-blocking)
  const metadata = extractRequestMetadata(request);
  await logSystemOperation(
    ctx,
    'telegram_webhook_delete',
    {
      operation: 'delete-telegram-webhook',
      executionTimeMs: duration,
      result: 'success',
      metadata,
    },
    `Telegram webhook deleted by ${ctx.globalRole} ${ctx.email}`
  ).catch((err: unknown) => {
    console.error('⚠️ Audit logging failed (non-blocking):', err);
  });

  return NextResponse.json({
    success: true,
    message: 'Webhook removed. Bot will use long polling if configured.',
    executionTimeMs: duration,
  });
}
