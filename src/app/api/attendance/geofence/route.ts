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

        const geofenceConfig: GeofenceConfig = {
          latitude: body.latitude,
          longitude: body.longitude,
          radiusMeters,
          enabled,
          updatedAt: new Date().toISOString(),
          updatedBy: ctx.uid,
        };

        await projectRef.update({ geofenceConfig });

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
