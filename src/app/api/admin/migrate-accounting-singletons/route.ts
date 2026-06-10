/**
 * =============================================================================
 * MIGRATE ACCOUNTING SIBLING SINGLETONS — Global → Per-tenant (ADR-439 Phase 2c)
 * =============================================================================
 *
 * @purpose One-time migration that copies the legacy GLOBAL accounting singletons
 *          (`accounting_settings/{partners|members|shareholders|service_presets|
 *          matching_config}`) into their per-tenant composite documents
 *          (`accounting_settings/{companyId}__<type>`), stamping `companyId` on each.
 *
 * Phase 2c made the accounting repository read/write the per-tenant docs. This
 * endpoint backfills the existing tenant so those docs exist (and carry companyId,
 * which the gate-by-body-companyId Firestore rules require for client reads).
 *
 * @method GET  - Dry-run / preview (super_admin): per-singleton source/target status, zero writes
 * @method POST - Execute (super_admin): idempotent setDoc per singleton; globals left intact
 *
 * Idempotent: per singleton, if the target already exists it is skipped
 * (ALREADY_MIGRATED). The global docs are NEVER deleted (rollback safety; future cleanup
 * is a separate step).
 *
 * @see ADR-439 Tenant Identity SSoT & Provisioning — Phase 2c
 * @see N.6 — deterministic doc id (`accountingDocId`), `setDoc` not `addDoc`
 * @see /api/admin/migrate-accounting-profile — sibling endpoint (company profile)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { withAuth, logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { accountingDocId } from '@/subapps/accounting/services/repository/accounting-doc-ids';

const logger = createModuleLogger('MigrateAccountingSingletonsRoute');

/**
 * Every global accounting singleton, with its source collection + legacy doc id and the
 * per-tenant target doc id. The 5 `accounting_settings` siblings use the composite
 * `{companyId}__<type>` convention; EFKA config lives in its own collection with one config
 * per tenant → bare `{companyId}` doc id (mirrors company_profile).
 */
interface SingletonDescriptor {
  label: string;
  collection: string;
  legacyDocId: string;
  targetDocId: (companyId: string) => string;
}

const SINGLETONS: ReadonlyArray<SingletonDescriptor> = [
  { label: 'partners', collection: COLLECTIONS.ACCOUNTING_SETTINGS, legacyDocId: SYSTEM_DOCS.ACCT_PARTNERS, targetDocId: (c) => accountingDocId(c, 'partners') },
  { label: 'members', collection: COLLECTIONS.ACCOUNTING_SETTINGS, legacyDocId: SYSTEM_DOCS.ACCT_MEMBERS, targetDocId: (c) => accountingDocId(c, 'members') },
  { label: 'shareholders', collection: COLLECTIONS.ACCOUNTING_SETTINGS, legacyDocId: SYSTEM_DOCS.ACCT_SHAREHOLDERS, targetDocId: (c) => accountingDocId(c, 'shareholders') },
  { label: 'service_presets', collection: COLLECTIONS.ACCOUNTING_SETTINGS, legacyDocId: SYSTEM_DOCS.ACCT_SERVICE_PRESETS, targetDocId: (c) => accountingDocId(c, 'service_presets') },
  { label: 'matching_config', collection: COLLECTIONS.ACCOUNTING_SETTINGS, legacyDocId: SYSTEM_DOCS.ACCT_MATCHING_CONFIG, targetDocId: (c) => accountingDocId(c, 'matching_config') },
  { label: 'efka_user_config', collection: COLLECTIONS.ACCOUNTING_EFKA_CONFIG, legacyDocId: SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG, targetDocId: (c) => c },
];

type SingletonStatus = 'ALREADY_MIGRATED' | 'READY_TO_MIGRATE' | 'NO_SOURCE';

interface SingletonPreview {
  type: string;
  source: { docId: string; exists: boolean };
  target: { docId: string; exists: boolean; hasCompanyId: boolean };
  status: SingletonStatus;
}

function resolveStatus(sourceExists: boolean, targetExists: boolean): SingletonStatus {
  if (targetExists) return 'ALREADY_MIGRATED';
  return sourceExists ? 'READY_TO_MIGRATE' : 'NO_SOURCE';
}

// =============================================================================
// GET — Dry-run / preview (zero writes)
// =============================================================================

export const GET = withAuth(
  async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    if (ctx.globalRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: super_admin required', code: 'SUPER_ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    try {
      const companyId = LEGACY_TENANT_COMPANY_ID;
      const db = getAdminFirestore();

      const previews: SingletonPreview[] = await Promise.all(
        SINGLETONS.map(async (entry) => {
          const col = db.collection(entry.collection);
          const targetDocId = entry.targetDocId(companyId);
          const [sourceSnap, targetSnap] = await Promise.all([
            col.doc(entry.legacyDocId).get(),
            col.doc(targetDocId).get(),
          ]);
          const targetData = targetSnap.data() as Record<string, unknown> | undefined;
          return {
            type: entry.label,
            source: { docId: entry.legacyDocId, exists: sourceSnap.exists },
            target: {
              docId: targetDocId,
              exists: targetSnap.exists,
              hasCompanyId: typeof targetData?.companyId === 'string',
            },
            status: resolveStatus(sourceSnap.exists, targetSnap.exists),
          };
        })
      );

      const willMigrate = previews.filter((p) => p.status === 'READY_TO_MIGRATE').length;

      return NextResponse.json({
        success: true,
        dryRun: true,
        companyId,
        singletons: previews,
        willMigrate,
        message:
          willMigrate > 0
            ? `POST will copy ${willMigrate} global singleton(s) → per-tenant for ${companyId}.`
            : 'Nothing to migrate — all singletons already per-tenant or no source.',
      });
    } catch (error) {
      logger.error('[MigrateAccountingSingletons] GET (dry-run) failed', { error: getErrorMessage(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to preview migration' },
        { status: 500 }
      );
    }
  },
  { permissions: 'admin:direct:operations' }
);

// =============================================================================
// POST — Execute migration (idempotent)
// =============================================================================

export const POST = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required', code: 'SUPER_ADMIN_REQUIRED' },
          { status: 403 }
        );
      }

      try {
        const companyId = LEGACY_TENANT_COMPANY_ID;
        const db = getAdminFirestore();

        const results = await Promise.all(
          SINGLETONS.map(async (entry) => {
            const col = db.collection(entry.collection);
            const targetRef = col.doc(entry.targetDocId(companyId));

            // Idempotency — target already present → skip.
            const targetSnap = await targetRef.get();
            if (targetSnap.exists) return { type: entry.label, action: 'ALREADY_MIGRATED' as const };

            // Read the legacy global source.
            const sourceSnap = await col.doc(entry.legacyDocId).get();
            if (!sourceSnap.exists) return { type: entry.label, action: 'NO_SOURCE' as const };

            // Write per-tenant doc (N.6: deterministic id, set() not add()).
            // Stamp companyId so gate-by-body-companyId rules pass; global left intact.
            const sourceData = sourceSnap.data() as Record<string, unknown>;
            await targetRef.set({ ...sourceData, companyId, updatedAt: nowISO() });
            return { type: entry.label, action: 'MIGRATED' as const };
          })
        );

        const migrated = results.filter((r) => r.action === 'MIGRATED').map((r) => r.type);

        // Audit (non-blocking).
        const metadata = extractRequestMetadata(req);
        await logSystemOperation(
          ctx,
          'migrate_accounting_singletons',
          { companyId, migrated, action: 'global_to_per_tenant' },
          `Accounting singletons migrated to per-tenant by ${ctx.email}`
        ).catch((err: unknown) => {
          logger.error('[MigrateAccountingSingletons] Audit log failed (non-blocking)', {
            error: getErrorMessage(err),
            metadata,
          });
        });

        logger.info('[MigrateAccountingSingletons] Migration completed', { companyId, migrated });

        return NextResponse.json({
          success: true,
          companyId,
          results,
          migratedCount: migrated.length,
          message:
            migrated.length > 0
              ? `Migrated ${migrated.length} singleton(s): ${migrated.join(', ')}.`
              : 'No action needed — all singletons already per-tenant or no source.',
        });
      } catch (error) {
        logger.error('[MigrateAccountingSingletons] POST failed', { error: getErrorMessage(error) });
        return NextResponse.json(
          { success: false, error: `Migration failed: ${getErrorMessage(error)}` },
          { status: 500 }
        );
      }
    },
    { permissions: 'admin:direct:operations' }
  )
);
