/**
 * =============================================================================
 * GET /api/accounting/tax/dashboard — Tax Dashboard (Result + Installments)
 * =============================================================================
 *
 * Returns a combined payload for the Tax Dashboard:
 *   - `taxResult`: Full bracket-level calculation based on current journal entries
 *   - `installments`: Saved installments from repository, or calculated from engine
 *
 * Query params:
 *   - fiscalYear (optional): Defaults to current year
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/tax/dashboard
 * @enterprise ADR-ACC-009 Tax Engine
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { TaxResult, TaxInstallment } from '@/subapps/accounting/types';

// =============================================================================
// RESPONSE TYPE
// =============================================================================

interface TaxDashboardResponse {
  taxResult: TaxResult | null;
  installments: TaxInstallment[];
}

// =============================================================================
// GET — Tax Dashboard
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository, taxEngine } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const fiscalYearParam = searchParams.get('fiscalYear');
        const fiscalYear = fiscalYearParam
          ? parseInt(fiscalYearParam, 10)
          : new Date().getFullYear();

        if (Number.isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
          return NextResponse.json(
            { error: 'fiscalYear must be a valid year (2000-2100)' },
            { status: 400 }
          );
        }

        // 1. Fetch income and expense entries for the fiscal year
        const [incomeResult, expenseResult] = await Promise.all([
          repository.listJournalEntries({ fiscalYear, type: 'income' }),
          repository.listJournalEntries({ fiscalYear, type: 'expense' }),
        ]);

        const totalIncome = incomeResult.items.reduce((sum, e) => sum + e.netAmount, 0);
        const totalExpenses = expenseResult.items.reduce((sum, e) => sum + e.netAmount, 0);

        // 2. Fetch EFKA payments to deduct contributions
        const efkaPayments = await repository.getEFKAPayments(fiscalYear);
        const totalEfka = efkaPayments
          .filter((p) => p.status === 'paid')
          .reduce((sum, p) => sum + p.amount, 0);

        // 3. Get tax scale for professional tax amount
        const scale = taxEngine.getTaxScale(fiscalYear);

        // 4. Calculate full tax result
        let taxResult: TaxResult | null = null;

        if (totalIncome > 0 || totalExpenses > 0) {
          taxResult = taxEngine.calculateAnnualTax({
            fiscalYear,
            totalIncome,
            totalDeductibleExpenses: totalExpenses,
            totalEfkaContributions: totalEfka,
            professionalTax: scale.professionalTax,
            totalWithholdings: 0,
            previousYearPrepayment: 0,
            isFirstFiveYears: false,
          });
        }

        // 5. Get installments — saved first, calculate as fallback
        let installments: TaxInstallment[] = await repository.getTaxInstallments(fiscalYear);

        if (installments.length === 0 && taxResult && taxResult.finalAmount > 0) {
          installments = taxEngine.calculateInstallments(taxResult.finalAmount, fiscalYear);
        }

        const response: TaxDashboardResponse = { taxResult, installments };
        return NextResponse.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load tax dashboard';
        return NextResponse.json(
          { error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
