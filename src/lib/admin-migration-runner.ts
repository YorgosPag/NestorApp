/**
 * =============================================================================
 * ADMIN MIGRATION RUNNER — thin HTTP/auth envelope (ADR-704)
 * =============================================================================
 *
 * The shared skeleton every admin backfill/migration route repeats:
 *   - bypass-role guard (ADR-703) → 403 for non-super_admin
 *   - obtain Admin Firestore, run the route-specific logic
 *   - audit-log on execute (POST only), non-blocking
 *   - try/catch → 500 with a normalised error body
 *
 * Routes keep ONLY their own logic (which collection, which field, how the
 * value is derived) and pass it as the `run` callback. Falling under the
 * N.7.1 300-line limit is a side effect, not the goal.
 *
 * Companion pure-data primitives live in `admin-batch-utils.ts` (ADR-214/704):
 * `buildLookupCache`, `flushInBatches`, `processAdminBatch`.
 *
 * @module lib/admin-migration-runner
 * @see ADR-704 — Admin Migration-Runner SSoT
 * @see ADR-703 — bypass-role guard (isRoleBypass)
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';
import { withAuth } from '@/lib/auth/middleware';
import { isRoleBypass } from '@/lib/auth/roles';
import { extractRequestMetadata } from '@/lib/auth/audit-core';
import { logMigrationExecuted } from '@/lib/auth/audit-convenience';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('AdminMigrationRunner');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationEnvelope {
  /** Authenticated caller context (from withAuth). */
  ctx: AuthContext;
  /** true = GET dry-run (no writes, no audit); false = POST execute. */
  dryRun: boolean;
  /** Audit action name, e.g. 'backfill-file-companyid'. */
  name: string;
  /** Present on POST (execute) — supplies audit request metadata. */
  request?: NextRequest;
}

export interface MigrationOutcome {
  /** Response payload merged under `{ success: true, ... }`. */
  body: Record<string, unknown>;
  /** Extra fields merged into the audit log (execute only). */
  audit?: Record<string, unknown>;
}

/** Route-specific migration logic. `dryRun` is decided by the HTTP verb. */
export type MigrationRun = (
  db: Firestore,
  opts: { dryRun: boolean },
) => Promise<MigrationOutcome>;

export interface MigrationDefinition {
  /** Audit action name, e.g. 'backfill-file-companyid'. */
  name: string;
  /** RBAC permission (default 'admin:migrations:execute'). */
  permissions?: string;
  /** The actual migration — receives Admin Firestore + dry-run flag. */
  run: MigrationRun;
}

export interface MigrationRouteHandlers {
  GET: (request: NextRequest) => Promise<Response>;
  POST: (request: NextRequest) => Promise<Response>;
}

// ---------------------------------------------------------------------------
// Route factory — GET (dry-run) + POST (execute) behind the shared envelope
// ---------------------------------------------------------------------------

/**
 * Build the GET/POST handlers every admin migration route repeats:
 * `withSensitiveRateLimit(withAuth(...))` → guard → run → audit → error, with
 * GET = dry-run and POST = execute. Each route supplies ONLY its `name` + `run`.
 *
 * `run` is a function (behavior), not a config template — no option-bag that
 * re-implements control flow (avoids the ADR-698/699 over-parameterised trap).
 */
export function createMigrationRoute(def: MigrationDefinition): MigrationRouteHandlers {
  const permissions = def.permissions ?? 'admin:migrations:execute';

  const invoke = (
    ctx: AuthContext,
    dryRun: boolean,
    request?: NextRequest,
  ): Promise<NextResponse> =>
    runMigration({ ctx, dryRun, name: def.name, request }, (db) => def.run(db, { dryRun }));

  const GET = (request: NextRequest): Promise<Response> =>
    withSensitiveRateLimit(withAuth(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
        invoke(ctx, true),
      { permissions },
    ))(request);

  const POST = (request: NextRequest): Promise<Response> =>
    withSensitiveRateLimit(withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
        invoke(ctx, false, req),
      { permissions },
    ))(request);

  return { GET, POST };
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Run an admin migration/backfill behind the shared guard + audit + error
 * envelope. The `run` callback receives the Admin Firestore instance and
 * returns the response body (+ optional audit fields).
 */
export async function runMigration(
  { ctx, dryRun, name, request }: MigrationEnvelope,
  run: (db: Firestore) => Promise<MigrationOutcome>,
): Promise<NextResponse> {
  // 🔐 Bypass roles ONLY (ADR-703)
  if (!isRoleBypass(ctx.globalRole)) {
    logger.warn('BLOCKED: non-bypass role attempted admin migration', {
      migration: name,
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only super_admin can execute this migration' },
      { status: 403 },
    );
  }

  logger.info(`Migration ${name} ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`, { email: ctx.email });

  try {
    const db = getAdminFirestore();
    const outcome = await run(db);

    // Audit-log on execute only — non-blocking (failure must not fail the run).
    if (!dryRun && request) {
      try {
        const metadata = extractRequestMetadata(request);
        await logMigrationExecuted(ctx, name, { ...metadata, ...(outcome.audit ?? {}) });
      } catch {
        logger.warn('Audit logging failed (non-blocking)', { migration: name });
      }
    }

    return NextResponse.json({ success: true, ...outcome.body });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Migration failed', { migration: name, error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
