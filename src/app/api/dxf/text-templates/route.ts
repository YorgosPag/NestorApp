/**
 * ADR-344 Phase 7.D — `/api/dxf/text-templates`
 *
 * GET  — list every user template owned by the caller's tenant
 * POST — create a new user template
 *
 * Built-in templates live in TypeScript (`BUILT_IN_TEXT_TEMPLATES`) and are
 * NOT served by this endpoint. Clients import them directly.
 *
 * All writes flow through `text-template.service.ts` (admin SDK + audit).
 * The route never touches Firestore directly per CLAUDE.md N.6.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createTextTemplate,
  listTextTemplatesForCompany,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template.service';
import type { CreateTextTemplateInput } from '@/subapps/dxf-viewer/text-engine/templates/text-template.types';
import {
  actorFromContext,
  errorResponse,
  serializeTemplate,
} from './_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('TextTemplatesListCreateRoute');

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const docs = await listTextTemplatesForCompany(ctx.companyId);
          return NextResponse.json({
            success: true,
            templates: docs.map(serializeTemplate),
          });
        } catch (err) {
          logger.error('Failed to list text templates', { companyId: ctx.companyId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:files:view' },
    ),
  );
  return handler(request);
}

// ─── POST ────────────────────────────────────────────────────────────────────

interface CreateBody {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly content?: unknown;
  /** ADR-651 Φάση Θ — βιβλιοθήκη γραφείου/έργου/μου. Zod απορρίπτει το `system` (seed-only). */
  readonly scope?: unknown;
  readonly projectId?: unknown;
  readonly parentId?: unknown;
  readonly parentSyncedAt?: unknown;
  readonly titleBlock?: unknown;
}

/** Περνά το πεδίο μόνο αν υπάρχει — ο Zod schema του service είναι `.strict()`. */
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const body = (await req.json()) as CreateBody;
          const scope = optionalString(body.scope) as CreateTextTemplateInput['scope'];
          const projectId = optionalString(body.projectId);
          const parentId = optionalString(body.parentId);
          const parentSyncedAt = optionalNumber(body.parentSyncedAt);
          const input: CreateTextTemplateInput = {
            companyId: ctx.companyId,
            name: typeof body.name === 'string' ? body.name : '',
            category: body.category as CreateTextTemplateInput['category'],
            content: body.content as CreateTextTemplateInput['content'],
            ...(scope ? { scope } : {}),
            ...(projectId ? { projectId } : {}),
            ...(parentId ? { parentId } : {}),
            ...(parentSyncedAt !== undefined ? { parentSyncedAt } : {}),
            ...(body.titleBlock !== undefined
              ? { titleBlock: body.titleBlock as CreateTextTemplateInput['titleBlock'] }
              : {}),
          };
          const created = await createTextTemplate(input, actorFromContext(ctx));
          return NextResponse.json(
            { success: true, template: serializeTemplate(created) },
            { status: 201 },
          );
        } catch (err) {
          logger.warn('Failed to create text template', { uid: ctx.uid, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:text:create' },
    ),
  );
  return handler(request);
}
