'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGeoTransform } from '../hooks/useGeoTransform';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { dxfGeoTransformService } from '../services/geo-transform/DxfGeoTransform';
import type { DxfCoordinate, GeoCoordinate, SpatialEntity } from '../types';
// 🏭 SMART ACTION FACTORY - ZERO DUPLICATES
import { createSmartActionGroup } from '@/core/actions/SmartActionFactory';
import type { SmartActionConfig } from '@/core/actions/SmartActionFactory';

// Import DXF scene types
import type { SceneModel, AnySceneEntity } from '../../dxf-viewer/types/scene';

// ============================================================================
// TRANSFORMATION PREVIEW TYPES
// ============================================================================

export interface TransformationPreviewProps {
  dxfScene?: SceneModel;
  showGrid?: boolean;
  showAccuracyIndicators?: boolean;
  onTransformedDataChange?: (geoJson: GeoJSON.FeatureCollection) => void;
  className?: string;
}

interface PreviewSettings {
  showEntities: boolean;
  showControlPoints: boolean;
  showAccuracyCircles: boolean;
  showTransformationGrid: boolean;
  entityOpacity: number;
  gridSpacing: number;
}

// ============================================================================
// TRANSFORMATION PREVIEW COMPONENT
// ============================================================================

/**
 * REAL-TIME TRANSFORMATION PREVIEW
 * Enterprise component για visual preview του transformed DXF content
 * Phase 3: Shows DXF entities overlaid on geographic map
 */
export function TransformationPreview({
  dxfScene,
  showGrid = true,
  showAccuracyIndicators = true,
  onTransformedDataChange,
  className = ''
}: TransformationPreviewProps) {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { t } = useTranslationLazy('geo-canvas');
  const [transformState] = useGeoTransform();
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    showEntities: true,
    showControlPoints: true,
    showAccuracyCircles: true,
    showTransformationGrid: false,
    entityOpacity: 0.8,
    gridSpacing: 100
  });

  const [transformedGeoJSON, setTransformedGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [previewStats, setPreviewStats] = useState({
    entityCount: 0,
    transformedCount: 0,
    errorCount: 0,
    processingTime: 0
  });

  // ========================================================================
  // TRANSFORMATION PROCESSING
  // ========================================================================

  const processTransformation = useCallback(async () => {
    if (!transformState.isCalibrated || !dxfScene) {
      setTransformedGeoJSON(null);
      return;
    }

    const startTime = performance.now();

    try {
      // Transform DXF scene → GeoJSON
      const geoJsonResult = await dxfGeoTransformService.transformSceneToGeoJSON(
        dxfScene,
        {
          includeInvisible: false,
          // Filter by layer if needed
          // layerFilter: ['0', 'DIMENSIONS'],
          // entityTypeFilter: ['line', 'polyline', 'circle']
        }
      );

      const processingTime = performance.now() - startTime;

      setTransformedGeoJSON(geoJsonResult);
      setPreviewStats({
        entityCount: dxfScene.entities.length,
        transformedCount: geoJsonResult.features.length,
        errorCount: dxfScene.entities.length - geoJsonResult.features.length,
        processingTime
      });

      // Notify parent component
      if (onTransformedDataChange) {
        onTransformedDataChange(geoJsonResult);
      }
    } catch (error) {
      console.error('Transformation preview failed:', error);
      setTransformedGeoJSON(null);
      setPreviewStats(prev => ({ ...prev, errorCount: dxfScene.entities.length }));
    }
  }, [transformState.isCalibrated, dxfScene, onTransformedDataChange]);

  // Auto-process when transformation state changes
  useEffect(() => {
    processTransformation();
  }, [processTransformation]);

  // ========================================================================
  // PREVIEW GRID GENERATION
  // ========================================================================

  const generatePreviewGrid = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!previewSettings.showTransformationGrid || !transformState.isCalibrated) {
      return null;
    }

    const features: GeoJSON.Feature[] = [];
    const { gridSpacing } = previewSettings;

    // Calculate grid bounds από control points
    const controlPoints = transformState.controlPoints;
    if (controlPoints.length === 0) return null;

    const dxfPoints = controlPoints.map(cp => cp.dxfPoint);
    const minX = Math.min(...dxfPoints.map(p => p.x));
    const maxX = Math.max(...dxfPoints.map(p => p.x));
    const minY = Math.min(...dxfPoints.map(p => p.y));
    const maxY = Math.max(...dxfPoints.map(p => p.y));

    // Extend bounds slightly
    const padding = gridSpacing;
    const gridMinX = Math.floor((minX - padding) / gridSpacing) * gridSpacing;
    const gridMaxX = Math.ceil((maxX + padding) / gridSpacing) * gridSpacing;
    const gridMinY = Math.floor((minY - padding) / gridSpacing) * gridSpacing;
    const gridMaxY = Math.ceil((maxY + padding) / gridSpacing) * gridSpacing;

    // Generate grid lines
    for (let x = gridMinX; x <= gridMaxX; x += gridSpacing) {
      try {
        const startGeo = dxfGeoTransformService.transformDxfToGeo({ x, y: gridMinY });
        const endGeo = dxfGeoTransformService.transformDxfToGeo({ x, y: gridMaxY });

        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [startGeo.lng, startGeo.lat],
              [endGeo.lng, endGeo.lat]
            ]
          },
          properties: {
            type: 'grid_line',
            direction: 'vertical',
            dxfX: x
          }
        });
      } catch (error) {
        // Skip invalid transformations
      }
    }

    for (let y = gridMinY; y <= gridMaxY; y += gridSpacing) {
      try {
        const startGeo = dxfGeoTransformService.transformDxfToGeo({ x: gridMinX, y });
        const endGeo = dxfGeoTransformService.transformDxfToGeo({ x: gridMaxX, y });

        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [startGeo.lng, startGeo.lat],
              [endGeo.lng, endGeo.lat]
            ]
          },
          properties: {
            type: 'grid_line',
            direction: 'horizontal',
            dxfY: y
          }
        });
      } catch (error) {
        // Skip invalid transformations
      }
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }, [previewSettings.showTransformationGrid, previewSettings.gridSpacing, transformState.isCalibrated, transformState.controlPoints]);

  // ========================================================================
  // ACCURACY INDICATORS
  // ========================================================================

  const generateAccuracyIndicators = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!previewSettings.showAccuracyCircles || !transformState.validation) {
      return null;
    }

    const features: GeoJSON.Feature[] = [];

    // Add accuracy circles around control points
    transformState.controlPoints.forEach(cp => {
      // Create circle approximation
      const numVertices = 32;
      const radiusInDegrees = cp.accuracy / 111320; // Convert meters to degrees (approximate)
      const coordinates: number[][] = [];

      for (let i = 0; i <= numVertices; i++) {
        const angle = (i / numVertices) * 2 * Math.PI;
        const lng = cp.geoPoint.lng + radiusInDegrees * Math.cos(angle);
        const lat = cp.geoPoint.lat + radiusInDegrees * Math.sin(angle);
        coordinates.push([lng, lat]);
      }

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        properties: {
          type: 'accuracy_circle',
          controlPointId: cp.id,
          accuracy: cp.accuracy,
          description: cp.description
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }, [previewSettings.showAccuracyCircles, transformState.controlPoints, transformState.validation]);

  // ========================================================================
  // SETTINGS CONTROLS
  // ========================================================================

  const renderSettingsControls = () => (
    <div className={`${colors.bg.primary} rounded-lg p-4 mb-4`}>
      <h3 className={`text-lg font-semibold mb-3 ${colors.text.accent}`}>
        ⚙️ Preview Settings
      </h3>

      <div className="space-y-3">
        {/* Visibility toggles */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={previewSettings.showEntities}
              onChange={(e) => setPreviewSettings(prev => ({ ...prev, showEntities: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('hardcodedTexts.actions.showDxfEntities')}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={previewSettings.showControlPoints}
              onChange={(e) => setPreviewSettings(prev => ({ ...prev, showControlPoints: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('hardcodedTexts.actions.showControlPoints')}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={previewSettings.showAccuracyCircles}
              onChange={(e) => setPreviewSettings(prev => ({ ...prev, showAccuracyCircles: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('hardcodedTexts.actions.showAccuracyCircles')}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={previewSettings.showTransformationGrid}
              onChange={(e) => setPreviewSettings(prev => ({ ...prev, showTransformationGrid: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">{t('hardcodedTexts.actions.showGrid')}</span>
          </label>
        </div>

        {/* Opacity slider */}
        <div>
          <label className={`block text-sm ${colors.text.muted} mb-1`}>
            Entity Opacity: {Math.round(previewSettings.entityOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={previewSettings.entityOpacity}
            onChange={(e) => setPreviewSettings(prev => ({ ...prev, entityOpacity: parseFloat(e.target.value) }))}
            className="w-full"
          />
        </div>

        {/* Grid spacing */}
        {previewSettings.showTransformationGrid && (
          <div>
            <label className={`block text-sm ${colors.text.muted} mb-1`}>
              Grid Spacing: {previewSettings.gridSpacing}m
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={previewSettings.gridSpacing}
              onChange={(e) => setPreviewSettings(prev => ({ ...prev, gridSpacing: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );

  // ========================================================================
  // STATISTICS DISPLAY
  // ========================================================================

  const renderStatistics = () => (
    <div className={`${colors.bg.primary} rounded-lg p-4 mb-4`}>
      <h3 className={`text-lg font-semibold mb-3 ${colors.text.accent}`}>
        <BarChart3 className={`${iconSizes.sm} inline-block mr-2`} />
        Transformation Statistics
      </h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between">
          <span className={colors.text.muted}>{t('hardcodedTexts.labels.dxfEntities')}</span>
          <span className={colors.text.foreground}>{previewStats.entityCount}</span>
        </div>

        <div className="flex justify-between">
          <span className={colors.text.muted}>{t('hardcodedTexts.labels.transformed')}</span>
          <span className={colors.text.success}>{previewStats.transformedCount}</span>
        </div>

        <div className="flex justify-between">
          <span className={colors.text.muted}>{t('hardcodedTexts.labels.errors')}</span>
          <span className={previewStats.errorCount > 0 ? colors.text.error : colors.text.muted}>
            {previewStats.errorCount}
          </span>
        </div>

        <div className="flex justify-between">
          <span className={colors.text.muted}>{t('hardcodedTexts.labels.processingLabel')}</span>
          <span className={colors.text.accent}>{previewStats.processingTime.toFixed(1)}ms</span>
        </div>
      </div>

      {transformState.isCalibrated && transformState.accuracy && (
        <div className={`mt-3 pt-3 ${quick.separatorH}`}>
          <div className="flex justify-between text-sm">
            <span className={colors.text.muted}>{t('hardcodedTexts.labels.rmsAccuracy')}</span>
            <span className={colors.text.warning}>±{transformState.accuracy.toFixed(3)}m</span>
          </div>
        </div>
      )}
    </div>
  );

  // ========================================================================
  // LAYER INFORMATION
  // ========================================================================

  const renderLayerInfo = () => {
    if (!transformedGeoJSON || !dxfScene) return null;

    // Count features by layer
    const layerStats = transformedGeoJSON.features.reduce((stats, feature) => {
      const layer = feature.properties?.layer || 'Unknown';
      stats[layer] = (stats[layer] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    return (
      <div className={`${colors.bg.primary} rounded-lg p-4 mb-4`}>
        <h3 className={`text-lg font-semibold mb-3 ${colors.text.accent}`}>
          📐 Layer Information
        </h3>

        <div className="space-y-2 text-sm">
          {Object.entries(layerStats).map(([layer, count]) => (
            <div key={layer} className="flex justify-between">
              <span className={colors.text.muted}>{layer}:</span>
              <span className={colors.text.foreground}>{count} entities</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ========================================================================
  // ACTION BUTTONS
  // ========================================================================

  const renderActionButtons = () => {
    const actions: SmartActionConfig[] = [
      {
        action: 'refresh' as const,
        variant: 'primary' as const,
        label: 'Refresh Preview',
        icon: <RefreshCw className={iconSizes.sm} />,
        onClick: () => { void processTransformation(); },
        disabled: !transformState.isCalibrated || !dxfScene
      }
    ];

    // Add export action conditionally
    if (transformedGeoJSON) {
      actions.push({
        action: 'export',
        variant: 'success',
        label: '💾 Export GeoJSON',
        onClick: () => {
          // Export GeoJSON
          const dataStr = JSON.stringify(transformedGeoJSON, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'transformed_dxf.geojson';
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    }

    return createSmartActionGroup({
      entityType: 'geo-canvas',
      layout: 'vertical',
      spacing: 'tight',
      actions
    });
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  if (!transformState.isCalibrated) {
    return (
      <div className={`w-full max-w-md space-y-4 ${className}`}>
        <div className={`${colors.bg.primary} rounded-lg p-6 text-center`}>
          <div className="text-4xl mb-4">📐</div>
          <h3 className={`text-lg font-semibold ${colors.text.warning} mb-2`}>
            Transformation Required
          </h3>
          <p className={`text-sm ${colors.text.muted}`}>
            Calibrate the transformation system με control points για preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-md space-y-4 ${className}`}>
      {/* Header */}
      <div className={`${colors.bg.primary} rounded-lg p-4`}>
        <h2 className={`text-xl font-bold ${colors.text.accent} mb-2`}>
          <RefreshCw className={`${iconSizes.sm} inline-block mr-2`} />
          Transformation Preview
        </h2>
        <p className={`text-sm ${colors.text.muted}`}>
          Real-time DXF → Geographic visualization
        </p>
      </div>

      {/* Settings Controls */}
      {renderSettingsControls()}

      {/* Statistics */}
      {renderStatistics()}

      {/* Layer Information */}
      {renderLayerInfo()}

      {/* Action Buttons */}
      {renderActionButtons()}

      {/* Status */}
      <div className={`${colors.bg.info}/20 ${quick.card} ${getStatusBorder('info')} p-4`}>  {/* Preview data = Info semantic */}
        <h4 className={`font-semibold ${colors.text.accent} mb-2`}>📋 Preview Data:</h4>
        <div className={`text-sm ${colors.text.info} space-y-1`}>
          <div>• Transformed GeoJSON: {transformedGeoJSON ? 'Available' : 'None'}</div>
          <div>• Preview Grid: {generatePreviewGrid ? 'Generated' : 'Disabled'}</div>
          <div>• Accuracy Indicators: {generateAccuracyIndicators ? 'Generated' : 'Disabled'}</div>
        </div>
      </div>
    </div>
  );
}

export default TransformationPreview;

