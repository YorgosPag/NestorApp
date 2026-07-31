/**
 * =============================================================================
 * CRON AUTHORIZATION — SSoT for Vercel Cron job authentication
 * =============================================================================
 *
 * Centralized verification of Vercel Cron requests.
 * Vercel sends CRON_SECRET as Bearer token in the Authorization header.
 *
 * SSoT: ALL cron routes must use this module instead of local copies.
 *
 * @module lib/cron-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronAuth');

/**
 * How long a soft-deleted document stays recoverable before a purge job may
 * remove it — 30 days, in milliseconds.
 *
 * Lives here rather than in each purge route because it is the *same promise*
 * to the user ("you have a month to change your mind"), not a per-route knob.
 * Two routes declaring it independently is two places to edit when the promise
 * changes, and one of them will be missed.
 */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Verify that a request comes from Vercel Cron (or authorized caller).
 *
 * Checks:
 * 1. Bearer token in Authorization header matches CRON_SECRET
 * 2. Fallback: X-Cron-Secret header matches CRON_SECRET
 *
 * If CRON_SECRET is not configured, blocks the request (secure default).
 */
export function verifyCronAuthorization(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured — blocking unauthenticated cron access');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const cronSecretHeader = request.headers.get('x-cron-secret');
  if (cronSecretHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * Guard clause for a cron route: returns the `401` response to send back, or
 * `null` when the caller is authorized and the handler should proceed.
 *
 * ```ts
 * const unauthorized = rejectUnauthorizedCron(request);
 * if (unauthorized) return unauthorized;
 * ```
 *
 * Returning the response instead of throwing keeps the call site a plain early
 * return — and keeps the status code and body in ONE place. When every route
 * spelled out its own `NextResponse.json({ error: 'Unauthorized' }, ...)`, the
 * shape of a rejection was a copy-paste convention rather than a decision, and
 * CHECK 3.28 flagged the resulting twins (ADR-584).
 */
export function rejectUnauthorizedCron(request: NextRequest): NextResponse | null {
  if (verifyCronAuthorization(request)) {
    return null;
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
