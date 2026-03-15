/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Code Suggestion API (ADR-233)
 * =============================================================================
 *
 * GET /api/entity-code/suggest?entityType=unit&buildingId=xxx&floorLevel=1&unitType=apartment
 *
 * Returns the next suggested entity code based on existing entities
 * in the same building, floor, and type combination.
 *
 * @see ADR-233 — Entity Coding System
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  formatFloorCode,
  resolveTypeCode,
  formatEntityCode,
  parseEntityCode,
  buildCounterKey,
} from '@/services/entity-code.service';
import { extractBuildingLetter } from '@/config/entity-code-config';
import type { UnitType } from '@/types/unit';
import type { ParkingLocationZone } from '@/types/parking';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EntityCodeSuggest');

// =============================================================================
// TYPES
// =============================================================================

interface SuggestResponse {
  suggestedCode: string;
  sequence: number;
  buildingLetter: string;
  typeCode: string;
  floorCode: string;
}

// =============================================================================
// GET — Suggest entity code
// =============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<SuggestResponse>>(
    async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      const { searchParams } = new URL(request.url);
      const entityType = searchParams.get('entityType') as 'unit' | 'parking' | 'storage';
      const buildingId = searchParams.get('buildingId');
      const floorLevelStr = searchParams.get('floorLevel');
      const unitType = searchParams.get('unitType') as UnitType | null;
      const locationZone = searchParams.get('locationZone') as ParkingLocationZone | null;

      // Validation
      if (!entityType || !['unit', 'parking', 'storage'].includes(entityType)) {
        throw new ApiError(400, 'entityType must be unit, parking, or storage');
      }
      if (!buildingId) {
        throw new ApiError(400, 'buildingId is required');
      }

      const floorLevel = floorLevelStr !== null ? parseInt(floorLevelStr, 10) : 0;

      // Resolve type code
      const typeCode = resolveTypeCode(
        entityType,
        unitType ?? undefined,
        locationZone ?? undefined
      );
      if (!typeCode) {
        throw new ApiError(400, 'Cannot resolve type code for the given parameters');
      }

      // Get building name for letter extraction
      const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
      if (!buildingDoc.exists) {
        throw new ApiError(404, 'Building not found');
      }
      const buildingData = buildingDoc.data() as Record<string, unknown>;
      const buildingName = (buildingData.name as string) || '?';
      const buildingLetter = extractBuildingLetter(buildingName);

      // Floor code
      const floorCode = formatFloorCode(floorLevel);

      // Find next sequence by counting existing entities
      const nextSequence = await findNextSequence(
        adminDb,
        entityType,
        buildingId,
        typeCode,
        floorCode,
        floorLevel
      );

      const suggestedCode = formatEntityCode(buildingLetter, typeCode, floorCode, nextSequence);

      logger.info('Suggested entity code', {
        entityType,
        buildingId,
        floorLevel,
        typeCode,
        suggestedCode,
      });

      return apiSuccess<SuggestResponse>({
        suggestedCode,
        sequence: nextSequence,
        buildingLetter,
        typeCode,
        floorCode,
      });
    },
    { permissions: 'units:units:view' }
  )
);

// =============================================================================
// SEQUENCE FINDER — Scans existing entities to determine next number
// =============================================================================

/**
 * Finds the next available sequence number by scanning existing entities.
 *
 * Strategy: Query all entities in the same building+floor, extract their codes,
 * and find the maximum sequence for the given type code.
 */
async function findNextSequence(
  adminDb: FirebaseFirestore.Firestore,
  entityType: 'unit' | 'parking' | 'storage',
  buildingId: string,
  typeCode: string,
  floorCode: string,
  floorLevel: number
): Promise<number> {
  // Determine collection and code field based on entity type
  let collectionName: string;
  let codeField: string;

  switch (entityType) {
    case 'unit':
      collectionName = COLLECTIONS.UNITS;
      codeField = 'code';
      break;
    case 'parking':
      collectionName = COLLECTIONS.PARKING_SPACES;
      codeField = 'number';
      break;
    case 'storage':
      collectionName = COLLECTIONS.STORAGE;
      codeField = 'name';
      break;
  }

  // Query all entities in this building + floor
  let queryRef = adminDb.collection(collectionName)
    .where('buildingId', '==', buildingId);

  // For units, we can also filter by floor
  if (entityType === 'unit') {
    queryRef = queryRef.where('floor', '==', floorLevel);
  }

  const snapshot = await queryRef.get();

  let maxSequence = 0;

  // Scan each entity's code to find max sequence for this type+floor
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const code = data[codeField] as string | undefined;
    if (!code) continue;

    const parsed = parseEntityCode(code);
    if (!parsed) continue;

    // Match type code and floor code
    if (parsed.typeCode === typeCode && parsed.floorCode === floorCode) {
      if (parsed.sequence > maxSequence) {
        maxSequence = parsed.sequence;
      }
    }
  }

  return maxSequence + 1;
}
