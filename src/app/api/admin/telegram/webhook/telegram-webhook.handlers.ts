/**
 * =============================================================================
 * telegram/webhook — HTTP handlers (ADR-705 split)
 * =============================================================================
 *
 * GET webhook-info · POST set-webhook · DELETE remove-webhook, extracted from
 * route.ts so the route stays under the N.7.1 300-line limit. Each verb keeps
 * its own bypass-role guard (ADR-703) + audit (logSystemOperation — this is a
 * system configuration op, NOT a migration). Telegram API calls delegate to
 * telegram-webhook-client.ts (SSoT).
 *
 * @module api/admin/telegram/webhook/handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/services/enterprise-id.service';
import { logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { isRoleBypass } from '@/lib/auth/roles';
import { createModuleLogger } from '@/lib/telemetry';
import type { WebhookInfo, SetWebhookRequest, WebhookStatus } from './telegram-webhook-types';
import {
  getWebhookInfo,
  setWebhook,
  deleteWebhook,
  buildSetWebhookParams,
  getDefaultWebhookUrl,
} from './telegram-webhook-client';

const logger = createModuleLogger('TelegramWebhookAdminRoute');

// =============================================================================
// Shared helpers
// =============================================================================

/**
 * bypass-role-only check (explicit) — ADR-703. Returns a 403 response if the
 * caller is not a super_admin, otherwise null.
 */
function requireSuperAdmin(
  ctx: AuthContext,
  operationId: string,
  blockedMessage: string,
): NextResponse | null {
  if (isRoleBypass(ctx.globalRole)) {
    return null;
  }

  logger.warn(blockedMessage, {
    userId: ctx.uid,
    email: ctx.email,
    globalRole: ctx.globalRole,
    operationId,
  });

  return NextResponse.json(
    {
      success: false,
      error: 'Forbidden: This operation requires super_admin role',
      code: 'SUPER_ADMIN_REQUIRED',
    },
    { status: 403 },
  );
}

/** Audit a Telegram webhook system operation (non-blocking). */
async function auditSystemOperation(
  request: NextRequest,
  ctx: AuthContext,
  action: string,
  payload: Record<string, unknown>,
  description: string,
): Promise<void> {
  const metadata = extractRequestMetadata(request);

  await logSystemOperation(ctx, action, { ...payload, metadata }, description).catch(
    (err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    },
  );
}

// =============================================================================
// GET — webhook info
// =============================================================================

/** Shape and enhance the raw getWebhookInfo result, with health + recommendations. */
function buildWebhookStatus(webhookInfo: WebhookInfo | undefined): WebhookStatus {
  const status: WebhookStatus = {
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

  if (!status.webhook.isConfigured) {
    status.recommendations.push('Webhook URL not set. Use POST to configure.');
  }
  if (status.webhook.pendingUpdates > 10) {
    status.recommendations.push(`High pending update count (${status.webhook.pendingUpdates}). Check webhook handler.`);
  }
  if (status.health.hasErrors) {
    status.recommendations.push(`Recent errors detected: ${status.health.lastErrorMessage}`);
  }

  return status;
}

/** Internal handler for GET (webhook info). */
export async function handleGetWebhookInfo(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const operationId = generateRequestId();

  const forbidden = requireSuperAdmin(ctx, operationId, 'BLOCKED: Non-super_admin attempted webhook info');
  if (forbidden) {
    return forbidden;
  }

  logger.info('Getting Telegram webhook info', { email: ctx.email, operationId });

  const result = await getWebhookInfo();

  if (!result.ok) {
    return NextResponse.json({
      success: false,
      error: result.description || 'Failed to get webhook info',
    }, { status: 500 });
  }

  const status = buildWebhookStatus(result.result);

  logger.info('Webhook info retrieved', { url: status.webhook.url });
  return NextResponse.json(status);
}

// =============================================================================
// POST — set webhook
// =============================================================================

/** Resolve webhook URL + secret token, or the 400 response explaining what is missing. */
function resolveWebhookConfig(
  body: SetWebhookRequest,
): { url: string; secretToken: string } | { error: NextResponse } {
  const webhookUrl = body.url || getDefaultWebhookUrl();

  if (!webhookUrl) {
    return {
      error: NextResponse.json({
        success: false,
        error: 'Could not determine webhook URL. Please provide explicitly.',
      }, { status: 400 }),
    };
  }

  const secretToken = body.secret_token || process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secretToken) {
    return {
      error: NextResponse.json({
        success: false,
        error: 'TELEGRAM_WEBHOOK_SECRET not configured and no secret_token provided.',
        hint: 'Set TELEGRAM_WEBHOOK_SECRET in Vercel environment variables.',
      }, { status: 400 }),
    };
  }

  return { url: webhookUrl, secretToken };
}

/** Internal handler for POST (set webhook). */
export async function handleSetWebhook(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  const forbidden = requireSuperAdmin(ctx, operationId, 'BLOCKED: Non-super_admin attempted webhook configuration');
  if (forbidden) {
    return forbidden;
  }

  logger.info('Setting Telegram webhook', { email: ctx.email, operationId });

  let body: SetWebhookRequest = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is OK - will use defaults
  }

  const config = resolveWebhookConfig(body);
  if ('error' in config) {
    return config.error;
  }
  const { url: webhookUrl, secretToken } = config;

  const params = buildSetWebhookParams(webhookUrl, secretToken, body);

  logger.info('Setting webhook', {
    webhookUrl,
    secretTokenPreview: `${secretToken.substring(0, 4)}...${secretToken.substring(secretToken.length - 4)}`,
  });

  const result = await setWebhook(params);

  if (!result.ok) {
    logger.error('setWebhook failed', { description: result.description });
    return NextResponse.json({
      success: false,
      error: result.description || 'Failed to set webhook',
      errorCode: result.error_code,
    }, { status: 500 });
  }

  logger.info('Webhook configured successfully');

  // Get updated webhook info to confirm
  const verifyResult = await getWebhookInfo();
  const duration = Date.now() - startTime;

  await auditSystemOperation(
    request,
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
    },
    `Telegram webhook configured by ${ctx.globalRole} ${ctx.email}`,
  );

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

// =============================================================================
// DELETE — remove webhook
// =============================================================================

/** Internal handler for DELETE (remove webhook). */
export async function handleDeleteWebhook(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  const forbidden = requireSuperAdmin(ctx, operationId, 'BLOCKED: Non-super_admin attempted webhook deletion');
  if (forbidden) {
    return forbidden;
  }

  logger.info('Removing Telegram webhook', { email: ctx.email, operationId });

  const result = await deleteWebhook(false); // Keep pending updates by default

  if (!result.ok) {
    return NextResponse.json({
      success: false,
      error: result.description || 'Failed to delete webhook',
    }, { status: 500 });
  }

  logger.info('Webhook removed');

  const duration = Date.now() - startTime;

  await auditSystemOperation(
    request,
    ctx,
    'telegram_webhook_delete',
    {
      operation: 'delete-telegram-webhook',
      executionTimeMs: duration,
      result: 'success',
    },
    `Telegram webhook deleted by ${ctx.globalRole} ${ctx.email}`,
  );

  return NextResponse.json({
    success: true,
    message: 'Webhook removed. Bot will use long polling if configured.',
    executionTimeMs: duration,
  });
}
