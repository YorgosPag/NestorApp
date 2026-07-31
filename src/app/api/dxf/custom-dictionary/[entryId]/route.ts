/**
 * ADR-344 Phase 8 — `/api/dxf/custom-dictionary/[entryId]`
 *
 * GET    — read one custom dictionary entry        — `dxf:dictionary:view`
 * PATCH  — update term / language                  — `dxf:dictionary:manage`
 * DELETE — remove (audit-logged in the service)    — `dxf:dictionary:manage`
 *
 * Permission split (industry pattern: Microsoft 365 / Google Workspace /
 * AutoCAD enterprise): ADD is low-bar, EDIT and DELETE are admin-only.
 *
 * Tenant isolation handled inside `custom-dictionary.service.ts`. Το
 * `CustomDictionaryCrossTenantError` **δεν** βγαίνει αυτούσιο: το `_helpers`
 * εφαρμόζει την απόφαση αποκάλυψης του ADR-742 — bypass ρόλος βλέπει `403`,
 * κάθε άλλος παίρνει `404` **πανομοιότυπο** με το γνήσιο «δεν βρέθηκε».
 */
import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import {
  deleteCustomDictionaryEntry,
  getCustomDictionaryEntryById,
  updateCustomDictionaryEntry,
} from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.service';
import type { UpdateCustomDictionaryEntryInput } from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.types';
import type { SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell/spell.types';
import {
  actorFromContext,
  runDictionaryRoute,
  serializeEntry,
} from '../_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('CustomDictionaryItemRoute');

type SegmentData = { params: Promise<{ entryId: string }> };

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, segmentData: SegmentData) {
  const { entryId } = await segmentData.params;
  return runDictionaryRoute(
    request,
    {
      permissions: 'dxf:dictionary:view',
      onError: (err) => logger.warn('Failed to read custom dictionary entry', { entryId, err }),
    },
    async (_req, ctx) => {
      const doc = await getCustomDictionaryEntryById(ctx.companyId, entryId);
      return NextResponse.json({ success: true, entry: serializeEntry(doc) });
    },
  );
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

interface PatchBody {
  readonly term?: unknown;
  readonly language?: unknown;
}

export async function PATCH(request: NextRequest, segmentData: SegmentData) {
  const { entryId } = await segmentData.params;
  return runDictionaryRoute(
    request,
    {
      permissions: 'dxf:dictionary:manage',
      onError: (err) => logger.warn('Failed to update custom dictionary entry', { entryId, err }),
    },
    async (req, ctx) => {
      const body = (await req.json()) as PatchBody;
      const patch: UpdateCustomDictionaryEntryInput = {
        ...(typeof body.term === 'string' ? { term: body.term } : {}),
        ...(body.language !== undefined ? { language: body.language as SpellLanguage } : {}),
      };
      const updated = await updateCustomDictionaryEntry(
        ctx.companyId,
        entryId,
        patch,
        actorFromContext(ctx),
      );
      return NextResponse.json({ success: true, entry: serializeEntry(updated) });
    },
  );
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, segmentData: SegmentData) {
  const { entryId } = await segmentData.params;
  return runDictionaryRoute(
    request,
    {
      permissions: 'dxf:dictionary:manage',
      onError: (err) => logger.warn('Failed to delete custom dictionary entry', { entryId, err }),
    },
    async (_req, ctx) => {
      await deleteCustomDictionaryEntry(ctx.companyId, entryId, actorFromContext(ctx));
      return NextResponse.json({ success: true, deleted: true, entryId });
    },
  );
}
