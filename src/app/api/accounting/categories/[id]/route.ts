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
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { UpdateCustomCategoryInput } from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('CUSTOM_CATEGORY_DETAIL');

// =============================================================================
// GET — Single Category
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const params = await segmentData?.params;
        const id = params?.id;
        if (!id) {
          return NextResponse.json({ error: 'Missing category ID' }, { status: 400 });
        }

        const { repository } = createAccountingServices();
        const category = await repository.getCustomCategory(id);

        if (!category) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json({ category });
      } catch (error) {
        logger.error('Failed to get custom category', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
  );

  return withStandardRateLimit(request, () => handler(request));
}

// =============================================================================
// PATCH — Update Category
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const params = await segmentData?.params;
        const id = params?.id;
        if (!id) {
          return NextResponse.json({ error: 'Missing category ID' }, { status: 400 });
        }

        const body = (await req.json()) as UpdateCustomCategoryInput;

        const { repository } = createAccountingServices();
        const existing = await repository.getCustomCategory(id);

        if (!existing) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        await repository.updateCustomCategory(id, body);

        logger.info('Custom category updated', { id });

        return NextResponse.json({ success: true });
      } catch (error) {
        logger.error('Failed to update custom category', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
  );

  return withSensitiveRateLimit(request, () => handler(request));
}

// =============================================================================
// DELETE — Soft or Hard Delete (ADR-ACC-021 §Απόφαση 7)
// =============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const params = await segmentData?.params;
        const id = params?.id;
        if (!id) {
          return NextResponse.json({ error: 'Missing category ID' }, { status: 400 });
        }

        const { repository } = createAccountingServices();
        const existing = await repository.getCustomCategory(id);

        if (!existing) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Check usage: does any journal entry use this category code?
        const entriesPage = await repository.listJournalEntries(
          { category: existing.code },
          1
        );
        const isUsed = entriesPage.total > 0;

        if (isUsed) {
          // Soft delete — deactivate only, preserve referential integrity
          await repository.updateCustomCategory(id, { isActive: false });
          logger.info('Custom category soft-deleted (in use)', {
            id,
            code: existing.code,
            entriesCount: entriesPage.total,
          });
          return NextResponse.json({
            action: 'soft_deleted' as const,
            message: `Η κατηγορία απενεργοποιήθηκε — χρησιμοποιείται σε ${entriesPage.total} εγγραφές`,
          });
        }

        // Hard delete — no references exist
        await repository.deleteCustomCategory(id);
        logger.info('Custom category hard-deleted (unused)', { id, code: existing.code });
        return NextResponse.json({
          action: 'hard_deleted' as const,
          message: 'Η κατηγορία διαγράφηκε οριστικά',
        });
      } catch (error) {
        logger.error('Failed to delete custom category', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
  );

  return withSensitiveRateLimit(request, () => handler(request));
}

// =============================================================================
// EXPORTS
// =============================================================================

export async function GET(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return handleGet(request, segmentData);
}

export async function PATCH(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return handlePatch(request, segmentData);
}

export async function DELETE(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return handleDelete(request, segmentData);
}
