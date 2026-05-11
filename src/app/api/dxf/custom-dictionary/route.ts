/**
 * ADR-344 Phase 8 — `/api/dxf/custom-dictionary`
 *
 * GET  — list every custom dictionary entry owned by the caller's tenant
 *        Permission: `dxf:dictionary:view`
 * POST — create a new custom dictionary entry
 *        Permission: `dxf:text:edit` (low-bar — anyone who edits text can
 *        add terms; admin gating only kicks in for DELETE / PATCH)
 *
 * All writes flow through `custom-dictionary.service.ts` (admin SDK + audit).
 * The route never touches Firestore directly per CLAUDE.md N.6.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createCustomDictionaryEntry,
  listCustomDictionaryForCompany,
} from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.service';
import type { CreateCustomDictionaryEntryInput } from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.types';
import type { SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell/spell.types';
import {
  actorFromContext,
  errorResponse,
  serializeEntry,
} from './_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('CustomDictionaryListCreateRoute');

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const docs = await listCustomDictionaryForCompany(ctx.companyId);
          return NextResponse.json({
            success: true,
            entries: docs.map(serializeEntry),
          });
        } catch (err) {
          logger.error('Failed to list custom dictionary entries', {
            companyId: ctx.companyId,
            err,
          });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:dictionary:view' },
    ),
  );
  return handler(request);
}

// ─── POST ────────────────────────────────────────────────────────────────────

interface CreateBody {
  readonly term?: unknown;
  readonly language?: unknown;
}

export async function POST(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const body = (await req.json()) as CreateBody;
          const input: CreateCustomDictionaryEntryInput = {
            companyId: ctx.companyId,
            term: typeof body.term === 'string' ? body.term : '',
            language: body.language as SpellLanguage,
          };
          const created = await createCustomDictionaryEntry(input, actorFromContext(ctx));
          return NextResponse.json(
            { success: true, entry: serializeEntry(created) },
            { status: 201 },
          );
        } catch (err) {
          logger.warn('Failed to create custom dictionary entry', { uid: ctx.uid, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:text:edit' },
    ),
  );
  return handler(request);
}
