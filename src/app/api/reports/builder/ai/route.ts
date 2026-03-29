/**
 * @module api/reports/builder/ai
 * @enterprise ADR-268 — AI Query Translation API
 *
 * POST /api/reports/builder/ai
 * Accepts natural language query, returns structured BuilderQueryRequest.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { translateNaturalLanguageQuery } from '@/services/report-engine/ai-query-translator';
import type { AITranslatedQuery } from '@/config/report-builder/report-builder-types';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BuilderAIRoute');

export const dynamic = 'force-dynamic';

interface AIQueryRequestBody {
  query: string;
  locale?: 'en' | 'el';
}

type AIResponse = ApiSuccessResponse<AITranslatedQuery>;

export const POST = withStandardRateLimit(async function POST(
  request: NextRequest,
) {
  const handler = withAuth<AIResponse>(
    async (
      req: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<AIResponse>> => {
      try {
        const body = (await req.json()) as AIQueryRequestBody;

        if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
          return NextResponse.json(
            { success: false as const, error: 'query is required', timestamp: new Date().toISOString() },
            { status: 400 },
          );
        }

        if (body.query.length > 500) {
          return NextResponse.json(
            { success: false as const, error: 'query too long (max 500 chars)', timestamp: new Date().toISOString() },
            { status: 400 },
          );
        }

        const locale = body.locale === 'en' ? 'en' : 'el';
        const result = await translateNaturalLanguageQuery(body.query.trim(), locale);

        return apiSuccess<AITranslatedQuery>(result, 'Query translated');
      } catch (err) {
        logger.error('AI translation failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: new Date().toISOString() },
          { status: 500 },
        );
      }
    },
    { requiredPermission: 'reports:reports:view' },
  );

  return handler(request);
});
