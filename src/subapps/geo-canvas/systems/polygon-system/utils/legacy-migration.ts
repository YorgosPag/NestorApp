/**
 * 🏢 LEGACY POLYGON SYSTEM MIGRATION UTILITIES
 * Smooth transition from legacy systems to centralized system
 *
 * @module polygon-system/utils
 */

import type { UniversalPolygon } from '@geo-alert/core';
import { GEO_COLORS } from '../../../config/color-config';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Potential legacy source data type */
export type LegacySourceData = LegacyPolygonData | LegacyControlPoint[] | Record<string, unknown> | unknown;

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
        migratedAt: new Date().toISOString(),
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

/**
 * Extract legacy control points from various sources
 *
 * @param source Potential source of legacy data
 * @returns LegacyPolygonData or null if no valid data
 */
export function extractLegacyData(source: LegacySourceData): LegacyPolygonData | null {
  // Type guard for object with controlPoints
  const sourceObj = source as Record<string, unknown> | null | undefined;

  // Check for InteractiveMap transformState structure
  if (sourceObj && typeof sourceObj === 'object' && 'controlPoints' in sourceObj && Array.isArray(sourceObj.controlPoints)) {
    return {
      controlPoints: sourceObj.controlPoints as LegacyControlPoint[],
      isComplete: Boolean(sourceObj.isCalibrated) || false,
      completedAt: sourceObj.completedAt ? new Date(String(sourceObj.completedAt)) : undefined
    };
  }

  // Check for direct control points array
  if (Array.isArray(source) && source.length > 0) {
    const firstPoint = source[0] as Record<string, unknown>;
    if (firstPoint && typeof firstPoint === 'object' && 'geoPoint' in firstPoint) {
      return {
        controlPoints: source as LegacyControlPoint[],
        isComplete: source.length >= 3,
        completedAt: new Date()
      };
    }
  }

  return null;
}

/**
 * Migrate multiple legacy polygons
 *
 * @param legacySources Array of potential legacy data sources
 * @returns Array of UniversalPolygon objects
 */
export function migrateLegacyPolygons(legacySources: LegacySourceData[]): UniversalPolygon[] {
  const polygons: UniversalPolygon[] = [];

  for (const source of legacySources) {
    const legacyData = extractLegacyData(source);
    if (legacyData && legacyData.controlPoints.length >= 3) {
      polygons.push(createPolygonFromLegacy(legacyData));
    }
  }

  return polygons;
}

/**
 * Check if data appears to be legacy format
 *
 * @param data Potential legacy data
 * @returns boolean indicating if data is legacy format
 */
export function isLegacyFormat(data: LegacySourceData): boolean {
  if (!data) return false;

  // Type guard for object with controlPoints
  const dataObj = data as Record<string, unknown>;

  // TransformState format
  if (dataObj && typeof dataObj === 'object' && 'controlPoints' in dataObj && Array.isArray(dataObj.controlPoints)) {
    return true;
  }

  // Direct control points array
  if (Array.isArray(data) && data.length > 0) {
    const firstItem = data[0] as Record<string, unknown>;
    if (firstItem && typeof firstItem === 'object' && 'geoPoint' in firstItem) {
      return true;
    }
  }

  return false;
}

/**
 * Validate legacy control point structure
 *
 * @param controlPoint Potential control point object
 * @returns boolean indicating if valid control point
 */
export function isValidLegacyControlPoint(controlPoint: unknown): controlPoint is LegacyControlPoint {
  if (!controlPoint || typeof controlPoint !== 'object') return false;

  const cp = controlPoint as Record<string, unknown>;

  return (
    typeof cp.id === 'string' &&
    cp.geoPoint !== null &&
    typeof cp.geoPoint === 'object' &&
    typeof (cp.geoPoint as Record<string, unknown>).lat === 'number' &&
    typeof (cp.geoPoint as Record<string, unknown>).lng === 'number'
  );
}

/**
 * Migration status and report
 */
export interface MigrationReport {
  success: boolean;
  migratedPolygons: number;
  skippedSources: number;
  errors: string[];
  polygons: UniversalPolygon[];
}

/**
 * Comprehensive migration with error reporting
 *
 * @param legacySources Array of potential legacy data sources
 * @returns MigrationReport with detailed results
 */
export function performLegacyMigration(legacySources: LegacySourceData[]): MigrationReport {
  const report: MigrationReport = {
    success: true,
    migratedPolygons: 0,
    skippedSources: 0,
    errors: [],
    polygons: []
  };

  for (let i = 0; i < legacySources.length; i++) {
    try {
      const source = legacySources[i];
      const legacyData = extractLegacyData(source);

      if (!legacyData) {
        report.skippedSources++;
        continue;
      }

      if (legacyData.controlPoints.length < 3) {
        report.skippedSources++;
        report.errors.push(`Source ${i}: Insufficient control points (${legacyData.controlPoints.length} < 3)`);
        continue;
      }

      // Validate all control points
      const invalidPoints = legacyData.controlPoints.filter(cp => !isValidLegacyControlPoint(cp));
      if (invalidPoints.length > 0) {
        report.errors.push(`Source ${i}: ${invalidPoints.length} invalid control points`);
        report.skippedSources++;
        continue;
      }

      const polygon = createPolygonFromLegacy(legacyData);
      report.polygons.push(polygon);
      report.migratedPolygons++;

    } catch (error) {
      report.success = false;
      report.errors.push(`Source ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      report.skippedSources++;
    }
  }

  if (report.errors.length > 0) {
    console.warn('🔄 Legacy migration completed with warnings:', report);
  } else {
    console.debug('✅ Legacy migration completed successfully:', report);
  }

  return report;
}
