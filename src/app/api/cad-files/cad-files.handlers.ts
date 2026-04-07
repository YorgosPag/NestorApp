/**
 * 📐 CAD FILES API — ENTERPRISE HANDLERS (ADR-288)
 *
 * Centralizes cadFiles metadata writes through a server-side upsert pipeline.
 * Replaces direct client-side setDoc() calls in `dxf-firestore-storage.impl.ts`
 * (browser-side writes) with authenticated, audited, tenant-isolated endpoints.
 *
 * @see ADR-288 — CAD File Metadata Centralization
 * @see ADR-031 — File Storage Consolidation (cadFiles → files dual-write)
 * @see ADR-285 — DXF Levels + cadFiles Tenant Scoping
 * @see ADR-238 — Entity Creation Centralization (pattern reference)
 *
 * 🔒 SECURITY:
 * - Permission: dxf:files:view (read) · dxf:files:upload (write/delete)
 * - Admin SDK for server-side writes
 * - Tenant isolation: enforced on every read/write by companyId check
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { logAuditEvent } from '@/lib/auth/audit';
import { isRoleBypass } from '@/lib/auth/roles';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { UpsertCadFileSchema } from './cad-files.schemas';
import { writeToFilesCollection } from './dual-write-to-files';
import type {
  CadFileDeleteResponse,
  CadFileDocument,
  CadFileGetResponse,
  CadFileUpsertResponse,
} from './cad-files.types';

const logger = createModuleLogger('CadFilesRoute');

/**
 * POST /api/cad-files — Upsert DXF file metadata.
 *
 * 🏢 ADR-292 Phase 3: Writes ONLY to `files` collection (was cadFiles + dual-write).
 * The `cadFiles` collection is deprecated — all reads/writes go through `files`.
 * API route name preserved for backward compatibility with client mutation gateway.
 */
export async function handleUpsertCadFile(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<CadFileUpsertResponse>>> {
  try {
    const parsed = safeParseBody(UpsertCadFileSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    const adminDb = getAdminFirestore();

    // Read existing FileRecord to compute version + tenant isolation
    const fileDocRef = adminDb.collection(COLLECTIONS.FILES).doc(body.fileId);
    const fileSnapshot = await fileDocRef.get();

    let newVersion: number;
    let created: boolean;

    if (fileSnapshot.exists) {
      const existing = fileSnapshot.data() as Record<string, unknown> | undefined;
      const existingCompanyId = existing?.companyId as string | null | undefined;

      // Tenant isolation: bypass only for super_admin
      if (
        existingCompanyId &&
        existingCompanyId !== ctx.companyId &&
        !isRoleBypass(ctx.globalRole)
      ) {
        await logAuditEvent(ctx, 'access_denied', body.fileId, 'api', {
          metadata: {
            path: '/api/cad-files (POST upsert)',
            reason: 'Tenant isolation violation — files companyId mismatch',
          },
        });
        throw new ApiError(403, 'Access denied — tenant isolation violation');
      }

      const existingRevision = (existing?.revision as number | undefined) ?? 0;
      newVersion = existingRevision + 1;
      created = false;
    } else {
      newVersion = 1;
      created = true;
    }

    // 🏢 ADR-292 Phase 3: Write to `files` collection (primary — was dual-write)
    await writeToFilesCollection({
      fileId: body.fileId,
      fileName: body.fileName,
      downloadUrl: body.storageUrl,
      sizeBytes: body.sizeBytes,
      entityCount: body.entityCount,
      version: newVersion,
      companyId: ctx.companyId,
      createdBy: ctx.uid,
      context: body.context,
    });

    // Audit trail (best-effort)
    await logAuditEvent(ctx, 'data_created', body.fileId, 'api', {
      newValue: {
        type: 'status',
        value: {
          fileId: body.fileId,
          version: newVersion,
          created,
          entityCount: body.entityCount,
        },
      },
      metadata: {
        path: '/api/cad-files (POST upsert)',
        reason: created
          ? 'DXF FileRecord created (ADR-292 Phase 3)'
          : 'DXF FileRecord updated (ADR-292 Phase 3)',
      },
    });

    logger.info('[CadFiles/Upsert] FileRecord written', {
      fileId: body.fileId,
      version: newVersion,
      created,
      companyId: ctx.companyId,
    });

    return apiSuccess<CadFileUpsertResponse>(
      {
        fileId: body.fileId,
        version: newVersion,
        created,
      },
      created ? 'CAD file metadata created' : `CAD file metadata updated (v${newVersion})`
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[CadFiles/Upsert] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    throw new ApiError(500, getErrorMessage(error, 'Failed to upsert CAD file metadata'));
  }
}

/**
 * GET /api/cad-files?fileId=... — Fetch cadFile metadata by id.
 */
export async function handleGetCadFile(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<CadFileGetResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'fileId query parameter is required' },
        { status: 400 }
      );
    }

    // 🏢 ADR-292 Phase 3: Read from `files` collection (was cadFiles)
    const adminDb = getAdminFirestore();
    const snapshot = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: 'CAD file metadata not found' },
        { status: 404 }
      );
    }

    const data = snapshot.data() as Record<string, unknown>;
    const docCompanyId = data.companyId as string | null | undefined;

    if (
      docCompanyId &&
      docCompanyId !== ctx.companyId &&
      !isRoleBypass(ctx.globalRole)
    ) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      metadata: { id: snapshot.id, ...data } as CadFileDocument,
      message: 'CAD file metadata found',
    });
  } catch (error) {
    logger.error('[CadFiles/Get] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch CAD file metadata',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cad-files?fileId=... — Remove cadFile metadata.
 * The underlying Firebase Storage scene JSON is NOT deleted — that is managed
 * by the `files` collection lifecycle (ADR-031).
 */
export async function handleDeleteCadFile(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<CadFileDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'fileId query parameter is required' },
        { status: 400 }
      );
    }

    // 🏢 ADR-292 Phase 3: Soft-delete in `files` collection (was hard-delete in cadFiles)
    const adminDb = getAdminFirestore();
    const docRef = adminDb.collection(COLLECTIONS.FILES).doc(fileId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: 'CAD file metadata not found' },
        { status: 404 }
      );
    }

    const data = snapshot.data() as Record<string, unknown>;
    const docCompanyId = data.companyId as string | null | undefined;

    if (
      docCompanyId &&
      docCompanyId !== ctx.companyId &&
      !isRoleBypass(ctx.globalRole)
    ) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Soft-delete via enterprise lifecycle pattern (ADR-191)
    await docRef.update({
      isDeleted: true,
      lifecycleState: 'deleted',
      status: 'deleted',
      trashedAt: FieldValue.serverTimestamp(),
      trashedBy: ctx.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logAuditEvent(ctx, 'data_deleted', fileId, 'api', {
      metadata: {
        path: '/api/cad-files (DELETE)',
        reason: 'DXF FileRecord soft-deleted (ADR-292 Phase 3)',
      },
    });

    logger.info('[CadFiles/Delete] FileRecord soft-deleted', { fileId, userId: ctx.uid });

    return NextResponse.json({
      success: true,
      message: `CAD file metadata "${fileId}" deleted`,
    });
  } catch (error) {
    logger.error('[CadFiles/Delete] Error', { error: getErrorMessage(error) });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete CAD file metadata',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
