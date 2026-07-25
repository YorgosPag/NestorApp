// src/app/api/admin/telegram/webhook/telegram-webhook-client.ts
//
// SSoT for Telegram Bot API *webhook-management* operations (getWebhookInfo /
// setWebhook / deleteWebhook), extracted from route.ts per ADR-705 split.
//
// Deliberately separate from the message-sending clients
// (communications/webhooks/telegram/telegram/client.ts, .../admin/client.ts):
// those return a normalized {success,...} shape and — for the admin one — use a
// DIFFERENT bot token (ADMIN_TELEGRAM_BOT_TOKEN). Webhook management uses the main
// TELEGRAM_BOT_TOKEN and needs the raw Telegram envelope. See telegram-webhook-types.ts.

import type { TelegramApiResponse, WebhookInfo, SetWebhookRequest } from './telegram-webhook-types';
import { getErrorMessage } from '@/lib/error-utils';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Low-level call to a Telegram Bot API method. Returns the raw envelope; never throws.
 */
export async function callTelegramApi<T>(
  method: string,
  params?: Record<string, unknown>,
): Promise<TelegramApiResponse<T>> {
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
    return { ok: false, description: getErrorMessage(error) };
  }
}

/** Fetch current webhook configuration and status. */
export function getWebhookInfo(): Promise<TelegramApiResponse<WebhookInfo>> {
  return callTelegramApi<WebhookInfo>('getWebhookInfo');
}

/** Resolved parameters passed to Telegram's `setWebhook`. */
export type SetWebhookParams = Record<string, unknown> & {
  url: string;
  secret_token: string;
  allowed_updates: string[];
};

/** Set or update the webhook. */
export function setWebhook(params: SetWebhookParams): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>('setWebhook', params);
}

/** Remove the webhook. Keeps pending updates unless told otherwise. */
export function deleteWebhook(dropPendingUpdates = false): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>('deleteWebhook', { drop_pending_updates: dropPendingUpdates });
}

/**
 * Build the setWebhook parameter object from a validated request.
 * `url` and `secretToken` are resolved by the caller (env fallbacks live in the handler).
 */
export function buildSetWebhookParams(
  url: string,
  secretToken: string,
  body: SetWebhookRequest,
): SetWebhookParams {
  const params: SetWebhookParams = {
    url,
    secret_token: secretToken,
    allowed_updates: body.allowed_updates || ['message', 'callback_query'],
  };

  if (body.drop_pending_updates) {
    params.drop_pending_updates = true;
  }

  if (body.max_connections) {
    params.max_connections = body.max_connections;
  }

  return params;
}

/**
 * Resolve the default webhook URL from an explicit environment variable.
 * ENTERPRISE: no auto-detection — TELEGRAM_WEBHOOK_URL must be set.
 */
export function getDefaultWebhookUrl(): string | null {
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
