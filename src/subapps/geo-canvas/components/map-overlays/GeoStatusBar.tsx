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
import type { GeoControlPoint } from '../../types';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface GeoStatusBarProps {
  /** Map loading state */
  mapLoaded: boolean;

  /** Transformation calibration state */
  isCalibrated: boolean;

  /** Control points for statistics */
  controlPoints: GeoControlPoint[];

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
  const { t } = useTranslationLazy('geo-canvas');

  // ========================================================================
  // 🧮 ACCURACY STATISTICS CALCULATION
  // ========================================================================

  const accuracyStats = React.useMemo(() => {
    if (controlPoints.length === 0) return null;

    const accuracyValues = controlPoints.map(cp => cp.accuracy);
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
          className={`w-2 h-2 rounded-full ${mapLoaded ? 'bg-green-400' : 'bg-yellow-400'}`}
          aria-label={mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}
        />
        <span>{mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}</span>
      </div>

      {/* Transformation Status */}
      {isCalibrated && (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" aria-label={t('map.status.transformationActive')} />
          <span>{t('map.status.transformationActive')}</span>
        </div>
      )}

      {/* Polygon Drawing Status */}
      {enablePolygonDrawing && polygonStats && (
        <>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${polygonStats.isDrawing ? 'bg-yellow-400' : 'bg-gray-400'}`}
              aria-label={t('map.status.polygons')}
            />
            <span>{t('map.status.polygons')}: {polygonStats.totalPolygons}</span>
          </div>
          {polygonStats.isDrawing && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-label={t('map.status.drawingActive')} />
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
      <div className="text-xs text-gray-400">
        {t('map.status.points')}: {controlPoints.length}
      </div>

      {controlPoints.length > 0 && showAccuracyCircles && accuracyStats && (
        <>
          <div className="text-xs text-gray-400">
            {t('accuracy.stats.avgAccuracy')}: {t('accuracy.stats.format', { value: accuracyStats.avg })}
          </div>
          <div className="text-xs text-gray-400">
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
      className={`absolute bottom-4 right-4 bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-lg ${className}`}
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
 * 🌍 Geo-specific status indicators (όχι DXF entities)
 * 🎯 Control points statistics (όχι drawing entities)
 * 📍 Coordinate transformation status (όχι CAD operations)
 * 🗺️ Map-specific states (loading, calibration)
 * 📊 Accuracy metrics integration
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο geo status display logic
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα geo contexts
 * 🧪 Testability - Isolated component με clear props
 * 📊 Analytics Ready - Built-in statistics calculation
 * 🌐 i18n Ready - Πλήρης υποστήριξη internationalization
 * ⚡ Performance - Optimized με useMemo για calculations
 */