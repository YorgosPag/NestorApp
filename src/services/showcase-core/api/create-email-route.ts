/**
 * =============================================================================
 * SHOWCASE CORE — Authenticated Email Route Factory (ADR-321 Phase 1.4b)
 * =============================================================================
 *
 * Config-driven generic that produces `POST /api/{collection}/[id]/showcase/
 * email` handlers. Extracted from the 3 legacy routes (property / project /
 * building), which were 95 %-identical around:
 *
 *   1. Parse+validate the body (Zod): recipient + optional shareUrl + locale
 *      + personalMessage.
 *   2. Assert tenant context (companyId).
 *   3. Delegate to the surface-specific `loadEmail` hook — it builds the
 *      snapshot, loads media, runs its own tenant check (snapshot builders
 *      already do it belt-and-suspenders per Phase 1.1), and returns the
 *      Mailgun-ready email bundle + audit metadata + media counts.
 *   4. Send via `sendReplyViaMailgun`.
 *   5. Record an entity-audit `email_sent` entry (fire-and-forget —
 *      non-blocking; ADR-195 uses `EntityAuditService`).
 *   6. Log + respond `{ emailSent, messageId, recipient }`.
 *
 * The factory returns an already-wrapped `POST` handler via
 * `withAuth + withStandardRateLimit`. Route files extract the entity id from
 * the segment params and forward.
 *
 * @module services/showcase-core/api/create-email-route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger, type Logger } from '@/lib/telemetry/Logger';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { EntityAuditService } from '@/services/entity-audit.service';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';

// =============================================================================
// Public contracts
// =============================================================================

export type ShowcaseEmailLocale = 'el' | 'en';

export interface ShowcaseEmailResponseBody {
  emailSent: boolean;
  messageId?: string;
  recipient: string;
}

export interface ShowcaseEmailBaseBody {
  recipient: string;
  shareUrl?: string;
  locale?: ShowcaseEmailLocale;
  personalMessage?: string;
}

export interface ShowcaseBuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ShowcaseEmailLoadResult {
  built: ShowcaseBuiltEmail;
  /** Human-readable entity name used in the audit trail. */
  auditEntityName: string;
  /** Media counts reported in the success log. */
  mediaCounts: { photos: number; floorplans: number };
}

export interface LoadShowcaseEmailParams<TExtraBody> {
  entityId: string;
  ctx: AuthContext;
  locale: ShowcaseEmailLocale;
  body: ShowcaseEmailBaseBody & TExtraBody;
  adminDb: Firestore;
  logger: Logger;
}

export interface CreateShowcaseEmailRouteConfig<TExtraBody extends Record<string, unknown> = {}> {
  /** Used for audit-trail `entityType` + structured logs. */
  entityType: string;
  /** Module-logger name (e.g. `'BuildingShowcaseEmailRoute'`). */
  loggerName: string;
  /**
   * Human label stored on the audit `changes[0].label` (Greek, e.g.
   * `'Αποστολή Παρουσίασης Κτηρίου'`). Matches the legacy routes 1:1.
   */
  auditLabel: string;
  /** Optional extra body schema merged on top of the base shape. */
  extraBodySchema?: ZodTypeAny;
  /**
   * Optional permission for `withAuth`. The 3 legacy routes call `withAuth`
   * without explicit permissions — leave undefined to match that behaviour.
   */
  permission?: string;
  /** Surface-specific email builder — also owns tenant check + media load. */
  loadEmail: (
    params: LoadShowcaseEmailParams<TExtraBody>,
  ) => Promise<ShowcaseEmailLoadResult>;
}

export interface ShowcaseEmailRouteHandler {
  handle(request: NextRequest, entityId: string): Promise<Response>;
}

// =============================================================================
// Internal helpers
// =============================================================================

const BASE_BODY_SCHEMA = z.object({
  recipient: z.string().email('recipient must be a valid email address'),
  shareUrl: z.string().url().optional(),
  locale: z.enum(['el', 'en']).optional(),
  personalMessage: z.string().max(500).optional(),
});

function zodErrorMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => i.message).join('; ');
  }
  return 'Invalid body';
}

interface FireAuditParams {
  entityType: string;
  entityId: string;
  entityName: string;
  recipient: string;
  subject: string;
  auditLabel: string;
  ctx: AuthContext;
  loggerName: string;
}

function fireAuditTrail(params: FireAuditParams): void {
  const { entityType, entityId, entityName, recipient, subject, auditLabel, ctx, loggerName } = params;
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType,
      entityId,
      entityName,
      action: 'email_sent',
      changes: [{
        field: 'showcase_email',
        oldValue: null,
        newValue: `${recipient} · ${subject}`,
        label: auditLabel,
      }],
      performedBy: ctx.uid,
      performedByName: ctx.email ?? null,
      companyId: ctx.companyId!,
    }),
    `${loggerName}.auditTrail`,
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createShowcaseEmailRoute<TExtraBody extends Record<string, unknown> = {}>(
  config: CreateShowcaseEmailRouteConfig<TExtraBody>,
): ShowcaseEmailRouteHandler {
  const logger = createModuleLogger(config.loggerName);
  const bodySchema = config.extraBodySchema
    ? BASE_BODY_SCHEMA.and(config.extraBodySchema)
    : BASE_BODY_SCHEMA;

  async function handle(
    request: NextRequest,
    ctx: AuthContext,
    entityId: string,
  ): Promise<NextResponse<ApiSuccessResponse<ShowcaseEmailResponseBody>>> {
    if (!ctx.companyId) throw new ApiError(403, 'Missing company context');
    if (!entityId) throw new ApiError(400, 'Entity id is required');

    let parsed: unknown;
    try {
      parsed = bodySchema.parse(await request.json());
    } catch (err) {
      throw new ApiError(400, zodErrorMessage(err));
    }
    const body = parsed as ShowcaseEmailBaseBody & TExtraBody;

    const locale: ShowcaseEmailLocale = body.locale ?? 'el';
    const adminDb = getAdminFirestore();
    if (!adminDb) throw new ApiError(503, 'Database connection not available');

    const { built, auditEntityName, mediaCounts } = await config.loadEmail({
      entityId, ctx, locale, body, adminDb, logger,
    });

    const result = await sendReplyViaMailgun({
      to: body.recipient,
      subject: built.subject,
      textBody: built.text,
      htmlBody: built.html,
    });

    if (!result.success) {
      logger.error('Showcase email send failed', {
        entityType: config.entityType, entityId,
        recipient: body.recipient, error: result.error,
      });
      throw new ApiError(502, result.error ?? 'Email send failed');
    }

    fireAuditTrail({
      entityType: config.entityType,
      entityId,
      entityName: auditEntityName,
      recipient: body.recipient,
      subject: built.subject,
      auditLabel: config.auditLabel,
      ctx,
      loggerName: config.loggerName,
    });

    logger.info('Showcase email sent', {
      entityType: config.entityType, entityId,
      recipient: body.recipient, messageId: result.messageId,
      photoCount: mediaCounts.photos, floorplanCount: mediaCounts.floorplans,
    });

    return apiSuccess<ShowcaseEmailResponseBody>({
      emailSent: true,
      messageId: result.messageId,
      recipient: body.recipient,
    });
  }

  return {
    handle(request: NextRequest, entityId: string): Promise<Response> {
      const authOptions = config.permission ? { permissions: config.permission } : undefined;
      const wrapped = withAuth<ApiSuccessResponse<ShowcaseEmailResponseBody>>(
        async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
          handle(req, ctx, entityId),
        authOptions,
      );
      return withStandardRateLimit(wrapped)(request);
    },
  };
}
