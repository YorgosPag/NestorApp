/**
 * =============================================================================
 * MIGRATE: Add companyId field to navigation_companies documents
 * =============================================================================
 *
 * One-time migration to support tenant-scoped Firestore rules (ADR-252 Phase 3).
 * Sets companyId = contactId for each navigation_companies document.
 *
 * @method GET  - Dry-run: shows what WOULD change
 * @method POST - Execute: adds companyId field to all documents missing it
 *
 * @security withAuth + super_admin only
 * @since 2026-03-20
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('MigrateNavCompanyId');

interface MigrationResult {
  totalDocuments: number;
  alreadyHaveCompanyId: number;
  needsMigration: number;
  updated: number;
  errors: string[];
}

async function runMigration(dryRun: boolean): Promise<MigrationResult> {
  const db = getAdminFirestore();
  const result: MigrationResult = {
    totalDocuments: 0,
    alreadyHaveCompanyId: 0,
    needsMigration: 0,
    updated: 0,
    errors: [],
  };

  const snapshot = await db.collection(COLLECTIONS.NAVIGATION).get();
  result.totalDocuments = snapshot.size;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.companyId) {
      result.alreadyHaveCompanyId++;
      continue;
    }

    result.needsMigration++;

    if (!dryRun) {
      // companyId = contactId (the company's contact document IS their companyId)
      batch.update(doc.ref, { companyId: data.contactId ?? null });
      batchCount++;
    }
  }

  if (!dryRun && batchCount > 0) {
    try {
      await batch.commit();
      result.updated = batchCount;
      logger.info('[MigrateNavCompanyId] Migration complete', {
        updated: batchCount,
        total: result.totalDocuments,
      });
    } catch (error) {
      result.errors.push(getErrorMessage(error, 'Batch commit failed'));
      logger.error('[MigrateNavCompanyId] Migration failed', { error: getErrorMessage(error) });
    }
  }

  return result;
}

// =============================================================================
// GET — Dry Run
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required' },
          { status: 403 }
        );
      }

      logger.info('[MigrateNavCompanyId] DRY RUN', { callerEmail: ctx.email });
      const result = await runMigration(true);

      return NextResponse.json({
        success: true,
        message: `DRY RUN: ${result.needsMigration}/${result.totalDocuments} documents need companyId field`,
        dryRun: true,
        result,
      });
    },
    { permissions: 'admin_access' }
  )
);

// =============================================================================
// POST — Execute Migration
// =============================================================================

export const POST = withSensitiveRateLimit(
  withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required' },
          { status: 403 }
        );
      }

      logger.info('[MigrateNavCompanyId] EXECUTE', { callerEmail: ctx.email });
      const result = await runMigration(false);

      return NextResponse.json({
        success: result.errors.length === 0,
        message: result.errors.length === 0
          ? `Migration complete: ${result.updated} documents updated`
          : `Migration completed with errors`,
        dryRun: false,
        result,
      });
    },
    { permissions: 'admin_access' }
  )
);
