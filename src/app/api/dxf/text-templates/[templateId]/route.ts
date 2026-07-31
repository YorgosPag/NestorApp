/**
 * ADR-344 Phase 7.D — `/api/dxf/text-templates/[templateId]`
 *
 * GET    — read one user template
 * PATCH  — update (name / category / content)
 * DELETE — remove (audit-logged in the service)
 *
 * Tenant isolation handled inside `text-template.service.ts`. Το
 * `TextTemplateCrossTenantError` **δεν** βγαίνει αυτούσιο: το `_helpers`
 * εφαρμόζει την απόφαση αποκάλυψης του ADR-742 — bypass ρόλος βλέπει `403`,
 * κάθε άλλος παίρνει `404` **πανομοιότυπο** με το γνήσιο «δεν βρέθηκε».
 */
import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import {
  deleteTextTemplate,
  getTextTemplateById,
  updateTextTemplate,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template.service';
import type { UpdateTextTemplateInput } from '@/subapps/dxf-viewer/text-engine/templates/text-template.types';
import {
  actorFromContext,
  runTemplateRoute,
  serializeTemplate,
} from '../_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('TextTemplatesItemRoute');

type SegmentData = { params: Promise<{ templateId: string }> };

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, segmentData: SegmentData) {
  const { templateId } = await segmentData.params;
  return runTemplateRoute(
    request,
    {
      permissions: 'dxf:files:view',
      onError: (err) => logger.warn('Failed to read text template', { templateId, err }),
    },
    async (_req, ctx) => {
      const doc = await getTextTemplateById(ctx.companyId, templateId);
      return NextResponse.json({ success: true, template: serializeTemplate(doc) });
    },
  );
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

interface PatchBody {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly content?: unknown;
  /** ADR-651 Φάση Θ — «δημοσίευση» σε άλλο scope: ίδιο doc, ΟΧΙ αντίγραφο (ADR-652 M3). */
  readonly scope?: unknown;
  readonly projectId?: unknown;
  readonly parentSyncedAt?: unknown;
  readonly titleBlock?: unknown;
}

export async function PATCH(request: NextRequest, segmentData: SegmentData) {
  const { templateId } = await segmentData.params;
  return runTemplateRoute(
    request,
    {
      permissions: 'dxf:text:edit',
      onError: (err) => logger.warn('Failed to update text template', { templateId, err }),
    },
    async (req, ctx) => {
      const body = (await req.json()) as PatchBody;
      const patch: UpdateTextTemplateInput = {
        ...(typeof body.name === 'string' ? { name: body.name } : {}),
        ...(body.category !== undefined
          ? { category: body.category as UpdateTextTemplateInput['category'] }
          : {}),
        ...(body.content !== undefined
          ? { content: body.content as UpdateTextTemplateInput['content'] }
          : {}),
        ...(typeof body.scope === 'string'
          ? { scope: body.scope as UpdateTextTemplateInput['scope'] }
          : {}),
        ...(typeof body.projectId === 'string' ? { projectId: body.projectId } : {}),
        ...(typeof body.parentSyncedAt === 'number' && Number.isFinite(body.parentSyncedAt)
          ? { parentSyncedAt: body.parentSyncedAt }
          : {}),
        ...(body.titleBlock !== undefined
          ? { titleBlock: body.titleBlock as UpdateTextTemplateInput['titleBlock'] }
          : {}),
      };
      const updated = await updateTextTemplate(
        ctx.companyId,
        templateId,
        patch,
        actorFromContext(ctx),
      );
      return NextResponse.json({ success: true, template: serializeTemplate(updated) });
    },
  );
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, segmentData: SegmentData) {
  const { templateId } = await segmentData.params;
  return runTemplateRoute(
    request,
    {
      permissions: 'dxf:text:delete',
      onError: (err) => logger.warn('Failed to delete text template', { templateId, err }),
    },
    async (_req, ctx) => {
      await deleteTextTemplate(ctx.companyId, templateId, actorFromContext(ctx));
      return NextResponse.json({ success: true, deleted: true, templateId });
    },
  );
}
