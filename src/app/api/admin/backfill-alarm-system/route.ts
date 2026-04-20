/**
 * =============================================================================
 * MIGRATION: backfill alarm-system → alarm
 * =============================================================================
 *
 * Removes 'alarm-system' from interiorFeatures and ensures 'alarm' exists in
 * securityFeatures for every property that had the duplicate entry.
 *
 * Background: alarm-system was incorrectly placed in InteriorFeatureCode.
 * The canonical location is SecurityFeatureCode.ALARM ('alarm').
 *
 * - GET  = dry-run (scan + report, zero writes)
 * - POST = execute (batch writes)
 *
 * @module api/admin/backfill-alarm-system
 * @enterprise ADR-287 Batch 24 cleanup
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';

const logger = createModuleLogger('BackfillAlarmSystem');

const BATCH_LIMIT = 450;

interface MigrationReport {
  dryRun: boolean;
  timestamp: string;
  durationMs: number;
  scanned: number;
  migrated: number;
  alreadyHadAlarm: number;
  errors: string[];
}

export const maxDuration = 60;

// =============================================================================
// GET — Dry-run
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigration(ctx, true);
    },
    { permissions: 'admin:migrations:execute' }
  ));
  return handler(request);
}

// =============================================================================
// POST — Execute
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigration(ctx, false);
    },
    { permissions: 'admin:migrations:execute' }
  ));
  return handler(request);
}

// =============================================================================
// CORE
// =============================================================================

async function handleMigration(
  ctx: AuthContext,
  dryRun: boolean,
): Promise<NextResponse> {
  const start = Date.now();
  const report: MigrationReport = {
    dryRun,
    timestamp: nowISO(),
    durationMs: 0,
    scanned: 0,
    migrated: 0,
    alreadyHadAlarm: 0,
    errors: [],
  };

  logger.info(`[BackfillAlarmSystem] Starting — dryRun=${dryRun}`, { userId: ctx.uid });

  try {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(COLLECTIONS.PROPERTIES)
      .where('interiorFeatures', 'array-contains', 'alarm-system')
      .get();

    report.scanned = snapshot.size;
    logger.info(`[BackfillAlarmSystem] Found ${snapshot.size} properties to migrate`);

    if (!dryRun && snapshot.size > 0) {
      let batch = db.batch();
      let batchCount = 0;
      const auditQueue: Array<{ id: string; companyId: string; name: string | null }> = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const securityFeatures: string[] = Array.isArray(data.securityFeatures)
          ? data.securityFeatures
          : [];

        if (securityFeatures.includes('alarm')) {
          report.alreadyHadAlarm++;
        }

        batch.update(doc.ref, {
          interiorFeatures: FieldValue.arrayRemove('alarm-system'),
          securityFeatures: FieldValue.arrayUnion('alarm'),
        });

        batchCount++;
        report.migrated++;

        if (data.companyId) {
          auditQueue.push({ id: doc.id, companyId: data.companyId as string, name: (data.name as string) ?? null });
        }

        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // Audit trail — ADR-195 / CHECK 3.17
      for (const entry of auditQueue) {
        try {
          await EntityAuditService.recordChange({
            entityType: ENTITY_TYPES.PROPERTY,
            entityId: entry.id,
            entityName: entry.name,
            action: 'update',
            changes: [
              { field: 'interiorFeatures', oldValue: 'alarm-system', newValue: null, kind: 'collection', op: 'removed', itemKey: 'alarm-system', itemLabel: 'Συναγερμός (εσωτερικά)' },
              { field: 'securityFeatures', oldValue: null, newValue: 'alarm', kind: 'collection', op: 'added', itemKey: 'alarm', itemLabel: 'Συναγερμός (ασφάλεια)' },
            ],
            performedBy: ctx.uid,
            performedByName: ctx.email ?? null,
            companyId: entry.companyId,
          });
        } catch (err) {
          report.errors.push(`Audit recordChange failed for ${entry.id}: ${getErrorMessage(err)}`);
        }
      }
    } else if (dryRun) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const securityFeatures: string[] = Array.isArray(data.securityFeatures)
          ? data.securityFeatures
          : [];
        if (securityFeatures.includes('alarm')) {
          report.alreadyHadAlarm++;
        }
        report.migrated++;
      }
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    logger.error('[BackfillAlarmSystem] Error', { error: msg });
    report.errors.push(msg);
  }

  report.durationMs = Date.now() - start;
  logger.info('[BackfillAlarmSystem] Done', report);

  return NextResponse.json(report, { status: report.errors.length > 0 ? 500 : 200 });
}
