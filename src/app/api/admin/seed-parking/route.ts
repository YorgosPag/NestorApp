/**
 * =============================================================================
 * SEED PARKING SPOTS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { TARGET_BUILDING, PARKING_TEMPLATES } from './parking-seed-config';
import {
  buildParkingPreviewRecords,
  createSeedParkingSpots,
  deleteAllParkingSpots,
  listExistingParkingSpots,
  validateParkingForeignKeys,
} from './parking-seed-operations';

const logger = createModuleLogger('SeedParkingRoute');
const ADMIN_PERMISSION = 'admin:migrations:execute';

export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingPreview(req, ctx);
  },
  { permissions: ADMIN_PERMISSION }
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingExecute(req, ctx);
  },
  { permissions: ADMIN_PERMISSION }
));

export const DELETE = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingDelete(req, ctx);
  },
  { permissions: ADMIN_PERMISSION }
));

export const PATCH = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleForeignKeyValidation(req, ctx);
  },
  { permissions: ADMIN_PERMISSION }
));

function requireSuperAdmin(
  ctx: AuthContext,
  actionDescription: string,
  restrictedMessage: string,
): NextResponse | null {
  if (ctx.globalRole === 'super_admin') {
    return null;
  }

  logger.warn('BLOCKED: Non-super_admin attempted action', {
    actionDescription,
    email: ctx.email,
    globalRole: ctx.globalRole,
  });

  return NextResponse.json(
    {
      success: false,
      error: 'Forbidden: Only super_admin can ' + actionDescription,
      message: restrictedMessage,
    },
    { status: 403 },
  );
}

async function auditMigration(
  request: NextRequest,
  ctx: AuthContext,
  action: string,
  payload: Record<string, unknown>,
  description: string,
): Promise<void> {
  const metadata = extractRequestMetadata(request);

  await logMigrationExecuted(
    ctx,
    action,
    {
      ...payload,
      metadata,
    },
    description,
  ).catch((error: unknown) => {
    logger.warn('Audit logging failed (non-blocking)', { error });
  });
}

function buildErrorResponse(error: unknown, fallbackMessage: string, status = 500): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
      details: getErrorMessage(error),
    },
    { status },
  );
}

async function handleSeedParkingPreview(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  const forbidden = requireSuperAdmin(
    ctx,
    'preview parking seeding',
    'Parking seeding is a system-level operation restricted to super_admin',
  );
  if (forbidden) {
    return forbidden;
  }

  logger.info('Seed parking preview request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
    companyId: ctx.companyId,
  });

  try {
    const existingSpots = await listExistingParkingSpots();
    const previewSpots = buildParkingPreviewRecords();

    logger.info('Preview', {
      existingSpots: existingSpots.length,
      toCreate: PARKING_TEMPLATES.length,
    });

    return NextResponse.json({
      success: true,
      preview: true,
      message: 'Προεπισκόπηση seeding - δεν έγιναν αλλαγές',
      existing: {
        count: existingSpots.length,
        spots: existingSpots,
        willBeDeleted: true,
      },
      toCreate: {
        count: PARKING_TEMPLATES.length,
        targetBuilding: TARGET_BUILDING,
        spots: previewSpots,
      },
      instructions: [
        'POST /api/admin/seed-parking → Για να εκτελεστεί το seeding',
        'DELETE /api/admin/seed-parking → Για να διαγραφούν όλα τα parking spots',
      ],
    });
  } catch (error) {
    logger.error('Error in seed-parking preview', { error });
    return buildErrorResponse(error, 'Failed to preview parking spots');
  }
}

async function handleSeedParkingExecute(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  const startTime = Date.now();
  const forbidden = requireSuperAdmin(
    ctx,
    'execute parking seeding',
    'Mass deletion and creation are system-level operations restricted to super_admin',
  );
  if (forbidden) {
    return forbidden;
  }

  logger.info('Seed parking execute request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
    companyId: ctx.companyId,
  });

  try {
    logger.info('Deleting existing parking spots...');
    const deletedIds = await deleteAllParkingSpots(true);
    logger.info('Deleted parking spots', { count: deletedIds.length });

    logger.info('Creating new parking spots with enterprise IDs...');
    const createdSpots = await createSeedParkingSpots();
    logger.info('Created parking spots', { count: createdSpots.length });

    const duration = Date.now() - startTime;

    await auditMigration(
      request,
      ctx,
      'seed_parking_spots',
      {
        operation: 'seed-parking',
        deletedCount: deletedIds.length,
        createdCount: createdSpots.length,
        targetBuilding: TARGET_BUILDING,
        deletedIds,
        createdSpots,
        executionTimeMs: duration,
        result: 'success',
      },
      'Parking spots seeding by ' + ctx.globalRole + ' ' + ctx.email,
    );

    return NextResponse.json({
      success: true,
      message: 'Seeding ολοκληρώθηκε! Διαγράφηκαν ' + deletedIds.length + ', δημιουργήθηκαν ' + createdSpots.length + ' parking spots',
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      created: {
        count: createdSpots.length,
        targetBuilding: TARGET_BUILDING,
        spots: createdSpots,
      },
      executionTimeMs: duration,
    });
  } catch (error) {
    logger.error('Error in seed-parking execute', { error });
    return buildErrorResponse(error, 'Failed to seed parking spots');
  }
}

async function handleSeedParkingDelete(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  const startTime = Date.now();
  const forbidden = requireSuperAdmin(
    ctx,
    'delete all parking spots',
    'Mass deletion is a system-level operation restricted to super_admin',
  );
  if (forbidden) {
    return forbidden;
  }

  logger.info('Seed parking delete request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
    companyId: ctx.companyId,
  });

  try {
    const deletedIds = await deleteAllParkingSpots();
    const duration = Date.now() - startTime;

    logger.info('Deleted all parking spots', { count: deletedIds.length });

    await auditMigration(
      request,
      ctx,
      'delete_all_parking_spots',
      {
        operation: 'delete-parking',
        deletedCount: deletedIds.length,
        deletedIds,
        executionTimeMs: duration,
        result: 'success',
      },
      'Mass deletion of all parking spots by ' + ctx.globalRole + ' ' + ctx.email,
    );

    return NextResponse.json({
      success: true,
      message: 'Διαγράφηκαν ' + deletedIds.length + ' parking spots',
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      executionTimeMs: duration,
    });
  } catch (error) {
    logger.error('Error in seed-parking delete', { error });
    return buildErrorResponse(error, 'Failed to delete parking spots');
  }
}

async function handleForeignKeyValidation(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  const startTime = Date.now();
  const migrationId = 'fk_validation_' + Date.now();
  const forbidden = requireSuperAdmin(
    ctx,
    'validate parking FK',
    'Foreign key validation is a system-level operation restricted to super_admin',
  );
  if (forbidden) {
    return forbidden;
  }

  logger.info('Parking FK validation request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
  });

  try {
    const body = await request.json() as { dryRun?: boolean };
    const { dryRun = true } = body;

    logger.info('PARKING FOREIGN KEY VALIDATION (NO-OP Mode)', {
      migrationId,
      mode: dryRun ? 'DRY-RUN' : 'EXECUTE',
      purpose: 'Validate non-prefixed IDs',
    });

    const stats = await validateParkingForeignKeys();
    const duration = Date.now() - startTime;

    logger.info('VALIDATION SUMMARY', {
      migrationId,
      total: stats.total,
      correct: stats.alreadyCorrect,
      errors: stats.errors,
      skipped: stats.skipped,
      durationMs: duration,
      migration: 'NO-OP',
    });

    await auditMigration(
      request,
      ctx,
      'parking_fk_validation',
      {
        migrationId,
        operation: 'validation-only',
        pattern: 'no-op',
        stats: {
          total: stats.total,
          migrated: 0,
          alreadyCorrect: stats.alreadyCorrect,
          errors: stats.errors,
        },
        executionTimeMs: duration,
        result: stats.errors === 0 ? 'success' : 'has_errors',
        note: 'Migration disabled - prefixed IDs break tenant resolution',
      },
      'Parking FK validation by ' + ctx.globalRole + ' ' + ctx.email,
    );

    return NextResponse.json({
      success: true,
      mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
      migrationId,
      message: stats.errors > 0
        ? '⚠️ Found ' + stats.errors + ' parking spots with PREFIXED IDs (breaks tenant resolution). Run Re-seed to fix.'
        : '✅ All ' + stats.alreadyCorrect + ' parking spots have correct non-prefixed IDs.',
      stats: {
        total: stats.total,
        migrated: 0,
        alreadyCorrect: stats.alreadyCorrect,
        errors: stats.errors,
      },
      details: stats.details,
      rollback: {
        available: false,
        note: 'No migration performed - this is a validation-only endpoint',
      },
      executionTimeMs: duration,
      notice: '⚠️ This endpoint is now a NO-OP. Prefixed IDs break tenant resolution. Use Re-seed instead.',
    });
  } catch (error) {
    logger.error('Error in seed-parking FK validation', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate FK',
        details: getErrorMessage(error),
        migrationId,
      },
      { status: 500 },
    );
  }
}
