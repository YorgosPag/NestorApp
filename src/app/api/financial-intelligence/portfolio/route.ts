/**
 * =============================================================================
 * Portfolio API — SPEC-242C
 * =============================================================================
 *
 * GET: Returns portfolio summary + per-project financial summaries.
 * Cached 30s via EnterpriseAPICache.
 *
 * @module api/financial-intelligence/portfolio
 * @enterprise SPEC-242C — Portfolio Dashboard
 */

import { NextRequest } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { aggregatePortfolio } from '@/services/financial-intelligence/portfolio-aggregator';
import { createModuleLogger } from '@/lib/telemetry';
import type { PortfolioSummary, ProjectFinancialSummary } from '@/types/interest-calculator';

const logger = createModuleLogger('PortfolioRoute');

const CACHE_KEY_PREFIX = 'api:financial-intelligence:portfolio';
const CACHE_TTL = 30 * 1000; // 30 seconds

interface PortfolioResponse {
  portfolio: PortfolioSummary;
  projects: ProjectFinancialSummary[];
  source: 'cache' | 'firestore';
}

export const dynamic = 'force-dynamic';

export const GET = withHighRateLimit(
  withAuth<ApiSuccessResponse<PortfolioResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const startTime = Date.now();
      const cache = EnterpriseAPICache.getInstance();
      const cacheKey = `${CACHE_KEY_PREFIX}:${ctx.companyId}`;

      // Check cache
      const cached = cache.get<PortfolioResponse>(cacheKey);
      if (cached) {
        logger.info('[Portfolio] Cache hit');
        return apiSuccess<PortfolioResponse>({ ...cached, source: 'cache' });
      }

      // Aggregate from Firestore
      const result = await aggregatePortfolio(ctx.companyId);
      const response: PortfolioResponse = {
        portfolio: result.portfolio,
        projects: result.projects,
        source: 'firestore',
      };

      // Cache result
      cache.set(cacheKey, response, CACHE_TTL);

      const duration = Date.now() - startTime;
      logger.info(`[Portfolio] Aggregation complete in ${duration}ms`);

      await logAuditEvent(ctx, 'data_accessed', 'portfolio', 'api', {
        metadata: {
          path: '/api/financial-intelligence/portfolio',
          reason: `Portfolio aggregation (${result.projects.length} projects, ${duration}ms)`,
        },
      });

      return apiSuccess<PortfolioResponse>(response, `Portfolio loaded in ${duration}ms`);
    }
  )
);
