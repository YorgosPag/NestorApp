/**
 * POST /api/properties/[id]/showcase/email (ADR-312 Phase 8)
 *
 * Sends the full property showcase as a branded HTML email. The body is
 * rendered by the `property-showcase-email` template and reads from the same
 * SSoT snapshot/media loaders that power the web view + PDF, so all three
 * surfaces stay in lockstep.
 *
 * @module app/api/properties/[id]/showcase/email/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { EntityAuditService } from '@/services/entity-audit.service';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildPropertyShowcaseSnapshot,
  loadShowcaseRelations,
} from '@/services/property-showcase/snapshot-builder';
import { loadShowcasePdfLabels } from '@/services/property-showcase/labels';
import {
  loadFilesByCategory,
  loadLinkedSpaceFloorplans,
  loadPropertyFloorFloorplans,
} from '@/app/api/showcase/[token]/helpers';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { buildShowcaseEmail } from '@/services/email-templates/property-showcase-email';

const logger = createModuleLogger('PropertyShowcaseEmailRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  recipient: z.string().email('recipient must be a valid email address'),
  shareUrl: z.string().url().optional(),
  locale: z.enum(['el', 'en']).optional(),
});

type ShowcaseEmailResponse = ApiSuccessResponse<{
  emailSent: boolean;
  messageId?: string;
  recipient: string;
}>;

async function handle(
  request: NextRequest,
  ctx: AuthContext,
  propertyId: string,
): Promise<NextResponse<ShowcaseEmailResponse>> {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');
  if (!propertyId) throw new ApiError(400, 'Property id is required');

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

  const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!propertyDoc.exists) throw new ApiError(404, 'Property not found');
  const propertyData = (propertyDoc.data() ?? {}) as Record<string, unknown>;
  if ((propertyData.companyId as string | undefined) !== ctx.companyId) {
    throw new ApiError(403, 'Tenant mismatch');
  }

  const branding = await resolveShowcaseCompanyBranding({
    adminDb,
    propertyData,
    companyId: ctx.companyId,
  });

  const context = await loadShowcaseRelations({
    adminDb,
    propertyId,
    property: propertyData,
    branding,
  });

  const [photos, floorplans, linkedSpaceFloorplans, propertyFloorFloorplans] = await Promise.all([
    loadFilesByCategory(ctx.companyId, propertyId, FILE_CATEGORIES.PHOTOS),
    loadFilesByCategory(ctx.companyId, propertyId, FILE_CATEGORIES.FLOORPLANS),
    loadLinkedSpaceFloorplans(ctx.companyId, context).catch(() => ({ parking: [], storage: [] })),
    loadPropertyFloorFloorplans(ctx.companyId, context).catch(() => undefined),
  ]);

  const snapshot = buildPropertyShowcaseSnapshot(context, locale);
  const labels = loadShowcasePdfLabels(locale);

  const { subject, html, text } = buildShowcaseEmail({
    snapshot,
    labels,
    photos,
    floorplans,
    propertyFloorFloorplans,
    linkedSpaceFloorplans:
      linkedSpaceFloorplans.parking.length > 0 || linkedSpaceFloorplans.storage.length > 0
        ? linkedSpaceFloorplans
        : undefined,
    shareUrl: body.shareUrl,
  });

  const result = await sendReplyViaMailgun({
    to: body.recipient,
    subject,
    textBody: text,
    htmlBody: html,
  });

  if (!result.success) {
    logger.error('Showcase email send failed', {
      propertyId, recipient: body.recipient, error: result.error,
    });
    throw new ApiError(502, result.error ?? 'Email send failed');
  }

  safeFireAndForget(EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    entityName: snapshot.property.name,
    action: 'email_sent',
    changes: [{
      field: 'showcase_email',
      oldValue: null,
      newValue: `${body.recipient} · ${subject}`,
      label: 'Αποστολή Παρουσίασης',
    }],
    performedBy: ctx.uid,
    performedByName: ctx.email ?? null,
    companyId: ctx.companyId,
  }), 'PropertyShowcaseEmail.auditTrail');

  logger.info('Showcase email sent', {
    propertyId, recipient: body.recipient, messageId: result.messageId,
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
  segmentData: { params: Promise<{ id: string }> },
) {
  const { id } = await segmentData.params;
  const handler = withAuth<ShowcaseEmailResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handle(req, ctx, id),
  );
  return withStandardRateLimit(handler)(request);
}
