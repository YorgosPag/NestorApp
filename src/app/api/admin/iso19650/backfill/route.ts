/**
 * =============================================================================
 * ADMIN: ISO 19650 Metadata Backfill (ADR-373 P2.3)
 * =============================================================================
 *
 * Runs the iso19650-enricher AI classifier on existing files that have no
 * disciplineCode yet (pre-Phase-1 files or files skipped during enrichment).
 *
 * - GET  ?companyId=xxx  → dry-run: count files needing enrichment (no writes)
 * - POST body { companyId, limit? } → process up to `limit` files (default 5)
 *
 * Caller loops until response.hasMore === false:
 *   while (result.hasMore) { result = await POST({ companyId, limit: 5 }) }
 *
 * @module api/admin/iso19650/backfill
 * @see ADR-373 — FileRecord ISO 19650 Metadata Enrichment (P2.3)
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 * ⏱ TIMEOUT: maxDuration = 60s (AI calls ~2s/file, limit ≤ 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, extractRequestMetadata, logMigrationExecuted } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('Iso19650Backfill');

export const maxDuration = 60;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const SCAN_CAP = 500;

// ============================================================================
// TYPES
// ============================================================================

interface BackfillFileRow {
  id: string;
  downloadUrl: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  purpose?: string;
}

interface BackfillResult {
  dryRun: boolean;
  companyId: string;
  scanned: number;
  needsEnrichment: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalCostUsd: number;
  hasMore: boolean;
  errors: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

async function queryFilesNeedingEnrichment(companyId: string): Promise<BackfillFileRow[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where('companyId', '==', companyId)
    .limit(SCAN_CAP)
    .get();

  const rows: BackfillFileRow[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.disciplineCode) continue; // already enriched
    if (data.lifecycleState === 'deleted' || data.status === 'deleted') continue;
    const downloadUrl = data.downloadUrl as string | undefined;
    const filename = data.originalFilename as string | undefined;
    const contentType = data.contentType as string | undefined;
    if (!downloadUrl || !filename || !contentType) continue; // no file to analyze

    rows.push({
      id: docSnap.id,
      downloadUrl,
      filename,
      contentType,
      sizeBytes: (data.sizeBytes as number) ?? 0,
      purpose: data.purpose as string | undefined,
    });
  }
  return rows;
}

async function applyEnrichment(
  fileId: string,
  enrichment: import('@/services/ai-pipeline/tools/handlers/iso19650-enricher').Iso19650EnrichmentResult,
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.FILES).doc(fileId).update({
    disciplineCode: enrichment.disciplineCode ?? null,
    documentSeries: enrichment.documentSeries ?? null,
    revisionCode: enrichment.revisionCode ?? null,
    cdeState: enrichment.cdeState ?? null,
    buildingCode: enrichment.buildingCode ?? null,
    iso19650Source: enrichment.source,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ============================================================================
// CORE HANDLER
// ============================================================================

async function handleBackfill(
  ctx: AuthContext,
  companyId: string,
  dryRun: boolean,
  limit: number,
  request?: NextRequest,
): Promise<NextResponse> {
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted ISO 19650 backfill', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only super_admin can run this backfill' },
      { status: 403 }
    );
  }

  const startTime = Date.now();
  logger.info(`ISO19650 backfill ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`, { companyId, limit, email: ctx.email });

  const allPending = await queryFilesNeedingEnrichment(companyId);
  const batch = allPending.slice(0, limit);
  const hasMore = allPending.length > limit;

  const result: BackfillResult = {
    dryRun,
    companyId,
    scanned: allPending.length,
    needsEnrichment: allPending.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalCostUsd: 0,
    hasMore,
    errors: [],
  };

  if (!dryRun && batch.length > 0) {
    const { enrichFileWithIso19650Metadata } = await import(
      '@/services/ai-pipeline/tools/handlers/iso19650-enricher'
    );
    const { acquireSlot, releaseSlot } = await import(
      '@/services/iso19650/enrichment-slot-service'
    );

    for (const file of batch) {
      result.processed++;

      const acquired = await acquireSlot(companyId).catch(() => true);
      if (!acquired) {
        result.skipped++;
        logger.info('ISO19650 backfill: slot full, skipping file', { fileId: file.id, companyId });
        continue;
      }

      try {
        const enrichment = await enrichFileWithIso19650Metadata({
          downloadUrl: file.downloadUrl,
          filename: file.filename,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          purpose: file.purpose,
        });

        if (enrichment.source.filledBy === 'skipped') {
          result.skipped++;
          continue;
        }

        await applyEnrichment(file.id, enrichment);
        result.succeeded++;
        result.totalCostUsd += enrichment.source.aiCostUsd ?? 0;

        // P2.5 — log cost for real AI calls
        if (enrichment.source.filledBy === 'ai' && (enrichment.source.aiCostUsd ?? 0) > 0) {
          const { logIso19650EnrichmentCost } = await import(
            '@/services/iso19650/iso19650-cost-log-service'
          );
          await logIso19650EnrichmentCost({
            companyId,
            fileId: file.id,
            costUsd: enrichment.source.aiCostUsd!,
            model: enrichment.source.aiProvider ?? 'unknown',
            disciplineCode: enrichment.disciplineCode,
          }).catch(() => {});
        }
      } catch (err) {
        result.failed++;
        const msg = `${file.id}: ${getErrorMessage(err)}`;
        result.errors.push(msg);
        logger.warn('ISO19650 backfill file failed', { fileId: file.id, error: getErrorMessage(err) });
      } finally {
        await releaseSlot(companyId).catch(() => {});
      }
    }

    if (request) {
      try {
        const metadata = extractRequestMetadata(request);
        await logMigrationExecuted(ctx, 'iso19650-backfill', {
          ...metadata,
          companyId,
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          totalCostUsd: result.totalCostUsd,
        });
      } catch {
        logger.warn('Audit logging failed (non-blocking)');
      }
    }
  }

  logger.info('ISO19650 backfill complete', {
    durationMs: Date.now() - startTime,
    ...result,
  });

  return NextResponse.json({ success: true, result });
}

// ============================================================================
// ROUTES
// ============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(
    withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
        const companyId = req.nextUrl.searchParams.get('companyId') ?? '';
        if (!companyId) {
          return NextResponse.json({ success: false, error: 'companyId query param required' }, { status: 400 });
        }
        return handleBackfill(ctx, companyId, true, DEFAULT_LIMIT);
      },
      { permissions: 'admin:migrations:execute' }
    )
  );
  return handler(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(
    withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
        let body: { companyId?: string; limit?: number } = {};
        try { body = await req.json(); } catch { /* empty body */ }

        const companyId = body.companyId ?? '';
        if (!companyId) {
          return NextResponse.json({ success: false, error: 'companyId required in body' }, { status: 400 });
        }
        const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
        return handleBackfill(ctx, companyId, false, limit, req);
      },
      { permissions: 'admin:migrations:execute' }
    )
  );
  return handler(request);
}
