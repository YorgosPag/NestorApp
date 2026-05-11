/**
 * ADR-344 Phase 7.D — `/api/dxf/text-templates/[templateId]`
 *
 * GET    — read one user template
 * PATCH  — update (name / category / content)
 * DELETE — remove (audit-logged in the service)
 *
 * Tenant isolation handled inside `text-template.service.ts`:
 * `TextTemplateCrossTenantError` becomes a 403 here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  deleteTextTemplate,
  getTextTemplateById,
  updateTextTemplate,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template.service';
import type { UpdateTextTemplateInput } from '@/subapps/dxf-viewer/text-engine/templates/text-template.types';
import {
  actorFromContext,
  errorResponse,
  serializeTemplate,
} from '../_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('TextTemplatesItemRoute');

type SegmentData = { params: Promise<{ templateId: string }> };

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, segmentData: SegmentData) {
  const { templateId } = await segmentData.params;
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const doc = await getTextTemplateById(ctx.companyId, templateId);
          return NextResponse.json({ success: true, template: serializeTemplate(doc) });
        } catch (err) {
          logger.warn('Failed to read text template', { templateId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:files:view' },
    ),
  );
  return handler(request);
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

interface PatchBody {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly content?: unknown;
}

export async function PATCH(request: NextRequest, segmentData: SegmentData) {
  const { templateId } = await segmentData.params;
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const body = (await req.json()) as PatchBody;
          const patch: UpdateTextTemplateInput = {
            ...(typeof body.name === 'string' ? { name: body.name } : {}),
            ...(body.category !== undefined
              ? { category: body.category as UpdateTextTemplateInput['category'] }
              : {}),
            ...(body.content !== undefined
              ? { content: body.content as UpdateTextTemplateInput['content'] }
              : {}),
          };
          const updated = await updateTextTemplate(
            ctx.companyId,
            templateId,
            patch,
            actorFromContext(ctx),
          );
          return NextResponse.json({ success: true, template: serializeTemplate(updated) });
        } catch (err) {
          logger.warn('Failed to update text template', { templateId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:text:edit' },
    ),
  );
  return handler(request);
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, segmentData: SegmentData) {
  const { templateId } = await segmentData.params;
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          await deleteTextTemplate(ctx.companyId, templateId, actorFromContext(ctx));
          return NextResponse.json({ success: true, deleted: true, templateId });
        } catch (err) {
          logger.warn('Failed to delete text template', { templateId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:text:delete' },
    ),
  );
  return handler(request);
}
