import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  getAdminFirestore,
  FieldValue,
} from '@/lib/firebaseAdmin';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  FLOORPLAN_PURPOSES,
  FILE_STATUS,
} from '@/config/domain-constants';
import {
  buildPendingFileRecordData,
  buildFinalizeFileRecordUpdate,
} from '@/services/file-record/file-record-core';
import { FloorplanBackgroundService } from '@/services/floorplan-background/floorplan-background.service';
import { FloorplanCascadeDeleteService } from '@/services/floorplan-background/floorplan-cascade-delete.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import type { ProviderId } from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const logger = createModuleLogger('FloorplanBackgroundsRoute');

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_BY_PROVIDER: Record<ProviderId, ReadonlyArray<string>> = {
  'pdf-page': ['application/pdf'],
  image: ['image/png', 'image/jpeg', 'image/webp'],
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status });
}

function parsePositiveNumber(raw: FormDataEntryValue | null, name: string): number {
  const n = Number.parseFloat(typeof raw === 'string' ? raw : '');
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${name}: expected positive finite number`);
  return n;
}

function parseProviderId(raw: FormDataEntryValue | null): ProviderId {
  if (raw === 'pdf-page' || raw === 'image') return raw;
  throw new Error(`Invalid providerId: ${String(raw)}`);
}

function parseProviderMetadata(raw: FormDataEntryValue | null): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  if (!ctx.companyId) return bad('companyId missing on auth context', 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return bad(`Invalid multipart body: ${getErrorMessage(err)}`);
  }

  const file = formData.get('file');
  const floorId = formData.get('floorId');
  const projectId = formData.get('projectId');
  const providerIdRaw = formData.get('providerId');

  if (!(file instanceof File)) return bad('file is required');
  if (typeof floorId !== 'string' || floorId.length === 0) return bad('floorId is required');

  let providerId: ProviderId;
  let naturalWidth: number;
  let naturalHeight: number;
  try {
    providerId = parseProviderId(providerIdRaw);
    naturalWidth = parsePositiveNumber(formData.get('naturalWidth'), 'naturalWidth');
    naturalHeight = parsePositiveNumber(formData.get('naturalHeight'), 'naturalHeight');
  } catch (err) {
    return bad(getErrorMessage(err));
  }

  if (file.size > MAX_FILE_BYTES) return bad(`File too large: ${file.size} bytes (max ${MAX_FILE_BYTES})`, 413);
  if (file.size === 0) return bad('File is empty');

  const allowedMimes = ALLOWED_MIME_BY_PROVIDER[providerId];
  if (!allowedMimes.includes(file.type)) return bad(`Provider ${providerId} does not accept mimeType ${file.type}`);

  const providerMetadata = parseProviderMetadata(formData.get('providerMetadata'));
  const db = getAdminFirestore();

  let floorEntityLabel = 'Κάτοψη Ορόφου';
  let buildingLabel: string | undefined;
  let projectLabel: string | undefined;
  try {
    const floorSnap = await db.collection(COLLECTIONS.FLOORS).doc(floorId).get();
    if (floorSnap.exists) {
      const fd = floorSnap.data() as { name?: string; number?: number; buildingId?: string } | undefined;
      if (fd?.name) floorEntityLabel = fd.name;
      else if (fd?.number !== undefined) floorEntityLabel = `Όροφος ${fd.number}`;
      if (fd?.buildingId) {
        const buildingSnap = await db.collection(COLLECTIONS.BUILDINGS).doc(fd.buildingId).get();
        if (buildingSnap.exists) {
          const bd = buildingSnap.data() as { name?: string } | undefined;
          if (bd?.name) buildingLabel = bd.name;
        }
      }
    }
    const resolvedProjectId = typeof projectId === 'string' && projectId.length > 0 ? projectId : undefined;
    if (resolvedProjectId) {
      const projectSnap = await db.collection(COLLECTIONS.PROJECTS).doc(resolvedProjectId).get();
      if (projectSnap.exists) {
        const pd = projectSnap.data() as { name?: string; title?: string } | undefined;
        projectLabel = pd?.name ?? pd?.title;
      }
    }
  } catch { /* keep fallback — non-critical */ }

  const ext = providerId === 'pdf-page' ? 'pdf' : (file.type.split('/')[1] || 'bin');
  const { fileId, storagePath, recordBase } = buildPendingFileRecordData({
    companyId: ctx.companyId,
    projectId: typeof projectId === 'string' && projectId.length > 0 ? projectId : undefined,
    entityType: ENTITY_TYPES.FLOOR,
    entityId: floorId,
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    purpose: FLOORPLAN_PURPOSES.FLOOR,
    entityLabel: floorEntityLabel,
    contentType: file.type,
    originalFilename: file.name,
    createdBy: ctx.uid,
    ext,
  });

  const filesRef = db.collection(COLLECTIONS.FILES).doc(fileId);
  try {
    await filesRef.set({
      ...recordBase,
      ...(projectLabel ? { projectLabel } : {}),
      ...(buildingLabel ? { buildingLabel } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: downloadUrl } = await uploadPublicFile({ storagePath, buffer, contentType: file.type, createdBy: ctx.uid });

    const finalize = buildFinalizeFileRecordUpdate({ sizeBytes: buffer.length, downloadUrl, nextStatus: FILE_STATUS.READY });
    await filesRef.update({ ...finalize, updatedAt: FieldValue.serverTimestamp() });

    const background = await FloorplanBackgroundService.create({
      companyId: ctx.companyId,
      floorId,
      fileId,
      providerId,
      providerMetadata: {
        pdfPageNumber: typeof providerMetadata.pdfPageNumber === 'number' ? providerMetadata.pdfPageNumber : undefined,
        imageOrientation: typeof providerMetadata.imageOrientation === 'number' ? providerMetadata.imageOrientation : undefined,
        imageMimeType: typeof providerMetadata.imageMimeType === 'string' ? providerMetadata.imageMimeType : undefined,
        imageDecoderUsed: providerMetadata.imageDecoderUsed === 'utif' ? 'utif' : 'native',
      },
      naturalBounds: { width: naturalWidth, height: naturalHeight },
      createdBy: ctx.uid,
    });

    logger.info('Floorplan background uploaded', { fileId, backgroundId: background.id, floorId, bytes: buffer.length });
    return NextResponse.json({ background, fileRecord: { id: fileId, downloadUrl } }, { status: 201 });
  } catch (err) {
    try { await filesRef.update({ status: FILE_STATUS.FAILED, updatedAt: nowISO() }); } catch { /* swallow */ }
    logger.error('POST upload failed', { fileId, error: getErrorMessage(err) });
    return NextResponse.json({ error: getErrorMessage(err, 'Upload failed'), code: 'UPLOAD_FAILED' }, { status: 500 });
  }
}

export async function handleGet(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  if (!ctx.companyId) return bad('companyId missing on auth context', 403);

  const floorId = request.nextUrl.searchParams.get('floorId');
  if (!floorId) return bad('floorId query param required');

  const include = request.nextUrl.searchParams.get('include');
  const wantsPolygonState = include === 'polygonState';

  try {
    const [backgrounds, polygonState] = await Promise.all([
      FloorplanBackgroundService.listByFloor(ctx.companyId, floorId),
      wantsPolygonState
        ? FloorplanCascadeDeleteService.getFloorPolygonState(ctx.companyId, floorId)
        : Promise.resolve(null),
    ]);

    const background = backgrounds[0] ?? null;
    let fileRecord: { id: string; downloadUrl: string | null } | null = null;
    if (background) {
      const db = getAdminFirestore();
      const fileSnap = await db.collection(COLLECTIONS.FILES).doc(background.fileId).get();
      if (fileSnap.exists) {
        const fdata = fileSnap.data() as { companyId?: string; downloadUrl?: string } | undefined;
        if (fdata?.companyId === ctx.companyId) {
          fileRecord = { id: background.fileId, downloadUrl: fdata.downloadUrl ?? null };
        }
      }
    }

    return NextResponse.json({ background, polygonState, fileRecord });
  } catch (err) {
    logger.error('GET failed', { floorId, error: getErrorMessage(err) });
    return NextResponse.json({ error: getErrorMessage(err, 'Get failed'), code: 'GET_FAILED' }, { status: 500 });
  }
}
