/**
 * =============================================================================
 * ENTERPRISE BACKUP API — CONFIG ENDPOINT (ADR-313)
 * =============================================================================
 *
 * GET  /api/admin/backup/config — Read backup configuration
 * POST /api/admin/backup/config — Update backup configuration
 *
 * Configuration stored in Firestore: system/backup_config
 *
 * @module api/admin/backup/config
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { BackupSchedulerService } from '@/services/backup/backup-scheduler.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BackupConfigRoute');

const BACKUP_CONFIG_PATH = 'system/backup_config';

/** Allowed fields for config update — prevents injection of unknown fields */
const ALLOWED_CONFIG_FIELDS = [
  'scheduleEnabled',
  'scheduleCron',
  'retentionCount',
  'incrementalEnabled',
  'fullBackupIntervalDays',
] as const;

/**
 * GET /api/admin/backup/config
 */
export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleGetConfig();
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

/**
 * POST /api/admin/backup/config
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleUpdateConfig(req, ctx);
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

async function handleGetConfig(): Promise<NextResponse> {
  try {
    const scheduler = new BackupSchedulerService();
    const config = await scheduler.getConfig();

    return NextResponse.json({ success: true, config });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to read backup config: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

async function handleUpdateConfig(
  req: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  try {
    const body = await req.json() as Record<string, unknown>;

    // Validate: only allow known fields
    const sanitized: Record<string, unknown> = {};
    for (const field of ALLOWED_CONFIG_FIELDS) {
      if (field in body) {
        sanitized[field] = body[field];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid config fields provided' },
        { status: 400 },
      );
    }

    // Type validation
    if ('scheduleEnabled' in sanitized && typeof sanitized.scheduleEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'scheduleEnabled must be boolean' },
        { status: 400 },
      );
    }
    if ('incrementalEnabled' in sanitized && typeof sanitized.incrementalEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'incrementalEnabled must be boolean' },
        { status: 400 },
      );
    }
    if ('retentionCount' in sanitized) {
      const val = sanitized.retentionCount;
      if (typeof val !== 'number' || val < 1 || val > 100 || !Number.isInteger(val)) {
        return NextResponse.json(
          { success: false, error: 'retentionCount must be integer 1-100' },
          { status: 400 },
        );
      }
    }
    if ('fullBackupIntervalDays' in sanitized) {
      const val = sanitized.fullBackupIntervalDays;
      if (typeof val !== 'number' || val < 1 || val > 90 || !Number.isInteger(val)) {
        return NextResponse.json(
          { success: false, error: 'fullBackupIntervalDays must be integer 1-90' },
          { status: 400 },
        );
      }
    }
    if ('scheduleCron' in sanitized && typeof sanitized.scheduleCron !== 'string') {
      return NextResponse.json(
        { success: false, error: 'scheduleCron must be string' },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();
    await db.doc(BACKUP_CONFIG_PATH).set(
      {
        ...sanitized,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.userId,
      },
      { merge: true },
    );

    logger.info(`Backup config updated by ${ctx.userId}: ${JSON.stringify(sanitized)}`);

    // Read back full config
    const scheduler = new BackupSchedulerService();
    const config = await scheduler.getConfig();

    return NextResponse.json({ success: true, config });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to update backup config: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
