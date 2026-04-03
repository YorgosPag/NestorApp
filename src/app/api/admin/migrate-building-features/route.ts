/**
 * =============================================================================
 * BUILDING FEATURES MIGRATION - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  createForbiddenPayload,
  executeBuildingFeaturesMigration,
  previewBuildingFeaturesMigration,
} from './migration-operations';
import {
  SUPER_ADMIN_REQUIRED_CODE,
  SUPER_ADMIN_REQUIRED_ERROR,
} from './migration-config';

const logger = createModuleLogger('MigrateBuildingFeaturesRoute');

const ensureSuperAdmin = (ctx: AuthContext, action: 'preview' | 'migration'): NextResponse | null => {
  if (ctx.globalRole === 'super_admin') {
    return null;
  }

  logger.warn(`BLOCKED: Non-super_admin attempted building features ${action}`, {
    userId: ctx.uid,
    email: ctx.email,
    globalRole: ctx.globalRole,
  });

  return NextResponse.json(
    createForbiddenPayload(SUPER_ADMIN_REQUIRED_ERROR, SUPER_ADMIN_REQUIRED_CODE),
    { status: 403 },
  );
};

export const GET = withSensitiveRateLimit(withAuth(
  async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    const forbiddenResponse = ensureSuperAdmin(ctx, 'preview');
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    try {
      const payload = await previewBuildingFeaturesMigration();
      return NextResponse.json(payload);
    } catch (error: unknown) {
      logger.error('Error analyzing buildings', { error });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to analyze buildings',
          details: getErrorMessage(error),
        },
        { status: 500 },
      );
    }
  },
  { permissions: 'admin:migrations:execute' },
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    const forbiddenResponse = ensureSuperAdmin(ctx, 'migration');
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    try {
      const payload = await executeBuildingFeaturesMigration(req, ctx);
      return NextResponse.json(payload);
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      try {
        const parsed = JSON.parse(message) as {
          type?: string;
          unmappedFeatures?: string[];
          message?: string;
        };

        if (parsed.type === 'UNMAPPED_FEATURES') {
          return NextResponse.json(
            {
              success: false,
              error: 'Migration blocked: unmapped features found',
              unmappedFeatures: parsed.unmappedFeatures ?? [],
              message: parsed.message,
            },
            { status: 400 },
          );
        }
      } catch {
        // Ignore JSON parse failures and fall through to generic error response.
      }

      logger.error('Error during migration', { error });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to migrate building features',
          details: message,
        },
        { status: 500 },
      );
    }
  },
  { permissions: 'admin:migrations:execute' },
));
