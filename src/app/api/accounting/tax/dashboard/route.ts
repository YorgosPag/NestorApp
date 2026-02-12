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
import { isPartnership, isLlc, isCorporation } from '@/subapps/accounting/utils/entity-guards';
import { getProfessionalTaxForEntity } from '@/subapps/accounting/services/config/tax-config';
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
        const { repository, taxEngine, service } = createAccountingServices();
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

        // 3. Get entity type for correct professional tax & tax path
        const profile = await repository.getCompanySetup();
        const entityType = profile?.entityType ?? 'sole_proprietor';
        const professionalTax = getProfessionalTaxForEntity(entityType);

        // 4. Dispatch by entity type
        // Partnership (OE) → redirect to estimate route, corporate (EPE) → corporate path
        if (profile && isPartnership(profile)) {
          const partnershipResult = await service.calculatePartnershipTax(fiscalYear);
          return NextResponse.json({ entityType: 'oe', taxResult: null, partnershipResult, installments: [] });
        }

        if (profile && isLlc(profile)) {
          const corporateResult = await service.calculateEPETax(fiscalYear);
          return NextResponse.json({ entityType: 'epe', taxResult: null, corporateResult, installments: [] });
        }

        if (profile && isCorporation(profile)) {
          const corporateResult = await service.calculateAETax(fiscalYear);
          return NextResponse.json({ entityType: 'ae', taxResult: null, corporateResult, installments: [] });
        }

        // 5. Sole proprietor — progressive tax calculation
        let taxResult: TaxResult | null = null;

        if (totalIncome > 0 || totalExpenses > 0) {
          taxResult = taxEngine.calculateAnnualTax({
            fiscalYear,
            totalIncome,
            totalDeductibleExpenses: totalExpenses,
            totalEfkaContributions: totalEfka,
            professionalTax,
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
