/**
 * =============================================================================
 * MIGRATE UNITS → PROPERTIES COLLECTION (ADR-269)
 * =============================================================================
 *
 * @purpose Copies all documents from Firestore `units` to `properties` collection
 *          with new `prop_` prefix IDs. Then deletes the old `units` documents.
 * @author Enterprise Architecture Team
 * @date 2026-04-01
 *
 * @method GET  - Preview: shows what will be migrated (dry run)
 * @method POST - Execute: copy → verify → delete old
 *
 * @security withAuth + super_admin + audit logging
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { generatePropertyId } from '@/services/enterprise-id.service';
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('MigrateUnitsToProperties');

const SOURCE_COLLECTION = 'units';
const TARGET_COLLECTION = 'properties';

interface MigrationRecord {
  oldId: string;
  newId: string;
  name: string;
}

/**
 * GET - Preview migration (dry run)
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    if (ctx.globalRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'super_admin required' },
        { status: 403 }
      );
    }

    try {
      const db = getAdminFirestore();

      const [sourceSnap, targetSnap] = await Promise.all([
        db.collection(SOURCE_COLLECTION).get(),
        db.collection(TARGET_COLLECTION).get(),
      ]);

      const sourcePreview = sourceSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name ?? 'UNNAMED',
        type: doc.data().type ?? 'unknown',
        buildingId: doc.data().buildingId ?? null,
      }));

      return NextResponse.json({
        success: true,
        mode: 'preview',
        source: {
          collection: SOURCE_COLLECTION,
          count: sourceSnap.size,
          documents: sourcePreview,
        },
        target: {
          collection: TARGET_COLLECTION,
          existingCount: targetSnap.size,
        },
        plan: `Will copy ${sourceSnap.size} docs from '${SOURCE_COLLECTION}' → '${TARGET_COLLECTION}' with new prop_ IDs, then delete originals.`,
      });
    } catch (error: unknown) {
      logger.error('Preview failed', { error });
      return NextResponse.json(
        { success: false, error: getErrorMessage(error) },
        { status: 500 }
      );
    }
  },
  { permissions: 'admin:data:fix' }
));

/**
 * POST - Execute migration
 *
 * Steps:
 * 1. Read all docs from `units`
 * 2. For each: create in `properties` with new prop_ ID (batch write)
 * 3. Verify target count matches
 * 4. Delete source docs (batch delete)
 * 5. Audit log
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    if (ctx.globalRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'super_admin required' },
        { status: 403 }
      );
    }

    const startTime = Date.now();

    try {
      const db = getAdminFirestore();

      // Step 1: Read all source documents
      const sourceSnap = await db.collection(SOURCE_COLLECTION).get();

      if (sourceSnap.empty) {
        return NextResponse.json({
          success: true,
          message: `No documents in '${SOURCE_COLLECTION}' — nothing to migrate.`,
        });
      }

      logger.info('Starting units→properties migration', {
        sourceCount: sourceSnap.size,
      });

      // Step 2: Batch-create in target collection
      const migrated: MigrationRecord[] = [];
      const writeBatch = db.batch();

      for (const doc of sourceSnap.docs) {
        const data = doc.data();
        const newId = generatePropertyId();
        const targetRef = db.collection(TARGET_COLLECTION).doc(newId);

        writeBatch.set(targetRef, {
          ...data,
          _migratedFrom: doc.id,
          _migratedAt: nowISO(),
        });

        migrated.push({
          oldId: doc.id,
          newId,
          name: (data.name as string) ?? 'UNNAMED',
        });
      }

      await writeBatch.commit();
      logger.info('Created target documents', { count: migrated.length });

      // Step 3: Verify
      const verifySnap = await db.collection(TARGET_COLLECTION).get();

      if (verifySnap.size < migrated.length) {
        logger.error('Verification failed — aborting delete', {
          expected: migrated.length,
          actual: verifySnap.size,
        });
        return NextResponse.json({
          success: false,
          error: 'Verification failed — target has fewer docs than expected. Source NOT deleted.',
          expected: migrated.length,
          actual: verifySnap.size,
        }, { status: 500 });
      }

      // Step 4: Delete source docs
      const deleteBatch = db.batch();
      for (const doc of sourceSnap.docs) {
        deleteBatch.delete(doc.ref);
      }
      await deleteBatch.commit();
      logger.info('Deleted source documents', { count: sourceSnap.size });

      const duration = Date.now() - startTime;

      // Step 5: Audit log
      const metadata = extractRequestMetadata(req);
      await logDataFix(
        ctx,
        'migrate_units_to_properties_collection',
        {
          operation: 'units-to-properties',
          sourceCollection: SOURCE_COLLECTION,
          targetCollection: TARGET_COLLECTION,
          migratedCount: migrated.length,
          deletedCount: sourceSnap.size,
          mapping: migrated,
          executionTimeMs: duration,
          metadata,
        },
        `Collection migration units→properties by ${ctx.email}`
      ).catch((err: unknown) => {
        logger.warn('Audit log failed (non-blocking)', { error: err });
      });

      return NextResponse.json({
        success: true,
        message: `Migration complete! ${migrated.length} documents: units → properties`,
        migrated,
        duration: `${duration}ms`,
      });
    } catch (error: unknown) {
      logger.error('Migration failed', { error });
      return NextResponse.json(
        { success: false, error: getErrorMessage(error) },
        { status: 500 }
      );
    }
  },
  { permissions: 'admin:data:fix' }
));
