/**
 * =============================================================================
 * GET    /api/accounting/categories/[id] — Get Custom Category
 * PATCH  /api/accounting/categories/[id] — Update Custom Category
 * DELETE /api/accounting/categories/[id] — Delete Custom Category
 * =============================================================================
 *
 * GET: Επιστρέφει μία custom category βάσει ID.
 *
 * PATCH: Ενημερώνει mutable fields.
 *   Immutable: categoryId, code, createdAt (απορρίπτονται αν σταλούν)
 *
 * DELETE (ADR-ACC-021 §Απόφαση 7):
 *   - Αν category χρησιμοποιείται σε journal entries → soft delete (isActive=false)
 *   - Αν category ΔΕΝ χρησιμοποιείται → hard delete (οριστική διαγραφή)
 *   Response includes `action: 'soft_deleted' | 'hard_deleted'`
 *
 * Auth: withAuth (authenticated users)
 * Rate: GET → withStandardRateLimit | PATCH/DELETE → withSensitiveRateLimit
 *
 * @module api/accounting/categories/[id]
 * @enterprise ADR-ACC-021 Custom Expense/Income Categories
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent, logEntityDeletion } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateCategorySchema = z.object({
  label: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  vatDeductible: z.boolean().optional(),
  vatDeductiblePercent: z.union([z.literal(0), z.literal(50), z.literal(100)]).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  icon: z.string().max(50).optional(),
  kadCode: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
}).passthrough();

const logger = createModuleLogger('CUSTOM_CATEGORY_DETAIL');

// =============================================================================
// GET — Single Category
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const category = await repository.getCustomCategory(id);

        if (!category) {
          return NextResponse.json(
            { success: false, error: 'Category not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: category });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get custom category');
        logger.error('Custom category get error', { id, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// =============================================================================
// PATCH — Update Category
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateCategorySchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const existing = await repository.getCustomCategory(id);

        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Category not found' },
            { status: 404 }
          );
        }

        await repository.updateCustomCategory(id, body);

        await logAuditEvent(ctx, 'data_updated', id, 'category', {
          metadata: { reason: `Custom category updated (code: ${existing.code})` },
        }).catch(() => {/* non-blocking */});

        logger.info('Custom category updated', { id });

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update custom category');
        logger.error('Custom category update error', { id, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// =============================================================================
// DELETE — Soft or Hard Delete (ADR-ACC-021 §Απόφαση 7)
// =============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const existing = await repository.getCustomCategory(id);

        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Category not found' },
            { status: 404 }
          );
        }

        // Check usage: does any journal entry reference this category code?
        const entriesPage = await repository.listJournalEntries(
          { category: existing.code },
          1
        );
        const isUsed = entriesPage.items.length > 0;

        if (isUsed) {
          // Soft delete — deactivate only, preserve referential integrity
          await repository.updateCustomCategory(id, { isActive: false });
          await logEntityDeletion(ctx, 'category', id).catch(() => {/* non-blocking */});
          logger.info('Custom category soft-deleted (in use)', { id, code: existing.code });
          return NextResponse.json({
            success: true,
            action: 'soft_deleted' as const,
            message: 'Η κατηγορία απενεργοποιήθηκε — χρησιμοποιείται σε υπάρχουσες εγγραφές',
          });
        }

        // Hard delete — no references exist
        await logEntityDeletion(ctx, 'category', id).catch(() => {/* non-blocking */});
        await repository.deleteCustomCategory(id);
        logger.info('Custom category hard-deleted (unused)', { id, code: existing.code });
        return NextResponse.json({
          success: true,
          action: 'hard_deleted' as const,
          message: 'Η κατηγορία διαγράφηκε οριστικά',
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to delete custom category');
        logger.error('Custom category delete error', { id, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// =============================================================================
// EXPORTS
// =============================================================================

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
