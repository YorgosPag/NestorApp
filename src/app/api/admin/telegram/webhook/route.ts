/**
 * =============================================================================
 * TELEGRAM WEBHOOK ADMIN API - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Manages Telegram bot webhook configuration:
 * - GET:    getWebhookInfo   — current webhook config + health
 * - POST:   setWebhook       — set/update webhook URL and secret_token
 * - DELETE: removeWebhook    — remove webhook (debugging/testing)
 *
 * Handlers live in `telegram-webhook.handlers.ts` and Telegram API calls in
 * `telegram-webhook-client.ts` (ADR-705 split) so the route stays under the
 * N.7.1 300-line limit. Each verb keeps its own bypass-role guard (ADR-703) +
 * audit (logSystemOperation).
 *
 * @security Multi-layer: withAuth (admin:system:configure) + super_admin (explicit) + audit.
 * @rateLimit TELEGRAM (15 req/min) on every verb.
 * @module api/admin/telegram/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withTelegramRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  handleGetWebhookInfo,
  handleSetWebhook,
  handleDeleteWebhook,
} from './telegram-webhook.handlers';

const ADMIN_PERMISSION = 'admin:system:configure';

export const GET = withTelegramRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleGetWebhookInfo(req, ctx),
  { permissions: ADMIN_PERMISSION },
));

export const POST = withTelegramRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSetWebhook(req, ctx),
  { permissions: ADMIN_PERMISSION },
));

export const DELETE = withTelegramRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleDeleteWebhook(req, ctx),
  { permissions: ADMIN_PERMISSION },
));
