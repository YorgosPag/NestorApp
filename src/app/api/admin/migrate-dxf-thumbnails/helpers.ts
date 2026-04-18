/**
 * Server-only helpers for the DXF thumbnail back-fill (ADR-312 Phase 3).
 *
 * The heavy-lifting (processed-JSON generation, rasterization, Firestore
 * write-back) lives in the SSoT module
 * `src/services/floorplans/dxf-thumbnail-selfheal.ts` — same module used by
 * the public showcase route for fire-and-forget self-heal (Phase 7.3). This
 * file is pure orchestration: candidate discovery + iteration + reporting.
 */
import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  ensureProcessedDataForDxf,
  rasterizeDxfThumbnail,
} from '@/services/floorplans/dxf-thumbnail-selfheal';

const logger = createModuleLogger('MigrateDxfThumbnails');

export interface MigrationOptions {
  companyId: string;
  limit: number;
  dryRun: boolean;
}

export interface MigrationResultItem {
  fileId: string;
  status: 'rasterized' | 'skipped' | 'failed';
  reason?: string;
  thumbnailUrl?: string;
  pngBytes?: number;
  rendered?: number;
  skipped?: number;
}

export interface MigrationReport {
  processed: number;
  rasterized: number;
  skippedCount: number;
  failed: number;
  dryRun: boolean;
  items: MigrationResultItem[];
}

export async function runDxfThumbnailMigration(
  opts: MigrationOptions
): Promise<MigrationReport> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    throw new Error('Admin Firestore unavailable');
  }

  const snap = await adminDb
    .collection(COLLECTIONS.FILES)
    .where('companyId', '==', opts.companyId)
    .where('ext', '==', 'dxf')
    .limit(opts.limit * 3)
    .get();

  const candidates: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data.isDeleted === true) continue;
    if (data.thumbnailUrl && typeof data.thumbnailUrl === 'string') continue;
    candidates.push({ id: d.id, data });
    if (candidates.length >= opts.limit) break;
  }

  const items: MigrationResultItem[] = [];
  let rasterized = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of candidates) {
    const data = c.data;
    const storagePath = data.storagePath as string | undefined;
    if (!storagePath) {
      items.push({ fileId: c.id, status: 'skipped', reason: 'missing storagePath' });
      skipped += 1;
      continue;
    }
    let processedPath = (data.processedData as { processedDataPath?: string })?.processedDataPath;

    if (!processedPath) {
      if (opts.dryRun) {
        items.push({
          fileId: c.id,
          status: 'skipped',
          reason: 'dryRun (would generate processedData)',
        });
        skipped += 1;
        continue;
      }
      try {
        processedPath = await ensureProcessedDataForDxf({
          fileId: c.id,
          storagePath,
          data,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('DXF processedData auto-generation failed', {
          fileId: c.id,
          error: msg,
        });
        items.push({ fileId: c.id, status: 'failed', reason: `auto-process failed: ${msg}` });
        failed += 1;
        continue;
      }
    }

    if (opts.dryRun) {
      items.push({ fileId: c.id, status: 'skipped', reason: 'dryRun' });
      skipped += 1;
      continue;
    }

    try {
      const result = await rasterizeDxfThumbnail({
        fileId: c.id,
        dxfStoragePath: storagePath,
        processedPath,
      });
      items.push({ fileId: c.id, status: 'rasterized', ...result });
      rasterized += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('DXF thumbnail migration failed for file', { fileId: c.id, error: msg });
      items.push({ fileId: c.id, status: 'failed', reason: msg });
      failed += 1;
    }
  }

  return {
    processed: candidates.length,
    rasterized,
    skippedCount: skipped,
    failed,
    dryRun: opts.dryRun,
    items,
  };
}
