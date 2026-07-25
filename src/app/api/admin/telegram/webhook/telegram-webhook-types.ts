// src/app/api/admin/telegram/webhook/telegram-webhook-types.ts
//
// Types for the Telegram Bot API webhook-management admin endpoint (ADR-705 split).
// The shape here is the RAW Telegram Bot API envelope ({ ok, result, description,
// error_code }) — deliberately distinct from the normalized {success,...} shape used
// by the message-sending clients under communications/webhooks/telegram/*, because
// webhook configuration needs the raw `error_code` / `description` fields directly.

/** Raw Telegram Bot API response envelope. */
export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/** Result payload of `getWebhookInfo`. */
export interface WebhookInfo {
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

/** Client-supplied body for the POST (set webhook) handler. */
export interface SetWebhookRequest {
  url?: string; // If not provided, will use auto-detected URL
  secret_token?: string; // If not provided, will use TELEGRAM_WEBHOOK_SECRET
  drop_pending_updates?: boolean;
  max_connections?: number;
  allowed_updates?: string[];
}

/** Enhanced, presentation-ready GET response (webhook + health + recommendations). */
export interface WebhookStatus {
  success: true;
  webhook: {
    url: string;
    isConfigured: boolean;
    pendingUpdates: number;
    hasCustomCertificate: boolean;
    ipAddress?: string;
    maxConnections?: number;
    allowedUpdates?: string[];
  };
  health: {
    hasErrors: boolean;
    lastErrorDate: string | null;
    lastErrorMessage: string | null;
    lastSyncErrorDate: string | null;
  };
  recommendations: string[];
}
