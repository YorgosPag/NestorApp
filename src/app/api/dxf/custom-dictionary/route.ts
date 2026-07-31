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
import { createModuleLogger } from '@/lib/telemetry';
import {
  createCustomDictionaryEntry,
  listCustomDictionaryForCompany,
} from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.service';
import type { CreateCustomDictionaryEntryInput } from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.types';
import type { SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell/spell.types';
import {
  actorFromContext,
  runDictionaryRoute,
  serializeEntry,
} from './_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('CustomDictionaryListCreateRoute');

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  return runDictionaryRoute(
    request,
    {
      permissions: 'dxf:dictionary:view',
      onError: (err, ctx) =>
        logger.error('Failed to list custom dictionary entries', {
          companyId: ctx.companyId,
          err,
        }),
    },
    async (_req, ctx) => {
      const docs = await listCustomDictionaryForCompany(ctx.companyId);
      return NextResponse.json({
        success: true,
        entries: docs.map(serializeEntry),
      });
    },
  );
}

// ─── POST ────────────────────────────────────────────────────────────────────

interface CreateBody {
  readonly term?: unknown;
  readonly language?: unknown;
}

export async function POST(request: NextRequest) {
  return runDictionaryRoute(
    request,
    {
      permissions: 'dxf:text:edit',
      onError: (err, ctx) =>
        logger.warn('Failed to create custom dictionary entry', { uid: ctx.uid, err }),
    },
    async (req, ctx) => {
      const body = (await req.json()) as CreateBody;
      const input: CreateCustomDictionaryEntryInput = {
        companyId: ctx.companyId,
        term: typeof body.term === 'string' ? body.term : '',
        language: body.language as SpellLanguage,
      };
      const created = await createCustomDictionaryEntry(input, actorFromContext(ctx));
      return NextResponse.json({ success: true, entry: serializeEntry(created) }, { status: 201 });
    },
  );
}
