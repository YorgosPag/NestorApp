import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FixProjectIdsRoute');

/** Response type for fix-project-ids API */
interface FixProjectIdsResponse {
  success: boolean;
  message?: string;
  results?: Array<{
    buildingId: string;
    newProjectId: string;
    status: string;
  }>;
  summary?: {
    totalUpdates: number;
    projectId: string;
  };
  error?: string;
  details?: string;
}

/**
 * Get required server-only configuration.
 * Fails-closed if configuration is missing.
 */
function getRequiredConfig(): {
  buildingIds: string[];
  targetProjectId: string;
} {
  // Server-only env vars (no NEXT_PUBLIC_ prefix)
  const buildingId1 = process.env.ADMIN_BUILDING_1_ID;
  const buildingId2 = process.env.ADMIN_BUILDING_2_ID;
  const targetProjectId = process.env.ADMIN_TARGET_PROJECT_ID;

  // Fail-closed: require all configuration
  const missingVars: string[] = [];
  if (!buildingId1) missingVars.push('ADMIN_BUILDING_1_ID');
  if (!buildingId2) missingVars.push('ADMIN_BUILDING_2_ID');
  if (!targetProjectId) missingVars.push('ADMIN_TARGET_PROJECT_ID');

  if (missingVars.length > 0) {
    throw new Error(`Misconfigured environment: missing ${missingVars.join(', ')}`);
  }

  return {
    buildingIds: [buildingId1!, buildingId2!],
    targetProjectId: targetProjectId!,
  };
}

/**
 * @rateLimit HEAVY (10 req/min) - Resource-intensive operation
 */
export const POST = withHeavyRateLimit(
  withAuth<FixProjectIdsResponse>(
  async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    try {
      // 🔐 ADMIN SDK: Get server-side Firestore instance
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        logger.error('Firebase Admin not initialized');
        return NextResponse.json({
          success: false,
          error: 'Database unavailable',
          details: 'Firebase Admin not initialized'
        }, { status: 503 });
      }

      // Get required configuration (fails-closed if missing)
      let config: ReturnType<typeof getRequiredConfig>;
      try {
        config = getRequiredConfig();
      } catch (configError) {
        logger.error('Configuration error', { error: configError });
        return NextResponse.json({
          success: false,
          error: 'Misconfigured environment',
          details: configError instanceof Error ? configError.message : 'Missing required server configuration'
        }, { status: 500 });
      }

      logger.info('Fixing building project IDs', { superAdminUid: ctx.uid, targetProjectId: config.targetProjectId, buildingIds: config.buildingIds });

      const results: Array<{ buildingId: string; newProjectId: string; status: string }> = [];

      for (const buildingId of config.buildingIds) {
        logger.info('Updating building to project', { buildingId, targetProjectId: config.targetProjectId });

        // Admin SDK: Use doc().update()
        await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).update({
          projectId: config.targetProjectId,
          updatedAt: new Date().toISOString(),
          updatedBy: ctx.uid,
        });

        logger.info('Successfully updated building', { buildingId });
        results.push({
          buildingId,
          newProjectId: config.targetProjectId,
          status: 'updated'
        });
      }

      logger.info('All building project IDs have been fixed');

      return NextResponse.json({
        success: true,
        message: 'Building project IDs fixed successfully',
        results,
        summary: {
          totalUpdates: config.buildingIds.length,
          projectId: config.targetProjectId,
        }
      });

    } catch (error) {
      logger.error('Error fixing building project IDs', { error });

      return NextResponse.json({
        success: false,
        error: 'Failed to fix building project IDs',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  { requiredGlobalRoles: 'super_admin' }  // Centralized role check
  )
);
