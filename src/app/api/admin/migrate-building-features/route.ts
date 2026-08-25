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
import { BYPASS_ROLES } from '@/lib/auth/roles';
import {
  executeBuildingFeaturesMigration,
  previewBuildingFeaturesMigration,
} from './migration-operations';

const logger = createModuleLogger('MigrateBuildingFeaturesRoute');

export const GET = withSensitiveRateLimit(withAuth(
  async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
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
  { requiredGlobalRoles: BYPASS_ROLES, permissions: 'admin:migrations:execute' },
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
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
  { requiredGlobalRoles: BYPASS_ROLES, permissions: 'admin:migrations:execute' },
));
