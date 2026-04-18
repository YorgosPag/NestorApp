/**
 * @module api/reports/cash-flow
 * @enterprise ADR-268 Phase 8 — Cash Flow Forecast API
 *
 * GET  /api/reports/cash-flow — Fetch projection (3 scenarios, actuals, PDC, alerts)
 * PUT  /api/reports/cash-flow — Update cashFlowConfig (initial balance + recurring)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { fetchAllCashFlowData, saveCashFlowConfig } from '@/services/cash-flow/cash-flow-data-fetcher';
import { buildAllScenarios } from '@/services/cash-flow/cash-flow-projection-engine';
import {
  computeActualVsForecast,
  buildPDCCalendar,
  generateAlerts,
} from '@/services/cash-flow/cash-flow-analysis';
import type {
  CashFlowAPIResponse,
  CashFlowConfig,
  RecurringPayment,
} from '@/services/cash-flow/cash-flow.types';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('CashFlowRoute');

export const dynamic = 'force-dynamic';

type CFResponse = ApiSuccessResponse<CashFlowAPIResponse>;

// ============================================================================
// GET — Fetch Cash Flow Projection
// ============================================================================

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<CFResponse>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const { searchParams } = req.nextUrl;
        const projectId = searchParams.get('projectId') ?? undefined;
        const buildingId = searchParams.get('buildingId') ?? undefined;
        const months = Math.min(
          Math.max(1, Number(searchParams.get('months')) || 12),
          24,
        );

        const filter = {
          companyId: ctx.companyId,
          projectId,
          buildingId,
        };

        const rawData = await fetchAllCashFlowData(filter);
        const scenarios = buildAllScenarios(rawData, months);
        const realistic = scenarios.find((s) => s.scenario === 'realistic');
        const actuals = realistic
          ? computeActualVsForecast(realistic, rawData.bankTransactions)
          : [];
        const pdcCalendar = buildPDCCalendar(rawData.cheques);
        const alerts = generateAlerts(scenarios, rawData.cheques);

        const response: CashFlowAPIResponse = {
          config: rawData.config,
          scenarios,
          actuals,
          pdcCalendar,
          alerts,
          filter: { projectId, buildingId },
          generatedAt: nowISO(),
        };

        return apiSuccess<CashFlowAPIResponse>(response, 'Cash flow forecast generated');
      } catch (err) {
        logger.error('Cash flow forecast failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: nowISO() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );

  return handler(request);
});

// ============================================================================
// PUT — Update Cash Flow Settings
// ============================================================================

export const PUT = withStandardRateLimit(async function PUT(
  request: NextRequest,
) {
  const handler = withAuth<ApiSuccessResponse<{ saved: boolean }>>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const body = await req.json();
        const validation = validateConfigUpdate(body);
        if (validation) {
          return NextResponse.json(
            { success: false as const, error: validation, timestamp: nowISO() },
            { status: 400 },
          );
        }

        const config: CashFlowConfig = {
          initialBalance: Number(body.initialBalance) || 0,
          updatedAt: nowISO(),
          recurringPayments: (body.recurringPayments as RecurringPayment[]) ?? [],
        };

        await saveCashFlowConfig(ctx.companyId, config);

        logger.info('Cash flow config updated', { companyId: ctx.companyId });
        return apiSuccess({ saved: true }, 'Cash flow settings updated');
      } catch (err) {
        logger.error('Cash flow config update failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: nowISO() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );

  return handler(request);
});

// ============================================================================
// Validation
// ============================================================================

function validateConfigUpdate(body: Record<string, unknown>): string | null {
  if (typeof body.initialBalance !== 'number' && typeof body.initialBalance !== 'string') {
    return 'initialBalance must be a number';
  }

  if (!Array.isArray(body.recurringPayments)) {
    return 'recurringPayments must be an array';
  }

  const payments = body.recurringPayments as Array<Record<string, unknown>>;
  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    if (!p.id || typeof p.id !== 'string') return `recurringPayments[${i}].id is required`;
    if (!p.label || typeof p.label !== 'string') return `recurringPayments[${i}].label is required`;
    if (typeof p.amount !== 'number' || p.amount <= 0) return `recurringPayments[${i}].amount must be > 0`;
    if (!['monthly', 'quarterly', 'annual'].includes(p.frequency as string)) {
      return `recurringPayments[${i}].frequency must be monthly, quarterly, or annual`;
    }
    if (!p.startDate || typeof p.startDate !== 'string') {
      return `recurringPayments[${i}].startDate is required`;
    }
  }

  return null;
}
