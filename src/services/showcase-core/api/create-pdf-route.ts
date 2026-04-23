/**
 * =============================================================================
 * SHOWCASE CORE — Authenticated PDF Route Factory (ADR-321 Phase 1.4a)
 * =============================================================================
 *
 * Config-driven generic that produces `POST /api/{collection}/[id]/showcase/
 * pdf` handlers. Extracted from the 3 legacy routes (property / project /
 * building) which were 95 %-identical around:
 *
 *   1. Parse+validate body (Zod) → normalise locale.
 *   2. Assert tenant context (companyId).
 *   3. Delegate snapshot + media + logos loading to the surface-specific
 *      `loadPdfData` hook.
 *   4. Generate the PDF via `ShowcasePDFService` (Phase 1.3a) — service
 *      instance owns renderer composition and Greek-font registration.
 *   5. Generate a deterministic `pdfFileId` + `storagePath` via the
 *      canonical `buildStoragePath` helper.
 *   6. Write a pre-upload ownership claim to `FILE_SHARES` so
 *      `onStorageFinalize` orphan-cleanup skips the just-uploaded PDF
 *      (ADR-312 §Race; the later `UnifiedSharingService.createShare` makes
 *      the claim inert by attaching `showcaseMeta.pdfStoragePath`).
 *   7. Upload the PDF bytes to Storage.
 *   8. Compensate the claim on upload failure (best-effort delete).
 *   9. Return `{ pdfStoragePath, pdfRegeneratedAt }`.
 *
 * The factory returns an already-wrapped `POST` (withAuth + withStandardRate-
 * Limit). Route files simply extract the entity id from the segment params
 * and forward the request — they no longer own any orchestration.
 *
 * @module services/showcase-core/api/create-pdf-route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { generateShareId } from '@/services/enterprise-id.service';
import { createModuleLogger, type Logger } from '@/lib/telemetry/Logger';
import { nowISO } from '@/lib/date-local';
import type { ShowcasePDFService } from '../pdf-service';

// =============================================================================
// Public contracts
// =============================================================================

export type ShowcasePdfLocale = 'el' | 'en';

export interface ShowcasePdfResponseBody {
  pdfStoragePath: string;
  pdfRegeneratedAt: string;
}

export interface LoadShowcasePdfDataParams<TExtraBody> {
  entityId: string;
  ctx: AuthContext;
  locale: ShowcasePdfLocale;
  body: TExtraBody;
  adminDb: Firestore;
  /** Request base URL (useful when PDF must embed the public share URL). */
  baseUrl: string;
  logger: Logger;
}

export interface CreateShowcasePdfRouteConfig<TData, TExtraBody = {}> {
  /** Used for storage path entityType segment + logs. */
  entityType: string;
  /**
   * Name of the surface-specific id field written into `FILE_SHARES` on the
   * pre-upload claim (e.g. `showcaseBuildingId`, `showcasePropertyId`).
   */
  entityIdFsField: string;
  /** Permission passed to `withAuth` (e.g. `'buildings:buildings:update'`). */
  permission: string;
  /** Module-logger name (e.g. `'BuildingShowcasePdfRoute'`). */
  loggerName: string;
  /** Note stored on the pre-upload claim (diagnostic). */
  noteText: string;
  /**
   * Optional extra body schema. The base schema always accepts
   * `{ locale?: 'el'|'en' }`; the extension is merged on top. Defaults to
   * `z.object({})` — no extras.
   */
  extraBodySchema?: ZodTypeAny;
  /**
   * Load the surface-specific PDF data (snapshot + media + logos + labels).
   * Called after tenant validation, before PDF generation.
   */
  loadPdfData: (params: LoadShowcasePdfDataParams<TExtraBody>) => Promise<TData>;
  /** Showcase PDF service instance owning renderer + Greek font. */
  pdfService: ShowcasePDFService<TData>;
}

export interface ShowcasePdfRouteHandler {
  handle(request: NextRequest, entityId: string): Promise<Response>;
}

// =============================================================================
// Internal helpers
// =============================================================================

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

async function uploadPdfToStorage(pdfBytes: Uint8Array, storagePath: string): Promise<void> {
  const bucket = getAdminBucket();
  const fileRef = bucket.file(storagePath);
  if (pdfBytes.byteLength === 0) throw new Error('PDF buffer is empty');
  await fileRef.save(
    Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength),
    {
      contentType: 'application/pdf',
      metadata: { cacheControl: 'private, max-age=3600' },
      resumable: false,
    },
  );
  const [exists] = await fileRef.exists();
  if (!exists) throw new Error(`Upload succeeded but object missing: ${storagePath}`);
}

interface ClaimParams {
  adminDb: Firestore;
  pdfFileId: string;
  ctx: AuthContext;
  entityId: string;
  entityIdFsField: string;
  storagePath: string;
  noteText: string;
}

async function writePreUploadClaim(params: ClaimParams): Promise<void> {
  const { adminDb, pdfFileId, ctx, entityId, entityIdFsField, storagePath, noteText } = params;
  await adminDb.collection(COLLECTIONS.FILE_SHARES).doc(pdfFileId).set({
    fileId: pdfFileId,
    createdBy: ctx.uid,
    createdAt: new Date(),
    isActive: false,
    requiresPassword: false,
    downloadCount: 0,
    maxDownloads: 0,
    companyId: ctx.companyId,
    [entityIdFsField]: entityId,
    showcaseMode: true,
    pdfStoragePath: storagePath,
    note: noteText,
  });
}

async function compensateClaim(
  adminDb: Firestore,
  pdfFileId: string,
  logger: Logger,
): Promise<void> {
  await adminDb
    .collection(COLLECTIONS.FILE_SHARES)
    .doc(pdfFileId)
    .delete()
    .catch((cleanupErr) => {
      logger.error('Failed to compensate orphan pre-upload claim', {
        pdfFileId,
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
}

// =============================================================================
// Factory
// =============================================================================

export function createShowcasePdfRoute<TData, TExtraBody extends Record<string, unknown> = {}>(
  config: CreateShowcasePdfRouteConfig<TData, TExtraBody>,
): ShowcasePdfRouteHandler {
  const logger = createModuleLogger(config.loggerName);
  const extraSchema = config.extraBodySchema ?? z.object({});
  const baseSchema = z.object({ locale: z.enum(['el', 'en']).optional() });
  const bodySchema = baseSchema.and(extraSchema).and(z.object({}).passthrough());

  async function handlePdf(
    req: NextRequest,
    ctx: AuthContext,
    entityId: string,
  ): Promise<NextResponse<ApiSuccessResponse<ShowcasePdfResponseBody>>> {
    let parsed: unknown = {};
    try {
      const raw = await req.text();
      if (raw.trim().length > 0) parsed = bodySchema.parse(JSON.parse(raw));
    } catch {
      throw new ApiError(400, 'Invalid request body');
    }
    const body = parsed as { locale?: ShowcasePdfLocale } & TExtraBody;
    const locale: ShowcasePdfLocale = body.locale ?? 'el';
    if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

    const adminDb = getAdminFirestore();
    if (!adminDb) throw new ApiError(503, 'Database connection not available');

    logger.info('Generating showcase PDF', {
      entityType: config.entityType, entityId, uid: ctx.uid, companyId: ctx.companyId,
    });

    const baseUrl = buildBaseUrl(req);
    const pdfData = await config.loadPdfData({
      entityId, ctx, locale, body, adminDb, baseUrl, logger,
    });

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await config.pdfService.generate(pdfData);
    } catch (err) {
      logger.error('PDF generation failed', {
        entityId, error: err instanceof Error ? err.message : String(err),
      });
      throw new ApiError(500, 'PDF generation failed');
    }

    const pdfFileId = generateShareId();
    const storagePath = buildStoragePath({
      companyId: ctx.companyId,
      entityType: config.entityType,
      entityId,
      domain: FILE_DOMAINS.SALES,
      category: FILE_CATEGORIES.DOCUMENTS,
      fileId: pdfFileId,
      ext: 'pdf',
    }).path;

    await writePreUploadClaim({
      adminDb, pdfFileId, ctx, entityId,
      entityIdFsField: config.entityIdFsField,
      storagePath,
      noteText: config.noteText,
    });

    try {
      await uploadPdfToStorage(pdfBytes, storagePath);
    } catch (err) {
      await compensateClaim(adminDb, pdfFileId, logger);
      logger.error('PDF upload failed', {
        entityId, storagePath, error: err instanceof Error ? err.message : String(err),
      });
      throw new ApiError(500, 'PDF upload failed');
    }

    const pdfRegeneratedAt = nowISO();
    logger.info('Showcase PDF ready', {
      entityType: config.entityType, entityId, storagePath, companyId: ctx.companyId,
    });

    return apiSuccess<ShowcasePdfResponseBody>(
      { pdfStoragePath: storagePath, pdfRegeneratedAt },
      'Showcase PDF generated',
    );
  }

  return {
    handle(request: NextRequest, entityId: string): Promise<Response> {
      if (!entityId || entityId.trim().length === 0) {
        return Promise.resolve(
          NextResponse.json({ error: 'Entity ID is required' }, { status: 400 }),
        );
      }
      const handler = withStandardRateLimit(
        withAuth<ApiSuccessResponse<ShowcasePdfResponseBody>>(
          async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
            return handlePdf(req, ctx, entityId);
          },
          { permissions: config.permission },
        ),
      );
      return handler(request);
    },
  };
}
