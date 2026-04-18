/**
 * =============================================================================
 * MIGRATION: Backfill `code` on buildings (ADR-233 §3.4)
 * =============================================================================
 *
 * Assigns a locked sequential identifier ("Κτήριο Α", "Κτήριο Β", ...) to
 * every existing building that does not yet have a `code` field. The new
 * `code` powers unit-code generation (e.g. "A-DI-1.01") and replaces the
 * fragile regex-parsing of free-text `name`.
 *
 * Strategy (per project):
 *   1. Group all buildings by `projectId`.
 *   2. Within each project, sort by `createdAt` (ascending).
 *   3. If a building's existing `name` already matches the pattern
 *      "Κτήριο X" (Greek letter X), reserve letter X for that building.
 *   4. Fill the remaining buildings with the first available Greek letter.
 *
 * - GET  = dry-run (scan + report, zero writes)
 * - POST = execute (batch writes + audit log)
 *
 * @module api/admin/backfill-building-code
 * @see ADR-233 §3.4 — Entity Coding System (building code field)
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToMillis, nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  planProjectCodes,
  type BuildingRow,
  type ProjectBackfillResult,
  type BackfillReport,
} from './backfill-planner';

interface BuildingMeta {
  companyId: string | null;
  name: string;
  existingCode: string | null;
}

const logger = createModuleLogger('BackfillBuildingCode');

const BATCH_LIMIT = 450;
export const maxDuration = 60;

// =============================================================================
// CORE
// =============================================================================

async function handleMigration(
  ctx: AuthContext,
  dryRun: boolean,
  request?: NextRequest
): Promise<NextResponse> {
  const startTime = Date.now();

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted building code backfill', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only super_admin can execute this migration' },
      { status: 403 }
    );
  }

  try {
    const db = getAdminFirestore();
    logger.info(`Building code backfill ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`, { email: ctx.email });

    // Load ALL buildings (single collection scan — buildings are bounded).
    const snapshot = await db.collection(COLLECTIONS.BUILDINGS).get();
    const byProject = new Map<string, BuildingRow[]>();
    const buildingMeta = new Map<string, BuildingMeta>();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.status === 'deleted') continue;

      const projectId = (data.projectId as string) || '(no-project)';
      const name = (data.name as string) || '';
      const existingCode = (data.code as string) || null;
      const row: BuildingRow = {
        id: doc.id,
        projectId,
        name,
        existingCode,
        createdAtMs: normalizeToMillis(data.createdAt as string | Date | undefined),
      };

      buildingMeta.set(doc.id, {
        companyId: (data.companyId as string) ?? null,
        name,
        existingCode,
      });

      if (!byProject.has(projectId)) byProject.set(projectId, []);
      byProject.get(projectId)!.push(row);
    }

    // Plan all assignments per project
    const projects: ProjectBackfillResult[] = [];
    for (const [, buildings] of byProject) {
      projects.push(planProjectCodes(buildings));
    }

    // Execute (unless dry-run)
    const errors: string[] = [];
    const committedIds = new Set<string>();
    if (!dryRun) {
      let batch = db.batch();
      let ops = 0;
      let pendingIds: string[] = [];
      for (const project of projects) {
        for (const assignment of project.assignments) {
          batch.update(
            db.collection(COLLECTIONS.BUILDINGS).doc(assignment.id),
            { code: assignment.newCode, _codeBackfilledAt: FieldValue.serverTimestamp() }
          );
          pendingIds.push(assignment.id);
          ops++;
          if (ops >= BATCH_LIMIT) {
            try {
              await batch.commit();
              for (const id of pendingIds) committedIds.add(id);
            } catch (err) {
              errors.push(`Batch commit failed: ${getErrorMessage(err)}`);
            }
            batch = db.batch();
            ops = 0;
            pendingIds = [];
          }
        }
      }
      if (ops > 0) {
        try {
          await batch.commit();
          for (const id of pendingIds) committedIds.add(id);
        } catch (err) {
          errors.push(`Final batch commit failed: ${getErrorMessage(err)}`);
        }
      }

      // Audit trail — ADR-195 / CHECK 3.17. Fire per-building recordChange
      // AFTER all Firestore writes complete, scoped to committed ids only.
      // Tenant-gated: skip entries with missing companyId (legacy fixtures).
      for (const project of projects) {
        for (const assignment of project.assignments) {
          if (!committedIds.has(assignment.id)) continue;
          const meta = buildingMeta.get(assignment.id);
          if (!meta?.companyId) continue;
          try {
            await EntityAuditService.recordChange({
              entityType: ENTITY_TYPES.BUILDING,
              entityId: assignment.id,
              entityName: meta.name || null,
              action: 'updated',
              changes: [
                {
                  field: 'code',
                  oldValue: meta.existingCode,
                  newValue: assignment.newCode,
                  label: 'Κωδικός Κτηρίου',
                },
              ],
              performedBy: ctx.uid,
              performedByName: ctx.email ?? null,
              companyId: meta.companyId,
            });
          } catch (err) {
            errors.push(`Audit recordChange failed for ${assignment.id}: ${getErrorMessage(err)}`);
          }
        }
      }
    }

    const totalBuildings = projects.reduce((s, p) => s + p.totalBuildings, 0);
    const totalBackfilled = projects.reduce((s, p) => s + p.backfilled, 0);

    const report: BackfillReport = {
      dryRun,
      timestamp: nowISO(),
      durationMs: Date.now() - startTime,
      projectsScanned: projects.length,
      totalBuildings,
      totalBackfilled,
      projects,
      errors,
    };

    if (!dryRun && request) {
      try {
        const metadata = extractRequestMetadata(request);
        await logMigrationExecuted(ctx, 'backfill-building-code', {
          ...metadata,
          projectsScanned: projects.length,
          totalBuildings,
          totalBackfilled,
          errors: errors.length,
        });
      } catch {
        logger.warn('Audit logging failed (non-blocking)');
      }
    }

    logger.info(`Building code migration ${dryRun ? 'analysis' : 'execution'} complete`, {
      durationMs: report.durationMs,
      totalBuildings,
      totalBackfilled,
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Building code migration failed', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// =============================================================================
// ROUTES
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(
    withAuth(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
        handleMigration(ctx, true),
      { permissions: 'admin:migrations:execute' }
    )
  );
  return handler(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(
    withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
        handleMigration(ctx, false, req),
      { permissions: 'admin:migrations:execute' }
    )
  );
  return handler(request);
}
