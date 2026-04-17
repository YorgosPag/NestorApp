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

import { NextRequest } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronAuth');

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
