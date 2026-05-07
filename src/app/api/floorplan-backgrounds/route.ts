/**
 * =============================================================================
 * Floorplan Backgrounds API — POST upload + GET by floor (ADR-340 Phase 7)
 * =============================================================================
 *
 * POST  /api/floorplan-backgrounds      — multipart upload, creates files/{fileId}
 *                                          + floorplan_backgrounds/{rbgId}
 * GET   /api/floorplan-backgrounds?floorId=X[&include=polygonState]
 *
 * RBAC (Q9): super_admin, company_admin, internal_user (write/delete).
 * GET tenant-scoped read (any role within company).
 *
 * @module api/floorplan-backgrounds/route
 * @enterprise ADR-340 Phase 7 — D5 (RBAC), D7 (multipart upload)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
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

export const maxDuration = 60;

const logger = createModuleLogger('FloorplanBackgroundsRoute');

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB (ADR-340 §3.3 Q12)

const ALLOWED_MIME_BY_PROVIDER: Record<ProviderId, ReadonlyArray<string>> = {
  'pdf-page': ['application/pdf'],
  image: ['image/png', 'image/jpeg', 'image/webp'],
};

const WRITE_ROLES = ['super_admin', 'company_admin', 'internal_user'] as const;

// ============================================================================
// HELPERS
// ============================================================================

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status });
}

function parsePositiveNumber(raw: FormDataEntryValue | null, name: string): number {
  const n = Number.parseFloat(typeof raw === 'string' ? raw : '');
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${name}: expected positive finite number`);
  }
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

// ============================================================================
// POST — multipart upload
// ============================================================================

async function handlePost(
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

  if (file.size > MAX_FILE_BYTES) {
    return bad(`File too large: ${file.size} bytes (max ${MAX_FILE_BYTES})`, 413);
  }
  if (file.size === 0) return bad('File is empty');

  const allowedMimes = ALLOWED_MIME_BY_PROVIDER[providerId];
  if (!allowedMimes.includes(file.type)) {
    return bad(`Provider ${providerId} does not accept mimeType ${file.type}`);
  }

  const providerMetadata = parseProviderMetadata(formData.get('providerMetadata'));

  // ---- 1. Build pending FileRecord (SSoT core) ---------------------------
  const ext = providerId === 'pdf-page' ? 'pdf' : (file.type.split('/')[1] || 'bin');
  const purpose = FLOORPLAN_PURPOSES.FLOOR;
  const { fileId, storagePath, recordBase } = buildPendingFileRecordData({
    companyId: ctx.companyId,
    projectId: typeof projectId === 'string' && projectId.length > 0 ? projectId : undefined,
    entityType: ENTITY_TYPES.FLOOR,
    entityId: floorId,
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    purpose,
    entityLabel: `Floor ${floorId}`,
    descriptors: [`floor-${floorId}`, providerId],
    contentType: file.type,
    originalFilename: file.name,
    createdBy: ctx.uid,
    ext,
  });

  const db = getAdminFirestore();
  const filesRef = db.collection(COLLECTIONS.FILES).doc(fileId);

  try {
    // ---- 2. Persist pending record -------------------------------------
    await filesRef.set({
      ...recordBase,
      createdAt: FieldValue.serverTimestamp(),
    });

    // ---- 3. Upload binary (SSoT: uploadPublicFile handles orphan-claim + URL) --
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: downloadUrl } = await uploadPublicFile({
      storagePath,
      buffer,
      contentType: file.type,
      createdBy: ctx.uid,
    });

    // ---- 4. Finalize FileRecord ----------------------------------------
    const finalize = buildFinalizeFileRecordUpdate({
      sizeBytes: buffer.length,
      downloadUrl,
      nextStatus: FILE_STATUS.READY,
    });
    await filesRef.update({ ...finalize, updatedAt: FieldValue.serverTimestamp() });

    // ---- 5. Create floorplan_backgrounds doc ---------------------------
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

    logger.info('Floorplan background uploaded', {
      fileId,
      backgroundId: background.id,
      floorId,
      bytes: buffer.length,
    });

    return NextResponse.json({ background, fileRecord: { id: fileId, downloadUrl } }, { status: 201 });
  } catch (err) {
    // Best-effort rollback: mark file failed if Firestore doc was created.
    try {
      await filesRef.update({ status: FILE_STATUS.FAILED, updatedAt: nowISO() });
    } catch {
      /* swallow */
    }
    logger.error('POST upload failed', { fileId, error: getErrorMessage(err) });
    return NextResponse.json(
      { error: getErrorMessage(err, 'Upload failed'), code: 'UPLOAD_FAILED' },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET — list by floor (+ optional polygon state for replace dialog)
// ============================================================================

async function handleGet(
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

    return NextResponse.json({
      background: backgrounds[0] ?? null,
      polygonState,
    });
  } catch (err) {
    logger.error('GET failed', { floorId, error: getErrorMessage(err) });
    return NextResponse.json(
      { error: getErrorMessage(err, 'Get failed'), code: 'GET_FAILED' },
      { status: 500 },
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const POST = withHeavyRateLimit(
  withAuth(handlePost, { requiredGlobalRoles: [...WRITE_ROLES] }),
);

export const GET = withHeavyRateLimit(withAuth(handleGet));
