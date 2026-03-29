/**
 * @module api/reports/builder
 * @enterprise ADR-268 — Dynamic Report Builder Query API
 *
 * POST /api/reports/builder
 * Accepts BuilderQueryRequest, executes dynamic Firestore query,
 * returns BuilderQueryResponse with resolved refs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { executeBuilderQuery } from '@/services/report-engine/report-query-executor';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';
import {
  isValidDomainId,
  isValidOperatorForType,
  BUILDER_LIMITS,
  type BuilderQueryRequest,
  type BuilderQueryResponse,
} from '@/config/report-builder/report-builder-types';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BuilderReportRoute');

export const dynamic = 'force-dynamic';

type BuilderResponse = ApiSuccessResponse<BuilderQueryResponse>;

// ============================================================================
// POST Handler
// ============================================================================

export const POST = withStandardRateLimit(async function POST(
  request: NextRequest,
) {
  const handler = withAuth<BuilderResponse>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<BuilderResponse>> => {
      try {
        const body = (await req.json()) as BuilderQueryRequest;

        // Validate request
        const validation = validateBuilderRequest(body);
        if (validation) {
          return NextResponse.json(
            { success: false as const, error: validation, timestamp: new Date().toISOString() },
            { status: 400 },
          );
        }

        // Ensure limit within bounds
        const sanitized: BuilderQueryRequest = {
          ...body,
          limit: Math.min(
            Math.max(1, body.limit || BUILDER_LIMITS.DEFAULT_ROW_LIMIT),
            BUILDER_LIMITS.MAX_ROW_LIMIT,
          ),
        };

        const data = await executeBuilderQuery(ctx.companyId, sanitized);

        return apiSuccess<BuilderQueryResponse>(data, 'Builder query executed');
      } catch (err) {
        logger.error('Builder query failed', { error: getErrorMessage(err) });
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

// ============================================================================
// Validation
// ============================================================================

function validateBuilderRequest(body: BuilderQueryRequest): string | null {
  if (!body.domain || !isValidDomainId(body.domain)) {
    return `Invalid domain: "${body.domain}". Valid: projects, buildings, floors, units`;
  }

  if (!Array.isArray(body.filters)) {
    return 'filters must be an array';
  }

  if (body.filters.length > BUILDER_LIMITS.MAX_ACTIVE_FILTERS) {
    return `Too many filters: ${body.filters.length}. Maximum: ${BUILDER_LIMITS.MAX_ACTIVE_FILTERS}`;
  }

  if (!Array.isArray(body.columns) || body.columns.length === 0) {
    return 'columns must be a non-empty array';
  }

  // Validate each filter references valid fields + operators
  const domain = getDomainDefinition(body.domain);
  const validFieldKeys = new Set(domain.fields.map((f) => f.key));

  for (const filter of body.filters) {
    if (!validFieldKeys.has(filter.fieldKey)) {
      return `Invalid filter field: "${filter.fieldKey}" in domain "${body.domain}"`;
    }
    const fieldDef = domain.fields.find((f) => f.key === filter.fieldKey);
    if (fieldDef && !isValidOperatorForType(filter.operator, fieldDef.type)) {
      return `Invalid operator "${filter.operator}" for field "${filter.fieldKey}" (type: ${fieldDef.type})`;
    }
  }

  // Validate columns exist in domain
  for (const col of body.columns) {
    if (!validFieldKeys.has(col)) {
      return `Invalid column: "${col}" in domain "${body.domain}"`;
    }
  }

  // Validate sort field if provided
  if (body.sortField && !validFieldKeys.has(body.sortField)) {
    return `Invalid sortField: "${body.sortField}" in domain "${body.domain}"`;
  }

  return null;
}
