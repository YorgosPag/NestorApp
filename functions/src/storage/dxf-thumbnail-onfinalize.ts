/**
 * =============================================================================
 * STORAGE: DXF THUMBNAIL GENERATION (onFinalize)
 * =============================================================================
 *
 * When the browser-side DXF processing pipeline (ADR-033) uploads the
 * processed scene JSON alongside the original `.dxf`, this trigger rasterizes
 * that scene into a PNG thumbnail and writes it back to Storage + the Firestore
 * `files` record (`thumbnailUrl`). The thumbnail becomes the SSoT preview
 * consumed by the property showcase surface (ADR-312 Phase 3) — PDF embed,
 * public showcase page, file lists — and any future reader that wants a raster
 * of a DXF without doing the parsing itself.
 *
 * WHY we trigger on `.dxf.processed.json` (not the raw `.dxf`):
 *   - The browser is the SSoT DXF parser (ADR-033). When the processed JSON
 *     lands in Storage, the scene is *known* to be renderable.
 *   - A trigger on the raw `.dxf` would fire before processedData exists,
 *     forcing us to implement a second DXF parser inside Cloud Functions
 *     (drift risk + 300+ KB binary bloat for the same logic).
 *
 * IDEMPOTENCY:
 *   - Exits early if the Firestore record already carries `thumbnailUrl`.
 *   - The thumbnail path is deterministic, so a retried upload overwrites.
 *   - The migration endpoint `POST /api/admin/migrate-dxf-thumbnails`
 *     calls `regenerateDxfThumbnail()` directly for legacy DXFs that
 *     uploaded their processed.json before this trigger existed.
 *
 * @module functions/storage/dxf-thumbnail-onfinalize
 * @enterprise ADR-033 (Floorplan Processing), ADR-312 Phase 3 (Property Showcase)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import { COLLECTIONS } from '../config/firestore-collections';
import { generateOpaqueToken } from '../config/enterprise-id';
import {
  rasterizeDxfScene,
  DXF_THUMBNAIL_WIDTH,
  DXF_THUMBNAIL_HEIGHT,
} from '../shared/dxf-raster-generator';
import { decodeProcessedJsonBytes } from '../shared/decode-processed-json';

const PROCESSED_SUFFIX = '.dxf.processed.json';
const THUMBNAIL_SUFFIX = '.thumbnail.png';

interface RegenerateArgs {
  /** Storage path of the original `.dxf` (not the processed JSON). */
  dxfStoragePath: string;
  /** Firestore document id of the `files` record (matches `{fileId}.dxf`). */
  fileId: string;
  /** Optional Firestore document snapshot — pass it if already loaded. */
  fileDoc?: FirebaseFirestore.DocumentSnapshot;
}

export async function regenerateDxfThumbnail(
  args: RegenerateArgs
): Promise<{ thumbnailUrl: string; pngBytes: number; rendered: number; skipped: number }> {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const processedPath = `${args.dxfStoragePath}.processed.json`;
  const thumbnailPath = `${args.dxfStoragePath}${THUMBNAIL_SUFFIX}`;

  const [processedBuffer] = await bucket.file(processedPath).download();
  const processedText = decodeProcessedJsonBytes(processedBuffer);
  let sceneJson: unknown;
  try {
    sceneJson = JSON.parse(processedText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Processed DXF JSON is not valid JSON at ${processedPath}: ${msg}`);
  }
  const scene = extractScene(sceneJson);
  if (!scene) {
    throw new Error(`Processed DXF JSON at ${processedPath} has no entities`);
  }

  const raster = rasterizeDxfScene(scene, {
    width: DXF_THUMBNAIL_WIDTH,
    height: DXF_THUMBNAIL_HEIGHT,
  });

  const downloadToken = generateOpaqueToken();
  await bucket.file(thumbnailPath).save(raster.png, {
    contentType: 'image/png',
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=3600',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        derivedFrom: args.fileId,
        source: 'dxf-thumbnail-onfinalize',
      },
    },
  });

  const thumbnailUrl = buildFirebaseDownloadUrl(bucket.name, thumbnailPath, downloadToken);

  const fileRef = db.collection(COLLECTIONS.FILES).doc(args.fileId);
  await fileRef.update({
    thumbnailUrl,
    thumbnailStoragePath: thumbnailPath,
    thumbnailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info('DXF thumbnail generated', {
    fileId: args.fileId,
    dxfStoragePath: args.dxfStoragePath,
    thumbnailPath,
    pngBytes: raster.png.byteLength,
    rendered: raster.svgStats.renderedEntities,
    skipped: raster.svgStats.skippedEntities,
  });

  return {
    thumbnailUrl,
    pngBytes: raster.png.byteLength,
    rendered: raster.svgStats.renderedEntities,
    skipped: raster.svgStats.skippedEntities,
  };
}

export const onDxfProcessedFinalize = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath) return;
    if (!filePath.startsWith('companies/')) return;
    if (!filePath.endsWith(PROCESSED_SUFFIX)) return;

    const dxfStoragePath = filePath.slice(0, -'.processed.json'.length);

    const segments = dxfStoragePath.split('/');
    const fileName = segments[segments.length - 1];
    const fileId = fileName.split('.')[0];
    if (!fileId) return;

    const db = admin.firestore();
    const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
    const snap = await fileRef.get();
    if (!snap.exists) {
      functions.logger.warn('DXF thumbnail skipped — no file record', { fileId, filePath });
      return;
    }
    const data = snap.data() as Record<string, unknown>;
    if (typeof data.thumbnailUrl === 'string' && data.thumbnailUrl.length > 0) {
      functions.logger.info('DXF thumbnail skipped — already present', { fileId });
      return;
    }

    try {
      await regenerateDxfThumbnail({ dxfStoragePath, fileId, fileDoc: snap });
    } catch (err) {
      functions.logger.error('DXF thumbnail generation failed', {
        fileId,
        dxfStoragePath,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  });

function extractScene(raw: unknown):
  | {
      entities: Array<{ type: string; layer?: string; [k: string]: unknown }>;
      layers?: Record<string, { color?: string; visible?: boolean }>;
      bounds?: { min: { x: number; y: number }; max: { x: number; y: number } };
    }
  | null {
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
  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}
