/**
 * =============================================================================
 * Budget Variance API — SPEC-242C
 * =============================================================================
 *
 * GET: Read budget variance entries for a project.
 * POST: Save budget/actual categories for a project.
 *
 * Storage: settings/budget_variance_{projectId}
 *
 * @module api/financial-intelligence/budget-variance
 * @enterprise SPEC-242C — Budget vs Actual Waterfall
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { BudgetVarianceEntry, BudgetVarianceAnalysis, VarianceTrend } from '@/types/interest-calculator';

const logger = createModuleLogger('BudgetVarianceRoute');

function getDocId(projectId: string): string {
  return `budget_variance_${projectId}`;
}

export const dynamic = 'force-dynamic';

// =============================================================================
// GET — Read budget variance for a project
// =============================================================================

export const GET = withHighRateLimit(
  withAuth<ApiSuccessResponse<{ analysis: BudgetVarianceAnalysis | null }>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const { searchParams } = new URL(req.url);
      const projectId = searchParams.get('projectId');
      if (!projectId) {
        throw new ApiError(400, 'projectId query param required');
      }

      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTIONS.SETTINGS).doc(getDocId(projectId));
      const snap = await docRef.get();

      if (!snap.exists) {
        return apiSuccess({ analysis: null });
      }

      const analysis = snap.data() as BudgetVarianceAnalysis;
      return apiSuccess({ analysis });
    }
  )
);

// =============================================================================
// POST — Save budget variance categories
// =============================================================================

interface BudgetCategoryInput {
  category: string;
  categoryKey: string;
  budgetAmount: number;
  actualAmount: number;
  trend?: VarianceTrend;
}

interface BudgetVariancePayload {
  projectId: string;
  projectName: string;
  categories: BudgetCategoryInput[];
}

function validatePayload(body: Record<string, unknown>): BudgetVariancePayload {
  const projectId = body.projectId;
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new ApiError(400, 'projectId is required');
  }
  const projectName = body.projectName;
  if (typeof projectName !== 'string' || projectName.trim().length === 0) {
    throw new ApiError(400, 'projectName is required');
  }
  const categories = body.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new ApiError(400, 'categories array is required');
  }

  return {
    projectId: projectId.trim(),
    projectName: (projectName as string).trim(),
    categories: (categories as BudgetCategoryInput[]).map(cat => ({
      category: String(cat.category || ''),
      categoryKey: String(cat.categoryKey || ''),
      budgetAmount: Number(cat.budgetAmount) || 0,
      actualAmount: Number(cat.actualAmount) || 0,
      trend: cat.trend || 'stable',
    })),
  };
}

export const POST = withHighRateLimit(
  withAuth<ApiSuccessResponse<{ analysis: BudgetVarianceAnalysis }>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json() as Record<string, unknown>;
      const payload = validatePayload(body);
      const db = getAdminFirestore();

      // Build variance entries
      const entries: BudgetVarianceEntry[] = payload.categories.map(cat => {
        const variance = cat.actualAmount - cat.budgetAmount;
        const variancePercent = cat.budgetAmount > 0
          ? Math.round((variance / cat.budgetAmount) * 10000) / 100
          : 0;

        return {
          category: cat.category,
          categoryKey: cat.categoryKey,
          budgetAmount: cat.budgetAmount,
          actualAmount: cat.actualAmount,
          variance: Math.round(variance * 100) / 100,
          variancePercent,
          trend: cat.trend ?? 'stable',
        };
      });

      const totalBudget = entries.reduce((sum, e) => sum + e.budgetAmount, 0);
      const totalActual = entries.reduce((sum, e) => sum + e.actualAmount, 0);
      const totalVariance = totalActual - totalBudget;
      const totalVariancePercent = totalBudget > 0
        ? Math.round((totalVariance / totalBudget) * 10000) / 100
        : 0;

      // Top 3 by absolute variance
      const topVariances = [...entries]
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
        .slice(0, 3);

      const analysis: BudgetVarianceAnalysis = {
        projectId: payload.projectId,
        projectName: payload.projectName,
        totalBudget: Math.round(totalBudget * 100) / 100,
        totalActual: Math.round(totalActual * 100) / 100,
        totalVariance: Math.round(totalVariance * 100) / 100,
        totalVariancePercent,
        categories: entries,
        topVariances,
      };

      const docRef = db.collection(COLLECTIONS.SETTINGS).doc(getDocId(payload.projectId));
      await docRef.set({ ...analysis, updatedAt: new Date().toISOString() });

      logger.info(`[BudgetVariance] Saved ${entries.length} categories for project ${payload.projectId}`);
      return apiSuccess({ analysis }, 'Budget variance saved');
    }
  )
);
