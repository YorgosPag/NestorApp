/**
 * 🏢 LEGACY POLYGON SYSTEM MIGRATION UTILITIES
 * Smooth transition from legacy systems to centralized system
 *
 * @module polygon-system/utils
 */

import type { UniversalPolygon } from '@geo-alert/core';

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
  const coordinates = legacyData.controlPoints.map(cp => [
    cp.geoPoint.lng,
    cp.geoPoint.lat
  ]);

  // Close polygon if complete and has 3+ points
  if (legacyData.isComplete && coordinates.length >= 3) {
    coordinates.push(coordinates[0]);
  }

  return {
    id: `legacy_${Date.now()}`,
    type: 'simple',
    coordinates,
    properties: {
      source: 'legacy-migration',
      originalControlPoints: legacyData.controlPoints,
      migratedAt: new Date().toISOString(),
      isComplete: legacyData.isComplete
    },
    style: {
      fillColor: 'rgba(16, 185, 129, 0.3)',
      strokeColor: '#10b981',
      strokeWidth: 3
    }
  };
}

/**
 * Extract legacy control points from various sources
 *
 * @param source Potential source of legacy data
 * @returns LegacyPolygonData or null if no valid data
 */
export function extractLegacyData(source: any): LegacyPolygonData | null {
  // Check for InteractiveMap transformState structure
  if (source?.controlPoints && Array.isArray(source.controlPoints)) {
    return {
      controlPoints: source.controlPoints,
      isComplete: source.isCalibrated || false,
      completedAt: source.completedAt ? new Date(source.completedAt) : undefined
    };
  }

  // Check for direct control points array
  if (Array.isArray(source) && source.length > 0) {
    const firstPoint = source[0];
    if (firstPoint?.geoPoint) {
      return {
        controlPoints: source,
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
export function migrateLegacyPolygons(legacySources: any[]): UniversalPolygon[] {
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
export function isLegacyFormat(data: any): boolean {
  return !!(
    data &&
    (
      // TransformState format
      (data.controlPoints && Array.isArray(data.controlPoints)) ||
      // Direct control points array
      (Array.isArray(data) && data[0]?.geoPoint)
    )
  );
}

/**
 * Validate legacy control point structure
 *
 * @param controlPoint Potential control point object
 * @returns boolean indicating if valid control point
 */
export function isValidLegacyControlPoint(controlPoint: any): controlPoint is LegacyControlPoint {
  return !!(
    controlPoint &&
    typeof controlPoint.id === 'string' &&
    controlPoint.geoPoint &&
    typeof controlPoint.geoPoint.lat === 'number' &&
    typeof controlPoint.geoPoint.lng === 'number'
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
export function performLegacyMigration(legacySources: any[]): MigrationReport {
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
    console.log('✅ Legacy migration completed successfully:', report);
  }

  return report;
}