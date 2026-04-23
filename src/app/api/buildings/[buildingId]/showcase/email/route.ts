/**
 * POST /api/buildings/[buildingId]/showcase/email (ADR-320).
 *
 * Sends the building showcase as a branded HTML email. Body is rendered by the
 * `building-showcase-email` template and reads from the same SSoT snapshot +
 * media loaders that power the public `/shared/<token>` page and PDF, so all
 * three surfaces stay in lockstep.
 *
 * Symmetric to `src/app/api/projects/[projectId]/showcase/email/route.ts`.
 *
 * @module app/api/buildings/[buildingId]/showcase/email/route
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { EntityAuditService } from '@/services/entity-audit.service';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import { loadBuildingShowcasePdfLabels } from '@/services/building-showcase/labels';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import { buildBuildingShowcaseEmail } from '@/services/email-templates/building-showcase-email';
import type { ShowcaseEmailMedia } from '@/services/email-templates/showcase-email-shared';

const logger = createModuleLogger('BuildingShowcaseEmailRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  recipient: z.string().email('recipient must be a valid email address'),
  shareUrl: z.string().url().optional(),
  locale: z.enum(['el', 'en']).optional(),
  personalMessage: z.string().max(500).optional(),
});

type ShowcaseEmailResponse = ApiSuccessResponse<{
  emailSent: boolean;
  messageId?: string;
  recipient: string;
}>;

async function loadMedia(
  companyId: string,
  buildingId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<ShowcaseEmailMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    category,
    limit: 30,
  });
  return metas
    .filter((m) => m.downloadUrl)
    .map<ShowcaseEmailMedia>((m) => ({
      id: m.id,
      url: m.downloadUrl!,
      displayName: m.displayName || m.originalFilename || null,
    }));
}

async function handle(
  request: NextRequest,
  ctx: AuthContext,
  buildingId: string,
): Promise<NextResponse<ShowcaseEmailResponse>> {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');
  if (!buildingId) throw new ApiError(400, 'Building id is required');

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map((i) => i.message).join('; ') : 'Invalid body';
    throw new ApiError(400, msg);
  }

  const locale = body.locale ?? 'el';
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');

  const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
  if (!buildingDoc.exists) throw new ApiError(404, 'Building not found');
  const buildingData = (buildingDoc.data() ?? {}) as Record<string, unknown>;
  if ((buildingData.companyId as string | undefined) !== ctx.companyId) {
    throw new ApiError(403, 'Tenant mismatch');
  }

  const snapshot = await buildBuildingShowcaseSnapshot(buildingId, locale, adminDb, ctx.companyId);
  const labels = loadBuildingShowcasePdfLabels(locale);

  const [photos, floorplans] = await Promise.all([
    loadMedia(ctx.companyId, buildingId, FILE_CATEGORIES.PHOTOS).catch(() => []),
    loadMedia(ctx.companyId, buildingId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
  ]);

  const { subject, html, text } = buildBuildingShowcaseEmail({
    snapshot,
    labels,
    photos,
    floorplans,
    shareUrl: body.shareUrl,
    personalMessage: body.personalMessage,
  });

  const result = await sendReplyViaMailgun({
    to: body.recipient,
    subject,
    textBody: text,
    htmlBody: html,
  });

  if (!result.success) {
    logger.error('Building showcase email send failed', {
      buildingId, recipient: body.recipient, error: result.error,
    });
    throw new ApiError(502, result.error ?? 'Email send failed');
  }

  safeFireAndForget(EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    entityName: snapshot.building.name,
    action: 'email_sent',
    changes: [{
      field: 'showcase_email',
      oldValue: null,
      newValue: `${body.recipient} · ${subject}`,
      label: 'Αποστολή Παρουσίασης Κτηρίου',
    }],
    performedBy: ctx.uid,
    performedByName: ctx.email ?? null,
    companyId: ctx.companyId,
  }), 'BuildingShowcaseEmail.auditTrail');

  logger.info('Building showcase email sent', {
    buildingId, recipient: body.recipient, messageId: result.messageId,
    photoCount: photos.length, floorplanCount: floorplans.length,
  });

  return apiSuccess({
    emailSent: true,
    messageId: result.messageId,
    recipient: body.recipient,
  });
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await segmentData.params;
  const handler = withAuth<ShowcaseEmailResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(req, ctx, buildingId),
  );
  return withStandardRateLimit(handler)(request);
}
