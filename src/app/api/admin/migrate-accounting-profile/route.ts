/**
 * =============================================================================
 * MIGRATE ACCOUNTING PROFILE — Global singleton → Per-tenant (ADR-439 Phase 2)
 * =============================================================================
 *
 * @purpose One-time migration that copies the legacy GLOBAL company profile
 *          (`accounting_settings/company_profile`) into the per-tenant document
 *          (`accounting_settings/{companyId}`), the legal-identity SSoT.
 *
 * Phase 2 made the accounting repository read/write the per-tenant doc. This
 * endpoint backfills the existing tenant so the per-tenant doc exists before the
 * transitional global fallback (`company-legal-identity.ts`) is removed.
 *
 * @method GET  - Dry-run / preview (super_admin): reports what WOULD happen, zero writes
 * @method POST - Execute (super_admin): idempotent setDoc; leaves the global doc intact
 *
 * Idempotent: re-running POST after a successful migration is a no-op
 * (`ALREADY_MIGRATED`). The global doc is NEVER deleted (rollback safety).
 *
 * @see ADR-439 Tenant Identity SSoT & Provisioning
 * @see N.6 — doc id = companyId (enterprise id), `setDoc` not `addDoc`
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

const logger = createModuleLogger('MigrateAccountingProfileRoute');

/** Shape of the relevant fields we surface in previews (the doc itself is opaque). */
function summarize(data: Record<string, unknown> | undefined): {
  exists: boolean;
  businessName: string | null;
  hasCompanyId: boolean;
} {
  if (!data) return { exists: false, businessName: null, hasCompanyId: false };
  const businessName = typeof data.businessName === 'string' ? data.businessName : null;
  return { exists: true, businessName, hasCompanyId: typeof data.companyId === 'string' };
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
      const settings = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS);

      const [globalSnap, perTenantSnap] = await Promise.all([
        settings.doc(SYSTEM_DOCS.ACCT_COMPANY_PROFILE).get(),
        settings.doc(companyId).get(),
      ]);

      const global = summarize(globalSnap.data() as Record<string, unknown> | undefined);
      const perTenant = summarize(perTenantSnap.data() as Record<string, unknown> | undefined);

      const willMigrate = global.exists && !perTenant.exists;
      const status = perTenant.exists
        ? 'ALREADY_MIGRATED'
        : global.exists
          ? 'READY_TO_MIGRATE'
          : 'NO_SOURCE';

      return NextResponse.json({
        success: true,
        dryRun: true,
        companyId,
        source: { docId: SYSTEM_DOCS.ACCT_COMPANY_PROFILE, ...global },
        target: { docId: companyId, ...perTenant },
        willMigrate,
        status,
        message: willMigrate
          ? `POST will copy accounting_settings/${SYSTEM_DOCS.ACCT_COMPANY_PROFILE} → accounting_settings/${companyId}.`
          : status === 'ALREADY_MIGRATED'
            ? 'Per-tenant profile already exists — POST would be a no-op.'
            : 'No global source profile found — nothing to migrate.',
      });
    } catch (error) {
      logger.error('[MigrateAccountingProfile] GET (dry-run) failed', { error: getErrorMessage(error) });
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
        const settings = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS);

        // Step 1: Idempotency — per-tenant doc already present → no-op.
        const perTenantRef = settings.doc(companyId);
        const perTenantSnap = await perTenantRef.get();
        if (perTenantSnap.exists) {
          return NextResponse.json({
            success: true,
            action: 'ALREADY_MIGRATED',
            companyId,
            message: 'Per-tenant accounting profile already exists — no action needed.',
          });
        }

        // Step 2: Read the legacy global source.
        const globalSnap = await settings.doc(SYSTEM_DOCS.ACCT_COMPANY_PROFILE).get();
        if (!globalSnap.exists) {
          return NextResponse.json(
            {
              success: false,
              action: 'NO_SOURCE',
              companyId,
              error: `No global profile at accounting_settings/${SYSTEM_DOCS.ACCT_COMPANY_PROFILE} to migrate.`,
            },
            { status: 404 }
          );
        }
        const globalData = globalSnap.data() as Record<string, unknown>;

        // Step 3: Write per-tenant doc (N.6: doc id = companyId, set() not add()).
        // Stamp companyId so Firestore rules (gate-by-body-companyId) pass for client reads.
        // Global doc is left intact for rollback safety (future cleanup is separate).
        await perTenantRef.set({
          ...globalData,
          companyId,
          updatedAt: nowISO(),
        });

        const businessName = typeof globalData.businessName === 'string' ? globalData.businessName : null;

        // Step 4: Audit (non-blocking).
        const metadata = extractRequestMetadata(req);
        await logSystemOperation(
          ctx,
          'migrate_accounting_profile',
          { companyId, businessName, action: 'global_to_per_tenant' },
          `Accounting profile migrated to per-tenant by ${ctx.email}`
        ).catch((err: unknown) => {
          logger.error('[MigrateAccountingProfile] Audit log failed (non-blocking)', {
            error: getErrorMessage(err),
            metadata,
          });
        });

        logger.info('[MigrateAccountingProfile] Migration completed', { companyId, businessName });

        return NextResponse.json({
          success: true,
          action: 'MIGRATED',
          companyId,
          businessName,
          message: `Accounting profile copied to accounting_settings/${companyId}.`,
        });
      } catch (error) {
        logger.error('[MigrateAccountingProfile] POST failed', { error: getErrorMessage(error) });
        return NextResponse.json(
          { success: false, error: `Migration failed: ${getErrorMessage(error)}` },
          { status: 500 }
        );
      }
    },
    { permissions: 'admin:direct:operations' }
  )
);
