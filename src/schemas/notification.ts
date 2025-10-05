// schemas/notification.ts
// ✅ ENTERPRISE: Zod validation schemas για runtime type safety

import { z } from 'zod';

export const Severity = z.enum(['info', 'success', 'warning', 'error', 'critical']);
export const Channel = z.enum(['inapp', 'email', 'push', 'sms']);
export const DeliveryState = z.enum(['queued','sent','delivered','seen','acted','failed','expired']);

export const NotificationAction = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url().optional(),
  method: z.enum(['GET','POST']).optional(),
  destructive: z.boolean().optional(),
});

export const TraceMeta = z.object({
  correlationId: z.string().optional(),
  requestId: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

export const NotificationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  ttlSec: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  severity: Severity,
  title: z.string().min(1),
  body: z.string().optional(),
  bodyRich: z
    .object({ type: z.enum(['markdown','html','json']), content: z.union([z.string(), z.unknown()]) })
    .optional(),
  tags: z.array(z.string()).optional(),
  source: z.object({ service: z.string(), feature: z.string().optional(), env: z.enum(['dev','staging','prod']).optional() }),
  actions: z.array(NotificationAction).optional(),
  channel: Channel,
  delivery: z.object({ state: DeliveryState, attempts: z.number().int().nonnegative(), lastError: z.string().optional() }),
  meta: TraceMeta.optional(),
});

export const ListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  cursor: z.string().optional(),
});

export const AckRequestSchema = z.object({ ids: z.array(z.string().min(1)), seenAt: z.string().datetime().optional() });
export const ActionRequestSchema = z.object({ id: z.string().min(1), actionId: z.string().min(1), payload: z.record(z.unknown()).optional() });

export const QuietHoursSchema = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)).optional() });
export const UserPreferencesSchema = z.object({
  locale: z.string(),
  timezone: z.string(),
  quietHours: QuietHoursSchema.optional(),
  mutedTags: z.array(z.string()).optional(),
  mutedSeverities: z.array(Severity).optional(),
  channels: z.record(Channel, z.object({ enabled: z.boolean(), address: z.string().optional() })).optional(),
  digest: z.object({ enabled: z.boolean(), frequency: z.enum(['hourly','daily','weekly']) }).optional(),
});
