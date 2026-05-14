import 'server-only';

import { gunzipSync } from 'zlib';
import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { LISTED_COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FloorplanSceneFetcher');
const SCENE_CACHE_TTL_SECONDS = 300;

export interface FileRecordData {
  id: string;
  companyId?: string;
  projectId?: string;
  storagePath?: string;
  processedData?: { processedDataPath?: string; fileType?: string };
}

export async function fetchFileRecord(fileId: string): Promise<FileRecordData | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTIONS.FILES).doc(fileId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as FileRecordData;
}

export async function isFilePublic(file: FileRecordData): Promise<boolean> {
  if (!file.projectId) return false;
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.PROPERTIES)
    .where('projectId', '==', file.projectId)
    .where('commercialStatus', 'in', LISTED_COMMERCIAL_STATUSES as unknown as string[])
    .limit(1)
    .get();
  return !snap.empty;
}

export async function downloadSceneFile(
  file: FileRecordData,
  fileId: string,
  storageBucket: string
): Promise<{ buffer: Buffer; etag: string; isGzip: boolean } | null> {
  const adminStorage = getAdminStorage();
  const bucket = adminStorage.bucket(storageBucket);
  const rawPath = file.storagePath ?? '';

  const sceneJsonPath = rawPath
    ? rawPath.endsWith('.scene.json')
      ? rawPath
      : rawPath.replace(/(\.[a-zA-Z0-9]+)+$/, '') + '.scene.json'
    : null;

  let resolvedPath: string | null = null;
  let isGzip = false;

  if (sceneJsonPath) {
    const [exists] = await bucket.file(sceneJsonPath).exists();
    if (exists) { resolvedPath = sceneJsonPath; isGzip = false; }
  }
  if (!resolvedPath && file.processedData?.processedDataPath) {
    const [exists] = await bucket.file(file.processedData.processedDataPath).exists();
    if (exists) { resolvedPath = file.processedData.processedDataPath; isGzip = true; }
  }
  if (!resolvedPath) return null;

  const fileRef = bucket.file(resolvedPath);
  const [fileBuffer] = await fileRef.download();
  const [metadata] = await fileRef.getMetadata();
  const customMeta = (metadata.metadata ?? {}) as Record<string, unknown>;
  const isCompressed = isGzip || customMeta.compressed === 'gzip';

  logger.info('Scene downloaded', { fileId, resolvedPath, bytes: fileBuffer.length });
  return {
    buffer: isCompressed ? gunzipSync(fileBuffer) : fileBuffer,
    etag: String(metadata.etag || metadata.generation || fileId),
    isGzip: isCompressed,
  };
}

export function buildSceneResponse(
  buffer: Buffer,
  etag: string,
  fileId: string,
  ifNoneMatch: string | null
): NextResponse {
  if (ifNoneMatch === etag) return new NextResponse(null, { status: 304 });
  return new NextResponse(buffer.toString('utf-8'), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${SCENE_CACHE_TTL_SECONDS}`,
      'ETag': etag,
      'X-File-Id': fileId,
    },
  });
}

export { getErrorMessage };
