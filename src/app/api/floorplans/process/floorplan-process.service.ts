/**
 * DXF/PDF processing logic for floorplan API route.
 * Extracted for Google SRP compliance (route.ts ≤ 300 lines).
 *
 * @module api/floorplans/process/service
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 */

import { gunzipSync, gzipSync } from 'zlib';
import type { Bucket } from '@google-cloud/storage';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  FloorplanProcessedData,
  DxfSceneData,
  DxfSceneEntity,
} from '@/types/file-record';
import type { FileRecordData } from './floorplan-process.types';

const logger = createModuleLogger('FloorplanProcessService');

const SUPPORTED_DXF_EXTENSIONS = ['dxf'];
const SUPPORTED_PDF_EXTENSIONS = ['pdf'];

export interface ProcessResult {
  processedData: FloorplanProcessedData;
  stats?: { entityCount: number; layerCount: number; parseTimeMs: number };
}

/**
 * Determine if file type is supported and which type it is.
 */
export function getFileType(ext: string): 'dxf' | 'pdf' | null {
  const normalized = ext.toLowerCase().replace('.', '');
  if (SUPPORTED_DXF_EXTENSIONS.includes(normalized)) return 'dxf';
  if (SUPPORTED_PDF_EXTENSIONS.includes(normalized)) return 'pdf';
  return null;
}

/**
 * Download file from Storage, decompress if needed.
 */
export async function downloadFile(
  bucket: Bucket,
  storagePath: string,
): Promise<Buffer> {
  logger.info('Downloading from storage', { storagePath });

  const fileRef = bucket.file(storagePath);
  const [fileBuffer] = await fileRef.download();

  const [fileMeta] = await fileRef.getMetadata();
  const customMeta = (fileMeta.metadata ?? {}) as Record<string, unknown>;
  const isCompressed = customMeta.compressed === 'gzip';
  const rawBuffer = isCompressed ? gunzipSync(fileBuffer) : fileBuffer;

  logger.info('Downloaded', {
    bytes: fileBuffer.length,
    ...(isCompressed && { decompressed: rawBuffer.length }),
  });

  return rawBuffer;
}

/**
 * Process a DXF file: parse, compress scene, upload to Storage.
 */
export async function processDxf(
  rawBuffer: Buffer,
  fileData: FileRecordData,
  bucket: Bucket,
): Promise<ProcessResult> {
  const parseStart = Date.now();

  const { encodingService } = await import(
    '@/subapps/dxf-viewer/io/encoding-service'
  );
  const { content, encoding } = encodingService.decodeBufferWithAutoDetect(rawBuffer);

  logger.info('Decoded', { encoding });

  const { DxfSceneBuilder } = await import(
    '@/subapps/dxf-viewer/utils/dxf-scene-builder'
  );

  const scene = DxfSceneBuilder.buildScene(content);
  const parseTimeMs = Date.now() - parseStart;

  const dxfSceneData: DxfSceneData = {
    entities: scene.entities.map((entity) => {
      const { type, layer, ...rest } = entity;
      return { type, layer: layer || '0', ...rest } as DxfSceneEntity;
    }),
    layers: scene.layers,
    bounds: scene.bounds,
  };

  const stats = {
    entityCount: dxfSceneData.entities.length,
    layerCount: Object.keys(dxfSceneData.layers).length,
    parseTimeMs,
  };

  // Save scene JSON to Storage (compressed)
  const processedDataPath = `${fileData.storagePath}.processed.json`;
  const processedJsonRaw = Buffer.from(JSON.stringify(dxfSceneData), 'utf-8');
  const processedJsonBuffer = gzipSync(processedJsonRaw);

  logger.info('Uploading compressed scene JSON to Storage', {
    processedDataPath,
    original: processedJsonRaw.length,
    compressed: processedJsonBuffer.length,
    reduction: `${((1 - processedJsonBuffer.length / processedJsonRaw.length) * 100).toFixed(0)}%`,
  });

  const processedFileRef = bucket.file(processedDataPath);
  await processedFileRef.save(processedJsonBuffer, {
    metadata: {
      contentType: 'application/json',
      cacheControl: 'private, max-age=31536000',
      metadata: { compressed: 'gzip', originalSize: String(processedJsonRaw.length) },
    },
  });

  const processedData: FloorplanProcessedData = {
    fileType: 'dxf',
    processedDataPath,
    sceneStats: stats,
    bounds: dxfSceneData.bounds,
    processedAt: Date.now(),
    originalSize: rawBuffer.length,
    processedSize: processedJsonBuffer.length,
    encoding,
  };

  logger.info('DXF parsed', { stats });

  return { processedData, stats };
}

/**
 * Process a PDF file (metadata only — full rendering requires PDF library).
 */
export function processPdf(fileBuffer: Buffer): ProcessResult {
  const processedData: FloorplanProcessedData = {
    fileType: 'pdf',
    processedAt: Date.now(),
    originalSize: fileBuffer.length,
  };

  logger.info('PDF marked as processed');
  return { processedData };
}
