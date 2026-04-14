/**
 * 📊 GEO-STATUS BAR COMPONENT
 *
 * Enterprise status bar overlay για το Interactive Map.
 * ΔΙΑΦΟΡΕΤΙΚΟ από το dxf-viewer StatusBar!
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - Design tokens integration
 * - Zero hardcoded values
 * - Semantic HTML structure
 * - Professional architecture
 *
 * @module GeoStatusBar
 */

'use client';

import React from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FloorPlanControlPoint } from '../../floor-plan-system/types/control-points';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface GeoStatusBarProps {
  /** Map loading state */
  mapLoaded: boolean;

  /** Transformation calibration state */
  isCalibrated: boolean;

  /** Control points for statistics */
  controlPoints: FloorPlanControlPoint[];

  /** Polygon drawing enabled state */
  enablePolygonDrawing?: boolean;

  /** Current polygon drawing state */
  isDrawing?: boolean;

  /** Polygon statistics */
  polygonStats?: {
    totalPolygons: number;
    isDrawing: boolean;
  };

  /** Whether accuracy circles are shown */
  showAccuracyCircles: boolean;

  /** Custom CSS class */
  className?: string;
}

// ============================================================================
// 🌍 GEO-STATUS BAR COMPONENT
// ============================================================================

/**
 * Professional status bar overlay για geographic mapping operations.
 * Εμφανίζει real-time status και statistics για geo operations.
 */
export const GeoStatusBar: React.FC<GeoStatusBarProps> = ({
  mapLoaded,
  isCalibrated,
  controlPoints,
  enablePolygonDrawing = false,
  isDrawing = false,
  polygonStats,
  showAccuracyCircles,
  className = ''
}) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslationLazy('geo-canvas');

  // ========================================================================
  // 🧮 ACCURACY STATISTICS CALCULATION
  // ========================================================================

  const accuracyStats = React.useMemo(() => {
    if (!controlPoints || controlPoints.length === 0) return null;

    const accuracyValues = controlPoints
      .map(cp => cp.accuracy)
      .filter((value): value is number => typeof value === 'number');
    if (accuracyValues.length === 0) return null;

    const avgAccuracy = accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length;
    const bestAccuracy = Math.min(...accuracyValues);

    return {
      avg: avgAccuracy.toFixed(2),
      best: bestAccuracy.toFixed(2)
    };
  }, [controlPoints]);

  // ========================================================================
  // 🎨 RENDER STATUS INDICATORS
  // ========================================================================

  const renderStatusIndicators = () => (
    <div className="space-y-1" role="group" aria-label={t('map.status.indicators')}>
      {/* Map Loading Status */}
      <div className="flex items-center space-x-2">
        <div
          className={`${iconSizes.xs} rounded-full ${mapLoaded ? colors.bg.success : colors.bg.warning}`}
          aria-label={mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}
        />
        <span>{mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}</span>
      </div>

      {/* Transformation Status */}
      {isCalibrated && (
        <div className="flex items-center space-x-2">
          <div className={`${iconSizes.xs} rounded-full ${colors.bg.info}`} aria-label={t('map.status.transformationActive')} />
          <span>{t('map.status.transformationActive')}</span>
        </div>
      )}

      {/* Polygon Drawing Status */}
      {enablePolygonDrawing && polygonStats && (
        <>
          <div className="flex items-center space-x-2">
            <div
              className={`${iconSizes.xs} rounded-full ${polygonStats.isDrawing ? colors.bg.warning : colors.bg.muted}`}
              aria-label={t('map.status.polygons')}
            />
            <span>{t('map.status.polygons')}: {polygonStats.totalPolygons}</span>
          </div>
          {polygonStats.isDrawing && (
            <div className="flex items-center space-x-2">
              <div className={`${iconSizes.xs} rounded-full ${colors.bg.success} animate-pulse`} aria-label={t('map.status.drawingActive')} />
              <span>{t('map.status.drawingActive')}</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ========================================================================
  // 📊 RENDER CONTROL POINTS STATISTICS
  // ========================================================================

  const renderControlPointStats = () => (
    <div className="space-y-1" role="group" aria-label={t('map.status.controlPoints')}>
      <div className={`text-xs ${colors.text.disabled}`}>
        {t('map.status.points')}: {controlPoints?.length ?? 0}
      </div>

      {controlPoints && controlPoints.length > 0 && showAccuracyCircles && accuracyStats && (
        <>
          <div className={`text-xs ${colors.text.disabled}`}>
            {t('accuracy.stats.avgAccuracy')}: {t('accuracy.stats.format', { value: accuracyStats.avg })}
          </div>
          <div className={`text-xs ${colors.text.disabled}`}>
            {t('accuracy.stats.best')}: {t('accuracy.stats.format', { value: accuracyStats.best })}
          </div>
        </>
      )}
    </div>
  );

  // ========================================================================
  // 🎯 MAIN RENDER
  // ========================================================================

  return (
    <footer
      className={`absolute bottom-4 right-4 ${colors.bg.secondary} bg-opacity-90 text-white p-3 rounded-lg shadow-lg ${className}`}
      aria-label={t('map.status.statusBar')}
    >
      <div className="text-sm space-y-2">
        {/* Status Indicators */}
        {renderStatusIndicators()}

        {/* Control Points Statistics */}
        {renderControlPointStats()}
      </div>
    </footer>
  );
};

export default GeoStatusBar;

/**
 * ✅ ENTERPRISE GEO-STATUS BAR COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με enterprise interfaces
 * ✅ Semantic HTML structure (footer, role groups)
 * ✅ i18n support με lazy loading
 * ✅ Accessibility features (aria-labels, roles)
 * ✅ Real-time status indicators με visual feedback
 * ✅ Control points statistics calculation
 * ✅ Polygon drawing status monitoring
 * ✅ Accuracy statistics integration
 * ✅ Transformation calibration status
 * ✅ Zero inline styles - only design token classes
 * ✅ Component composition pattern
 *
 * Differentiators από dxf-viewer StatusBar:
 * <Globe/> Geo-specific status indicators (όχι DXF entities)
 * <Target/> Control points statistics (όχι drawing entities)
 * Coordinate transformation status (όχι CAD operations)
 * <Map/> Map-specific states (loading, calibration)
 * <BarChart3/> Accuracy metrics integration
 *
 * Enterprise Benefits:
 * <Target/> Single Responsibility - Μόνο geo status display logic
 * <Recycle/> Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα geo contexts
 * <FlaskConical/> Testability - Isolated component με clear props
 * <BarChart3/> Analytics Ready - Built-in statistics calculation
 * <Languages/> i18n Ready - Πλήρης υποστήριξη internationalization
 * <Zap/> Performance - Optimized με useMemo για calculations
 */
