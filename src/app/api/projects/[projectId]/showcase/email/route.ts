/**
 * POST /api/projects/[projectId]/showcase/email (ADR-316).
 *
 * Sends the project showcase as a branded HTML email. Body is rendered by the
 * `project-showcase-email` template and reads from the same SSoT snapshot +
 * media loaders that power the public `/shared/<token>` page and PDF, so all
 * three surfaces stay in lockstep.
 *
 * Symmetric to `src/app/api/properties/[id]/showcase/email/route.ts` (ADR-312
 * Phase 8).
 *
 * @module app/api/projects/[projectId]/showcase/email/route
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
import { buildProjectShowcaseSnapshot } from '@/services/project-showcase/snapshot-builder';
import { loadProjectShowcasePdfLabels } from '@/services/project-showcase/labels';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import { buildProjectShowcaseEmail } from '@/services/email-templates/project-showcase-email';
import type { ShowcaseEmailMedia } from '@/services/email-templates/showcase-email-shared';

const logger = createModuleLogger('ProjectShowcaseEmailRoute');

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
  projectId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<ShowcaseEmailMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId,
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
  projectId: string,
): Promise<NextResponse<ShowcaseEmailResponse>> {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');
  if (!projectId) throw new ApiError(400, 'Project id is required');

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

  const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  if (!projectDoc.exists) throw new ApiError(404, 'Project not found');
  const projectData = (projectDoc.data() ?? {}) as Record<string, unknown>;
  if ((projectData.companyId as string | undefined) !== ctx.companyId) {
    throw new ApiError(403, 'Tenant mismatch');
  }

  const snapshot = await buildProjectShowcaseSnapshot(projectId, locale, adminDb, ctx.companyId);
  const labels = loadProjectShowcasePdfLabels(locale);

  const [photos, floorplans] = await Promise.all([
    loadMedia(ctx.companyId, projectId, FILE_CATEGORIES.PHOTOS).catch(() => []),
    loadMedia(ctx.companyId, projectId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
  ]);

  const { subject, html, text } = buildProjectShowcaseEmail({
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
    logger.error('Project showcase email send failed', {
      projectId, recipient: body.recipient, error: result.error,
    });
    throw new ApiError(502, result.error ?? 'Email send failed');
  }

  safeFireAndForget(EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId,
    entityName: snapshot.project.name,
    action: 'email_sent',
    changes: [{
      field: 'showcase_email',
      oldValue: null,
      newValue: `${body.recipient} · ${subject}`,
      label: 'Αποστολή Παρουσίασης Έργου',
    }],
    performedBy: ctx.uid,
    performedByName: ctx.email ?? null,
    companyId: ctx.companyId,
  }), 'ProjectShowcaseEmail.auditTrail');

  logger.info('Project showcase email sent', {
    projectId, recipient: body.recipient, messageId: result.messageId,
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
  segmentData: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await segmentData.params;
  const handler = withAuth<ShowcaseEmailResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(req, ctx, projectId),
  );
  return withStandardRateLimit(handler)(request);
}
