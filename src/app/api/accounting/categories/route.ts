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
 * Rate: GET → withStandardRateLimit | POST → withSensitiveRateLimit
 *
 * @module api/accounting/categories
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
import type { CreateCustomCategoryInput } from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CUSTOM_CATEGORIES');

// =============================================================================
// TYPES
// =============================================================================

interface CreateCategoryBody {
  type: 'income' | 'expense';
  label: string;
  description: string;
  mydataCode: string;
  e3Code: string;
  defaultVatRate: number;
  vatDeductible: boolean;
  vatDeductiblePercent: 0 | 50 | 100;
  sortOrder?: number;
  icon?: string;
  kadCode?: string | null;
}

// =============================================================================
// GET — List Custom Categories
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const includeInactive = url.searchParams.get('includeInactive') === 'true';

        const { repository } = createAccountingServices();
        const categories = await repository.listCustomCategories(includeInactive);

        return NextResponse.json({ success: true, data: categories });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list custom categories');
        logger.error('Custom categories list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// =============================================================================
// POST — Create Custom Category
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        let body: CreateCategoryBody;
        try {
          body = (await req.json()) as CreateCategoryBody;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
          );
        }

        if (!body.type || !body.label?.trim() || !body.mydataCode || !body.e3Code) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: type, label, mydataCode, e3Code' },
            { status: 400 }
          );
        }

        if (body.type !== 'income' && body.type !== 'expense') {
          return NextResponse.json(
            { success: false, error: 'Invalid type — must be "income" or "expense"' },
            { status: 400 }
          );
        }

        if (![0, 50, 100].includes(body.vatDeductiblePercent)) {
          return NextResponse.json(
            { success: false, error: 'vatDeductiblePercent must be 0, 50, or 100' },
            { status: 400 }
          );
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

        const { repository } = createAccountingServices();
        const result = await repository.createCustomCategory(input);

        logger.info('Custom category created', { id: result.id, code: result.code });

        return NextResponse.json({ success: true, data: result }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create custom category');
        logger.error('Custom category create error', { error: message });
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
export const POST = withSensitiveRateLimit(handlePost);
