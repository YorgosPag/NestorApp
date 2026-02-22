/**
 * =============================================================================
 * /api/attendance/geofence — Geofence Configuration CRUD
 * =============================================================================
 *
 * GET: Read geofence config for a project
 * POST: Set/update geofence config on a project
 *
 * Auth: withAuth (admin/manager)
 * Rate: withStandardRateLimit
 *
 * @module api/attendance/geofence
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { validateGeofenceConfig } from '@/services/attendance/geofence-service';
import { createModuleLogger } from '@/lib/telemetry';
import { logAuditEvent } from '@/lib/auth/audit';
import type { GeofenceConfig } from '@/components/projects/ika/contracts';

const logger = createModuleLogger('api/attendance/geofence');

// =============================================================================
// TYPES
// =============================================================================

interface GeofenceGetSuccessResponse {
  success: true;
  geofence: GeofenceConfig | null;
}

interface GeofencePostSuccessResponse {
  success: true;
  geofence: GeofenceConfig;
}

interface GeofenceErrorResponse {
  success: false;
  error: string;
}

type GeofenceGetResponse = GeofenceGetSuccessResponse | GeofenceErrorResponse;
type GeofencePostResponse = GeofencePostSuccessResponse | GeofenceErrorResponse;

// =============================================================================
// GET — Read geofence config
// =============================================================================

const baseGET = async (request: NextRequest) => {
  const handler = withAuth<GeofenceGetResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<GeofenceGetResponse>> => {
      try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
          return NextResponse.json(
            { success: false, error: 'projectId query parameter is required' },
            { status: 400 }
          );
        }

        const db = getAdminFirestore();
        const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();

        if (!projectDoc.exists) {
          return NextResponse.json(
            { success: false, error: 'Project not found' },
            { status: 404 }
          );
        }

        const data = projectDoc.data();
        const geofence = (data?.geofenceConfig as GeofenceConfig) ?? null;

        return NextResponse.json({ success: true, geofence });
      } catch (error) {
        logger.error('Geofence GET failed', {
          error: error instanceof Error ? error.message : 'Unknown',
          userId: ctx.uid,
        });

        return NextResponse.json(
          { success: false, error: 'Failed to read geofence config' },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
};

// =============================================================================
// POST — Set/update geofence config
// =============================================================================

const basePOST = async (request: NextRequest) => {
  const handler = withAuth<GeofencePostResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<GeofencePostResponse>> => {
      try {
        const body = await req.json() as {
          projectId?: string;
          latitude?: number;
          longitude?: number;
          radiusMeters?: number;
          enabled?: boolean;
        };

        // Validate required fields
        if (!body.projectId) {
          return NextResponse.json(
            { success: false, error: 'projectId is required' },
            { status: 400 }
          );
        }

        if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
          return NextResponse.json(
            { success: false, error: 'latitude and longitude are required' },
            { status: 400 }
          );
        }

        const radiusMeters = body.radiusMeters ?? 200;
        const enabled = body.enabled ?? true;

        // Validate geofence parameters
        const validationError = validateGeofenceConfig(body.latitude, body.longitude, radiusMeters);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        const db = getAdminFirestore();
        const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(body.projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
          return NextResponse.json(
            { success: false, error: 'Project not found' },
            { status: 404 }
          );
        }

        // Capture previous config for audit trail
        const previousGeofence = (projectDoc.data()?.geofenceConfig as GeofenceConfig | undefined) ?? null;

        const geofenceConfig: GeofenceConfig = {
          latitude: body.latitude,
          longitude: body.longitude,
          radiusMeters,
          enabled,
          updatedAt: new Date().toISOString(),
          updatedBy: ctx.uid,
        };

        await projectRef.update({ geofenceConfig });

        // Immutable audit log — who changed geofence, old → new values
        logAuditEvent(ctx, 'data_updated', body.projectId, 'project', {
          previousValue: previousGeofence
            ? {
                type: 'status',
                value: {
                  latitude: previousGeofence.latitude,
                  longitude: previousGeofence.longitude,
                  radiusMeters: previousGeofence.radiusMeters,
                  enabled: previousGeofence.enabled,
                },
              }
            : null,
          newValue: {
            type: 'status',
            value: {
              latitude: geofenceConfig.latitude,
              longitude: geofenceConfig.longitude,
              radiusMeters: geofenceConfig.radiusMeters,
              enabled: geofenceConfig.enabled,
            },
          },
          metadata: {
            reason: 'Geofence configuration update (ADR-170)',
          },
        }).catch((auditError) => {
          // Audit failure must not block the response
          logger.warn('Geofence audit log failed', {
            error: auditError instanceof Error ? auditError.message : 'Unknown',
          });
        });

        logger.info('Geofence config updated', {
          projectId: body.projectId,
          latitude: body.latitude,
          longitude: body.longitude,
          radiusMeters,
          enabled,
          userId: ctx.uid,
        });

        return NextResponse.json({ success: true, geofence: geofenceConfig });
      } catch (error) {
        logger.error('Geofence POST failed', {
          error: error instanceof Error ? error.message : 'Unknown',
          userId: ctx.uid,
        });

        return NextResponse.json(
          { success: false, error: 'Failed to update geofence config' },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(baseGET);
export const POST = withStandardRateLimit(basePOST);
