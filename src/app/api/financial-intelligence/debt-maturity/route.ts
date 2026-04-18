/**
 * =============================================================================
 * Debt Maturity API — SPEC-242C
 * =============================================================================
 *
 * GET: Read debt maturity entries from settings document.
 * POST: Add new entry with enterprise ID.
 * DELETE: Remove entry by loanId.
 *
 * Storage: settings/debt_maturity_{companyId}
 *
 * @module api/financial-intelligence/debt-maturity
 * @enterprise SPEC-242C — Debt Maturity Wall
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDebtMaturityId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { DebtMaturityEntry, LoanType, HealthStatus } from '@/types/interest-calculator';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('DebtMaturityRoute');

function getDocId(companyId: string): string {
  return `debt_maturity_${companyId}`;
}

export const dynamic = 'force-dynamic';

// =============================================================================
// GET — Read all entries
// =============================================================================

export const GET = withHighRateLimit(
  withAuth<ApiSuccessResponse<{ entries: DebtMaturityEntry[] }>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTIONS.SETTINGS).doc(getDocId(ctx.companyId));
      const snap = await docRef.get();

      const entries: DebtMaturityEntry[] = snap.exists
        ? (snap.data()?.entries as DebtMaturityEntry[] ?? [])
        : [];

      return apiSuccess({ entries });
    }
  )
);

// =============================================================================
// POST — Add or update entry
// =============================================================================

interface DebtMaturityInput {
  projectName: string;
  loanType: LoanType;
  outstandingBalance: number;
  currentRate: number;
  maturityDate: string;
  estimatedRefiRate: number;
  ltvAtMaturity: number;
  currentDSCR: number;
}

function validateInput(body: Record<string, unknown>): DebtMaturityInput {
  const projectName = body.projectName;
  if (typeof projectName !== 'string' || projectName.trim().length === 0) {
    throw new ApiError(400, 'projectName is required');
  }
  const loanType = body.loanType;
  if (!['construction', 'mortgage', 'bridge', 'mezzanine'].includes(loanType as string)) {
    throw new ApiError(400, 'Invalid loanType');
  }
  const outstandingBalance = Number(body.outstandingBalance);
  if (isNaN(outstandingBalance) || outstandingBalance <= 0) {
    throw new ApiError(400, 'outstandingBalance must be positive');
  }
  const currentRate = Number(body.currentRate);
  if (isNaN(currentRate) || currentRate < 0) {
    throw new ApiError(400, 'currentRate must be non-negative');
  }
  const maturityDate = body.maturityDate;
  if (typeof maturityDate !== 'string' || isNaN(Date.parse(maturityDate))) {
    throw new ApiError(400, 'maturityDate must be a valid ISO date');
  }

  return {
    projectName: projectName.trim(),
    loanType: loanType as LoanType,
    outstandingBalance,
    currentRate,
    maturityDate: maturityDate as string,
    estimatedRefiRate: Number(body.estimatedRefiRate) || 0,
    ltvAtMaturity: Number(body.ltvAtMaturity) || 0,
    currentDSCR: Number(body.currentDSCR) || 0,
  };
}

function computeRiskLevel(monthsToMaturity: number, dscr: number, ltv: number): HealthStatus {
  if (monthsToMaturity <= 6 || dscr < 1.0 || ltv > 90) return 'critical';
  if (monthsToMaturity <= 12 || dscr < 1.2 || ltv > 80) return 'warning';
  if (monthsToMaturity <= 24 || dscr < 1.5 || ltv > 70) return 'good';
  return 'excellent';
}

export const POST = withHighRateLimit(
  withAuth<ApiSuccessResponse<{ entry: DebtMaturityEntry }>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json() as Record<string, unknown>;
      const input = validateInput(body);
      const db = getAdminFirestore();

      const maturityMs = new Date(input.maturityDate).getTime();
      const nowMs = Date.now();
      const monthsToMaturity = Math.max(0, Math.round((maturityMs - nowMs) / (1000 * 60 * 60 * 24 * 30)));

      const entry: DebtMaturityEntry = {
        loanId: generateDebtMaturityId(),
        projectName: input.projectName,
        loanType: input.loanType,
        outstandingBalance: input.outstandingBalance,
        currentRate: input.currentRate,
        maturityDate: input.maturityDate,
        monthsToMaturity,
        estimatedRefiRate: input.estimatedRefiRate,
        ltvAtMaturity: input.ltvAtMaturity,
        currentDSCR: input.currentDSCR,
        riskLevel: computeRiskLevel(monthsToMaturity, input.currentDSCR, input.ltvAtMaturity),
      };

      const docRef = db.collection(COLLECTIONS.SETTINGS).doc(getDocId(ctx.companyId));
      const snap = await docRef.get();
      const existing: DebtMaturityEntry[] = snap.exists
        ? (snap.data()?.entries as DebtMaturityEntry[] ?? [])
        : [];

      existing.push(entry);
      await docRef.set({ entries: existing, updatedAt: nowISO() }, { merge: true });

      logger.info(`[DebtMaturity] Added entry ${entry.loanId} for ${ctx.companyId}`);
      return apiSuccess({ entry }, 'Entry added');
    }
  )
);

// =============================================================================
// DELETE — Remove entry by loanId
// =============================================================================

export const DELETE = withHighRateLimit(
  withAuth<ApiSuccessResponse<{ removed: boolean }>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const { searchParams } = new URL(req.url);
      const loanId = searchParams.get('loanId');
      if (!loanId) {
        throw new ApiError(400, 'loanId query param required');
      }

      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTIONS.SETTINGS).doc(getDocId(ctx.companyId));
      const snap = await docRef.get();

      if (!snap.exists) {
        return apiSuccess({ removed: false }, 'No entries found');
      }

      const entries: DebtMaturityEntry[] = snap.data()?.entries as DebtMaturityEntry[] ?? [];
      const filtered = entries.filter(e => e.loanId !== loanId);

      if (filtered.length === entries.length) {
        return apiSuccess({ removed: false }, 'Entry not found');
      }

      await docRef.set({ entries: filtered, updatedAt: nowISO() }, { merge: true });
      logger.info(`[DebtMaturity] Removed entry ${loanId} for ${ctx.companyId}`);
      return apiSuccess({ removed: true }, 'Entry removed');
    }
  )
);
