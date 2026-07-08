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
 * Rate: GET → standard | PATCH/DELETE → sensitive
 *
 * @module api/accounting/categories/[id]
 * @enterprise ADR-ACC-021 Custom Expense/Income Categories
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAuditEvent, logEntityDeletion } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createModuleLogger } from '@/lib/telemetry/Logger';

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

/** Resolve the repository + load the category, or throw a 404 (shared by all verbs). */
async function loadCategoryOr404(auth: AuthContext, id: string) {
  const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
  const existing = await repository.getCustomCategory(id);
  if (!existing) {
    notFound('Category not found');
  }
  return { repository, existing };
}

// =============================================================================
// GET — Single Category
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get custom category',
  handler: async ({ auth, params }) => {
    const { existing } = await loadCategoryOr404(auth, params.id);
    return ok(existing);
  },
});

// =============================================================================
// PATCH — Update Category
// =============================================================================

export const PATCH = defineRoute({
  rateLimit: 'sensitive',
  schema: UpdateCategorySchema,
  fallbackError: 'Failed to update custom category',
  handler: async ({ auth, body, params }) => {
    const { id } = params;
    const { repository, existing } = await loadCategoryOr404(auth, id);

    await repository.updateCustomCategory(id, body);

    await logAuditEvent(auth, 'data_updated', id, 'category', {
      metadata: { reason: `Custom category updated (code: ${existing.code})` },
    }).catch(() => {/* non-blocking */});

    logger.info('Custom category updated', { id });

    return ok();
  },
});

// =============================================================================
// DELETE — Soft or Hard Delete (ADR-ACC-021 §Απόφαση 7)
// =============================================================================

export const DELETE = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete custom category',
  handler: async ({ auth, params }) => {
    const { id } = params;
    const { repository, existing } = await loadCategoryOr404(auth, id);

    // Check usage: does any journal entry reference this category code?
    const entriesPage = await repository.listJournalEntries({ category: existing.code }, 1);
    const isUsed = entriesPage.items.length > 0;

    if (isUsed) {
      // Soft delete — deactivate only, preserve referential integrity
      await repository.updateCustomCategory(id, { isActive: false });
      await logEntityDeletion(auth, 'category', id).catch(() => {/* non-blocking */});
      logger.info('Custom category soft-deleted (in use)', { id, code: existing.code });
      return NextResponse.json({
        success: true,
        action: 'soft_deleted' as const,
        message: 'Η κατηγορία απενεργοποιήθηκε — χρησιμοποιείται σε υπάρχουσες εγγραφές',
      });
    }

    // Hard delete — no references exist
    await logEntityDeletion(auth, 'category', id).catch(() => {/* non-blocking */});
    await repository.deleteCustomCategory(id);
    logger.info('Custom category hard-deleted (unused)', { id, code: existing.code });
    return NextResponse.json({
      success: true,
      action: 'hard_deleted' as const,
      message: 'Η κατηγορία διαγράφηκε οριστικά',
    });
  },
});
