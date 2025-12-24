'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGeoTransform } from '../hooks/useGeoTransform';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { dxfGeoTransformService } from '../services/geo-transform/DxfGeoTransform';
import type { DxfCoordinate, GeoCoordinate, SpatialEntity } from '../types';

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
  const { quick } = useBorderTokens();
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
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-blue-400">
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
          <label className="block text-sm text-gray-400 mb-1">
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
            <label className="block text-sm text-gray-400 mb-1">
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
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-blue-400">
        📊 Transformation Statistics
      </h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">{t('hardcodedTexts.labels.dxfEntities')}</span>
          <span className="text-white">{previewStats.entityCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">{t('hardcodedTexts.labels.transformed')}</span>
          <span className="text-green-400">{previewStats.transformedCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">{t('hardcodedTexts.labels.errors')}</span>
          <span className={previewStats.errorCount > 0 ? 'text-red-400' : 'text-gray-400'}>
            {previewStats.errorCount}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">{t('hardcodedTexts.labels.processingLabel')}</span>
          <span className="text-blue-400">{previewStats.processingTime.toFixed(1)}ms</span>
        </div>
      </div>

      {transformState.isCalibrated && transformState.accuracy && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('hardcodedTexts.labels.rmsAccuracy')}</span>
            <span className="text-yellow-400">±{transformState.accuracy.toFixed(3)}m</span>
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
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-3 text-blue-400">
          📐 Layer Information
        </h3>

        <div className="space-y-2 text-sm">
          {Object.entries(layerStats).map(([layer, count]) => (
            <div key={layer} className="flex justify-between">
              <span className="text-gray-400">{layer}:</span>
              <span className="text-white">{count} entities</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ========================================================================
  // ACTION BUTTONS
  // ========================================================================

  const renderActionButtons = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="space-y-2">
        <button
          onClick={processTransformation}
          disabled={!transformState.isCalibrated || !dxfScene}
          className={`w-full bg-blue-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors`}
        >
          🔄 Refresh Preview
        </button>

        {transformedGeoJSON && (
          <button
            onClick={() => {
              // Export GeoJSON
              const dataStr = JSON.stringify(transformedGeoJSON, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'transformed_dxf.geojson';
              link.click();
              URL.revokeObjectURL(url);
            }}
            className={`w-full bg-green-600 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} text-white py-2 px-4 rounded transition-colors`}
          >
            💾 Export GeoJSON
          </button>
        )}
      </div>
    </div>
  );

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  if (!transformState.isCalibrated) {
    return (
      <div className={`w-full max-w-md space-y-4 ${className}`}>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">📐</div>
          <h3 className="text-lg font-semibold text-yellow-400 mb-2">
            Transformation Required
          </h3>
          <p className="text-sm text-gray-400">
            Calibrate the transformation system με control points για preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-md space-y-4 ${className}`}>
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-400 mb-2">
          🔄 Transformation Preview
        </h2>
        <p className="text-sm text-gray-400">
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
      <div className={`bg-blue-900/20 ${quick.card} border-blue-600 p-4`}>
        <h4 className="font-semibold text-blue-400 mb-2">📋 Preview Data:</h4>
        <div className="text-sm text-blue-300 space-y-1">
          <div>• Transformed GeoJSON: {transformedGeoJSON ? 'Available' : 'None'}</div>
          <div>• Preview Grid: {generatePreviewGrid ? 'Generated' : 'Disabled'}</div>
          <div>• Accuracy Indicators: {generateAccuracyIndicators ? 'Generated' : 'Disabled'}</div>
        </div>
      </div>
    </div>
  );
}

export default TransformationPreview;