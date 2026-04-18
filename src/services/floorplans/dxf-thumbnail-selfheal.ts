/**
 * =============================================================================
 * SSoT — DXF thumbnail self-heal (ADR-312 Phase 7.3)
 * =============================================================================
 *
 * Single-source helper for producing the two artifacts that make a DXF
 * previewable inside the showcase surface:
 *
 *   1. `.dxf.processed.json` — browser-parsed scene serialised on Storage.
 *      Normally produced by `POST /api/floorplans/process` after a client
 *      upload; absent for legacy DXFs that never hit that endpoint.
 *
 *   2. `.dxf.thumbnail.png` — raster preview derived from the processed
 *      scene. Normally produced by the Cloud Function trigger
 *      `onDxfProcessedFinalize` once `.processed.json` lands.
 *
 * This module exposes a self-contained `ensureDxfThumbnail(fileId)` that
 * inspects the current Firestore state and invokes exactly the step that's
 * still missing — never duplicates work, never re-rasterises a DXF that
 * already has a thumbnail. Used by:
 *
 *   - `api/showcase/[token]/route.ts` — fire-and-forget self-heal when a
 *     linked parking/storage DXF is discovered without `thumbnailUrl`.
 *   - `api/admin/migrate-dxf-thumbnails/helpers.ts` — batch back-fill.
 *
 * The rasterizer (`rasterizeDxfScene`), the processed-JSON decoder
 * (`decodeProcessedJsonBytes`) and the DXF parser (`processDxf`) are all
 * pre-existing SSoT modules; this file is pure orchestration — zero
 * duplicated logic.
 *
 * @module services/floorplans/dxf-thumbnail-selfheal
 * @enterprise ADR-312 Phase 7.3
 */
import 'server-only';

import type { Bucket } from '@google-cloud/storage';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { rasterizeDxfScene } from '@/services/dxf-raster/dxf-raster-generator';
import type { DxfSceneInput } from '@/services/dxf-raster/svg-from-dxf-scene';
import { generateOpaqueToken } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  downloadFile,
  processDxf,
} from '@/app/api/floorplans/process/floorplan-process.service';
import type { FileRecordData } from '@/app/api/floorplans/process/floorplan-process.types';
import { decodeProcessedJsonBytes } from '@/app/api/admin/migrate-dxf-thumbnails/decode-processed-json';

const logger = createModuleLogger('DxfThumbnailSelfheal');

const THUMBNAIL_SUFFIX = '.thumbnail.png';

export type EnsureThumbnailStatus =
  | 'already-present'
  | 'queued-processing'
  | 'rasterized'
  | 'skipped';

export interface RasterizeResult {
  thumbnailUrl: string;
  pngBytes: number;
  rendered: number;
  skipped: number;
}

/**
 * Self-heal orchestrator — reads the FileRecord state and advances the DXF to
 * the next pipeline stage it's missing. Safe to call fire-and-forget from any
 * request-path server code; always exits quickly for the happy path (thumbnail
 * already present).
 */
export async function ensureDxfThumbnail(fileId: string): Promise<EnsureThumbnailStatus> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return 'skipped';

  const doc = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();
  if (!doc.exists) return 'skipped';
  const data = doc.data() as Record<string, unknown>;

  const ext = (data.ext as string | undefined)?.toLowerCase();
  if (ext !== 'dxf') return 'skipped';

  if (typeof data.thumbnailUrl === 'string' && data.thumbnailUrl.length > 0) {
    return 'already-present';
  }

  const storagePath = data.storagePath as string | undefined;
  if (!storagePath) return 'skipped';

  const processedPath = (data.processedData as { processedDataPath?: string } | undefined)
    ?.processedDataPath;

  if (!processedPath) {
    // Generate the `.processed.json` artifact — the Cloud Function trigger
    // `onDxfProcessedFinalize` will rasterize the PNG once it lands on
    // Storage. Zero duplicate rasterization path.
    await ensureProcessedDataForDxf({ fileId, storagePath, data });
    logger.info('DXF self-heal queued processing', { fileId });
    return 'queued-processing';
  }

  // processedData exists but thumbnail is missing — the Cloud Function
  // finalize already fired once (or failed). Rasterize directly instead of
  // re-uploading the processed JSON (which wouldn't re-fire the trigger
  // anyway, `onFinalize` only runs on the initial object write).
  await rasterizeDxfThumbnail({
    fileId,
    dxfStoragePath: storagePath,
    processedPath,
  });
  logger.info('DXF self-heal rasterized', { fileId });
  return 'rasterized';
}

/**
 * Generate `.dxf.processed.json` + persist `processedData` on the FileRecord.
 * Delegates to the SSoT `processDxf()` server service so the output is
 * byte-for-byte identical to what `/api/floorplans/process` produces.
 * Returns the resulting `processedDataPath`.
 */
export async function ensureProcessedDataForDxf(args: {
  fileId: string;
  storagePath: string;
  data: Record<string, unknown>;
}): Promise<string> {
  const bucket = getAdminBucket();
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new Error('Admin Firestore unavailable');

  const ext = ((args.data.ext as string | undefined) ?? 'dxf').toLowerCase();
  if (ext !== 'dxf') {
    throw new Error(`not a DXF (ext=${ext})`);
  }

  const rawBuffer = await downloadFile(bucket, args.storagePath);

  const fileData: FileRecordData = {
    id: args.fileId,
    storagePath: args.storagePath,
    contentType: (args.data.contentType as string | undefined) ?? 'application/octet-stream',
    ext: 'dxf',
    originalFilename: (args.data.originalFilename as string | undefined) ?? '',
    displayName: (args.data.displayName as string | undefined) ?? '',
    companyId: args.data.companyId as string | undefined,
  };

  const result = await processDxf(rawBuffer, fileData, bucket);
  const processedDataPath = result.processedData.processedDataPath;
  if (!processedDataPath) {
    throw new Error('processDxf returned no processedDataPath');
  }

  await adminDb.collection(COLLECTIONS.FILES).doc(args.fileId).update({
    processedData: result.processedData,
    updatedAt: new Date(),
  });

  return processedDataPath;
}

/**
 * Download `.dxf.processed.json`, rasterize through the SSoT
 * `rasterizeDxfScene()`, upload PNG to `{dxfPath}.thumbnail.png`, patch the
 * Firestore doc with `{thumbnailUrl, thumbnailStoragePath, thumbnailUpdatedAt}`.
 * Mirror of the Cloud Function `regenerateDxfThumbnail()` for on-demand runs
 * from the Next.js server. Both converge on the same rasterizer output.
 */
export async function rasterizeDxfThumbnail(args: {
  fileId: string;
  dxfStoragePath: string;
  processedPath: string;
}): Promise<RasterizeResult> {
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

  await persistThumbnail({
    bucket,
    fileId: args.fileId,
    thumbnailPath,
    pngBuffer,
    downloadToken,
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

async function persistThumbnail(args: {
  bucket: Bucket;
  fileId: string;
  thumbnailPath: string;
  pngBuffer: Buffer;
  downloadToken: string;
}): Promise<void> {
  await args.bucket.file(args.thumbnailPath).save(args.pngBuffer, {
    contentType: 'image/png',
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=3600',
      metadata: {
        firebaseStorageDownloadTokens: args.downloadToken,
        derivedFrom: args.fileId,
        source: 'dxf-thumbnail-selfheal',
      },
    },
  });
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
