/**
 * =============================================================================
 * TELEGRAM WEBHOOK ADMIN API
 * =============================================================================
 *
 * Admin endpoint for managing Telegram webhook configuration.
 * - GET: Get current webhook info (getWebhookInfo)
 * - POST: Set/update webhook URL and secret (setWebhook)
 *
 * @module api/admin/telegram/webhook
 * @enterprise EPIC C - Telegram Operationalization
 * @security Requires admin authentication via requireAdminContext
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminContext, audit } from '@/server/admin/admin-guards';
import { generateRequestId } from '@/services/enterprise-id.service';

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
// GET - Get Webhook Info
// ============================================================================

/**
 * Get current webhook configuration and status
 * @enterprise Use this to verify webhook is properly configured
 * @security Requires admin authentication
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const operationId = generateRequestId();

  // 🔒 SECURITY: Require admin authentication
  const authResult = await requireAdminContext(request, operationId);
  if (!authResult.success) {
    audit(operationId, 'WEBHOOK_INFO_DENIED', { error: authResult.error });
    return NextResponse.json({
      success: false,
      error: authResult.error,
    }, { status: 403 });
  }

  audit(operationId, 'WEBHOOK_INFO_START', { admin: authResult.context?.email }, authResult.context);
  console.log('📡 Admin: Getting Telegram webhook info...');

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
// POST - Set Webhook
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
 * @security Requires admin authentication
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const operationId = generateRequestId();

  // 🔒 SECURITY: Require admin authentication
  const authResult = await requireAdminContext(request, operationId);
  if (!authResult.success) {
    audit(operationId, 'SET_WEBHOOK_DENIED', { error: authResult.error });
    return NextResponse.json({
      success: false,
      error: authResult.error,
    }, { status: 403 });
  }

  audit(operationId, 'SET_WEBHOOK_START', { admin: authResult.context?.email }, authResult.context);
  console.log('📡 Admin: Setting Telegram webhook...');

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
// DELETE - Remove Webhook (optional utility)
// ============================================================================

/**
 * Remove webhook (for debugging/testing)
 * @security Requires admin authentication
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const operationId = generateRequestId();

  // 🔒 SECURITY: Require admin authentication
  const authResult = await requireAdminContext(request, operationId);
  if (!authResult.success) {
    audit(operationId, 'DELETE_WEBHOOK_DENIED', { error: authResult.error });
    return NextResponse.json({
      success: false,
      error: authResult.error,
    }, { status: 403 });
  }

  audit(operationId, 'DELETE_WEBHOOK_START', { admin: authResult.context?.email }, authResult.context);
  console.log('📡 Admin: Removing Telegram webhook...');

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
  return NextResponse.json({
    success: true,
    message: 'Webhook removed. Bot will use long polling if configured.',
  });
}
