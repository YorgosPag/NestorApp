/**
 * 🏢 LEGACY POLYGON SYSTEM MIGRATION UTILITIES
 * Smooth transition from legacy systems to centralized system
 *
 * @module polygon-system/utils
 */

import type { UniversalPolygon } from '@geo-alert/core';
import { isNonEmptyArray } from '@/lib/type-guards';
import { GEO_COLORS } from '../../../config/color-config';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Legacy control point structure (from InteractiveMap)
 */
interface LegacyControlPoint {
  id: string;
  geoPoint: {
    lat: number;
    lng: number;
  };
  dxfPoint?: {
    x: number;
    y: number;
  };
}

/**
 * Legacy polygon data structure
 */
interface LegacyPolygonData {
  controlPoints: LegacyControlPoint[];
  isComplete: boolean;
  completedAt?: Date;
}

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Convert legacy control points to UniversalPolygon
 *
 * @param legacyData Legacy polygon data from InteractiveMap
 * @returns UniversalPolygon compatible object
 */
export function createPolygonFromLegacy(legacyData: LegacyPolygonData): UniversalPolygon {
  const points = legacyData.controlPoints.map((cp, index) => ({
    id: cp.id || `legacy-point-${index}`,
    x: cp.geoPoint.lng,
    y: cp.geoPoint.lat,
    isControlPoint: true,
    sourceType: 'manual' as const
  }));

  return {
    id: `legacy_${Date.now()}`,
    type: 'simple',
    points,
    isClosed: legacyData.isComplete,
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Legacy polygon migration',
      properties: {
        source: 'legacy-migration',
        originalControlPoints: legacyData.controlPoints,
        migratedAt: nowISO(),
        isComplete: legacyData.isComplete
      }
    },
    style: {
      fillColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.COMPLETED, 0.3),
      strokeColor: GEO_COLORS.POLYGON.COMPLETED,
      strokeWidth: 3,
      fillOpacity: 0.3,
      strokeOpacity: 1
    }
  };
}


