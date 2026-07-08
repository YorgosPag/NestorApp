/**
 * =============================================================================
 * GET  /api/accounting/categories — List Custom Categories
 * POST /api/accounting/categories — Create Custom Category
 * =============================================================================
 *
 * GET: Επιστρέφει τις user-defined custom categories (active by default).
 *   ?includeInactive=true → includes soft-deleted categories
 *
 * POST: Δημιουργεί νέα custom category.
 *   Auto-generates: categoryId (custcat_xxx), code (custom_xxx)
 *   Requires: type, label, description, mydataCode, e3Code, defaultVatRate, vatDeductiblePercent
 *
 * Auth: withAuth (authenticated users)
 * Rate: GET → standard | POST → sensitive
 *
 * @module api/accounting/categories
 * @enterprise ADR-ACC-021 Custom Expense/Income Categories
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { CreateCustomCategoryInput } from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const CreateCategorySchema = z.object({
  type: z.enum(['income', 'expense']),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  mydataCode: z.string().min(1).max(50),
  e3Code: z.string().min(1).max(50),
  defaultVatRate: z.number().min(0).max(100),
  vatDeductible: z.boolean(),
  vatDeductiblePercent: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  icon: z.string().max(50).optional(),
  kadCode: z.string().max(50).nullable().optional(),
});

const logger = createModuleLogger('CUSTOM_CATEGORIES');

// =============================================================================
// GET — List Custom Categories
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list custom categories',
  handler: async ({ req, auth }) => {
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const categories = await repository.listCustomCategories(includeInactive);

    return ok(categories);
  },
});

// =============================================================================
// POST — Create Custom Category
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  schema: CreateCategorySchema,
  fallbackError: 'Failed to create custom category',
  handler: async ({ auth, body }) => {
    if (body.type !== 'income' && body.type !== 'expense') {
      badRequest('Invalid type — must be "income" or "expense"');
    }

    if (![0, 50, 100].includes(body.vatDeductiblePercent)) {
      badRequest('vatDeductiblePercent must be 0, 50, or 100');
    }

    const input: CreateCustomCategoryInput = {
      type: body.type,
      label: body.label.trim(),
      description: body.description?.trim() ?? '',
      mydataCode: body.mydataCode as CreateCustomCategoryInput['mydataCode'],
      e3Code: body.e3Code,
      defaultVatRate: body.defaultVatRate ?? 24,
      vatDeductible: body.vatDeductible ?? body.vatDeductiblePercent > 0,
      vatDeductiblePercent: body.vatDeductiblePercent ?? 100,
      sortOrder: body.sortOrder,
      icon: body.icon,
      kadCode: body.kadCode ?? null,
    };

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const result = await repository.createCustomCategory(input);

    logger.info('Custom category created', { id: result.id, code: result.code });

    return created(result);
  },
});
