// types/notification.ts
// ✅ ENTERPRISE: Complete notification types με trace IDs, TTL, actions, channels

export type Severity = 'info' | 'success' | 'warning' | 'error' | 'critical';
export type Channel = 'inapp' | 'email' | 'push' | 'sms';
export type DeliveryState =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'seen'
  | 'acted'
  | 'failed'
  | 'expired'
  | 'dismissed';

export interface NotificationAction {
  id: string;
  label: string;
  url?: string; // optional deep-link
  method?: 'GET' | 'POST';
  destructive?: boolean;
}

export interface TraceMeta {
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
}

export type Notification = {
  id: string;
  tenantId: string;
  userId: string;
  createdAt: string; // ISO 8601
  updatedAt?: string; // ISO 8601
  ttlSec?: number;
  expiresAt?: string; // ISO 8601

  severity: Severity;
  title: string;
  body?: string; // plain text
  bodyRich?: { type: 'markdown' | 'html' | 'json'; content?: string | unknown }; // server-sanitized
  tags?: string[];

  source: { service: string; feature?: string; env?: 'dev' | 'staging' | 'prod' };
  actions?: NotificationAction[];

  channel: Channel; // where it was delivered
  delivery: { state: DeliveryState; attempts: number; lastError?: string };
  meta?: TraceMeta;

  /** i18n key for client-side translation (falls back to title if missing) */
  titleKey?: string;
  /** i18n interpolation params for titleKey (e.g. { sender: "John" }) */
  titleParams?: Record<string, string>;
};

export type Cursor = string & { readonly brand: unique symbol };

export interface ListResponse {
  items: Notification[];
  cursor?: Cursor;
  etag?: string;
}

export interface AckRequest { ids: string[]; seenAt?: string; }
export interface ActionRequest { id: string; actionId: string; payload?: Record<string, unknown>; }

export interface QuietHours { start: string; end: string; days?: number[] } // HH:mm, 0=Sun

export interface UserPreferences {
  locale: string; // e.g. 'el-GR'
  timezone: string; // IANA
  quietHours?: QuietHours;
  mutedTags?: string[];
  mutedSeverities?: Severity[];
  channels?: Record<Channel, { enabled: boolean; address?: string }>;
  digest?: { enabled: boolean; frequency: 'hourly' | 'daily' | 'weekly' };
}
