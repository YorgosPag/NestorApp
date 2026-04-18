/**
 * Server-only helpers for the DXF thumbnail back-fill (ADR-312 Phase 3).
 *
 * Duplicates the runtime behaviour of the Cloud Function trigger
 * `functions/src/storage/dxf-thumbnail-onfinalize.ts` so legacy DXFs that
 * were uploaded before the trigger existed can be rasterised on demand.
 * Both paths converge on the same SSoT rasterizer
 * (`src/services/dxf-raster/dxf-raster-generator.ts`, mirrored into
 * `functions/src/shared/`), so the output is byte-for-byte identical to what
 * new uploads produce.
 */
import 'server-only';

import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { rasterizeDxfScene } from '@/services/dxf-raster/dxf-raster-generator';
import type { DxfSceneInput } from '@/services/dxf-raster/svg-from-dxf-scene';
import { generateOpaqueToken } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { decodeProcessedJsonBytes } from './decode-processed-json';

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

const THUMBNAIL_SUFFIX = '.thumbnail.png';

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
    const processedPath = (data.processedData as { processedDataPath?: string })?.processedDataPath;
    if (!processedPath) {
      items.push({ fileId: c.id, status: 'skipped', reason: 'missing processedDataPath' });
      skipped += 1;
      continue;
    }

    if (opts.dryRun) {
      items.push({ fileId: c.id, status: 'skipped', reason: 'dryRun' });
      skipped += 1;
      continue;
    }

    try {
      const result = await rasterizeAndPersist({
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

async function rasterizeAndPersist(args: {
  fileId: string;
  dxfStoragePath: string;
  processedPath: string;
}): Promise<{ thumbnailUrl: string; pngBytes: number; rendered: number; skipped: number }> {
  const bucket = getAdminBucket();
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new Error('Admin Firestore unavailable');

  const [processedBuffer] = await bucket.file(args.processedPath).download();
  const raw = JSON.parse(decodeProcessedJsonBytes(processedBuffer)) as unknown;
  const scene = extractScene(raw);
  if (!scene) throw new Error('processed JSON has no entities');

  const raster = rasterizeDxfScene(scene);
  const pngBuffer = Buffer.from(raster.png);
  const thumbnailPath = `${args.dxfStoragePath}${THUMBNAIL_SUFFIX}`;
  const downloadToken = generateOpaqueToken();

  await bucket.file(thumbnailPath).save(pngBuffer, {
    contentType: 'image/png',
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=3600',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        derivedFrom: args.fileId,
        source: 'migrate-dxf-thumbnails',
      },
    },
  });

  const thumbnailUrl = buildFirebaseDownloadUrl(bucket.name, thumbnailPath, downloadToken);

  await adminDb.collection(COLLECTIONS.FILES).doc(args.fileId).update({
    thumbnailUrl,
    thumbnailStoragePath: thumbnailPath,
    thumbnailUpdatedAt: new Date(),
  });

  return {
    thumbnailUrl,
    pngBytes: pngBuffer.byteLength,
    rendered: raster.svgStats.renderedEntities,
    skipped: raster.svgStats.skippedEntities,
  };
}

function extractScene(raw: unknown): DxfSceneInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const nested = obj.scene as Record<string, unknown> | undefined;
  const entitiesRaw = (obj.entities ?? nested?.entities) as unknown;
  if (!Array.isArray(entitiesRaw) || entitiesRaw.length === 0) return null;
  const entities: Array<{ type: string; layer?: string; [k: string]: unknown }> = [];
  for (const e of entitiesRaw) {
    if (e && typeof e === 'object' && typeof (e as { type?: unknown }).type === 'string') {
      entities.push(e as { type: string; layer?: string; [k: string]: unknown });
    }
  }
  if (entities.length === 0) return null;
  const layers = (obj.layers ?? nested?.layers) as
    | Record<string, { color?: string; visible?: boolean }>
    | undefined;
  const bounds = (obj.bounds ?? nested?.bounds) as
    | { min: { x: number; y: number }; max: { x: number; y: number } }
    | undefined;
  return { entities, layers, bounds };
}

function buildFirebaseDownloadUrl(bucketName: string, path: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
