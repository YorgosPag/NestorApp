'use client';

import React, { useState } from 'react';
import { useGeoTransform } from '../hooks/useGeoTransform';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import type { DxfCoordinate, GeoCoordinate } from '../types';

/**
 * GEOREFERENCING PANEL COMPONENT
 * Enterprise UI για DXF georeferencing workflow
 * Phase 2: Core transformation functionality
 */
export function GeoreferencingPanel() {
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const [transformState, transformActions] = useGeoTransform();
  const [showAddPoint, setShowAddPoint] = useState(false);
  const [newPointData, setNewPointData] = useState({
    dxfX: '',
    dxfY: '',
    geoLng: '',
    geoLat: '',
    accuracy: '1.0',
    description: ''
  });

  // Show loading while translations are being loaded
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Φόρτωση...</p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // CONTROL POINT MANAGEMENT
  // ========================================================================

  const handleAddPoint = async () => {
    try {
      const dxfPoint: DxfCoordinate = {
        x: parseFloat(newPointData.dxfX),
        y: parseFloat(newPointData.dxfY)
      };

      const geoPoint: GeoCoordinate = {
        lng: parseFloat(newPointData.geoLng),
        lat: parseFloat(newPointData.geoLat)
      };

      await transformActions.addControlPoint(dxfPoint, geoPoint, {
        accuracy: parseFloat(newPointData.accuracy),
        description: newPointData.description || undefined
      });

      // Reset form
      setNewPointData({
        dxfX: '',
        dxfY: '',
        geoLng: '',
        geoLat: '',
        accuracy: '1.0',
        description: ''
      });
      setShowAddPoint(false);
    } catch (error) {
      console.error('Failed to add control point:', error);
    }
  };

  const handleCalibrate = async () => {
    await transformActions.calibrateTransformation('affine');
  };

  // ========================================================================
  // VALIDATION STATUS DISPLAY
  // ========================================================================

  const renderValidationStatus = () => {
    const { validation } = transformState;
    if (!validation) return null;

    const getStatusColor = () => {
      if (validation.errors.length > 0) return 'text-red-400';
      if (validation.warnings.length > 0) return 'text-yellow-400';
      return 'text-green-400';
    };

    const getStatusIcon = () => {
      if (validation.errors.length > 0) return '❌';
      if (validation.warnings.length > 0) return '⚠️';
      return '✅';
    };

    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-3 text-blue-400">
          {t('validation.status')}
        </h3>

        <div className={`flex items-center mb-3 ${getStatusColor()}`}>
          <span className="mr-2">{getStatusIcon()}</span>
          <span className="font-medium">
            {validation.isValid ? t('validation.ready') : t('validation.needsImprovement')}
          </span>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-400">{t('validation.statistics.controlPoints')}</span>
            <span className="ml-2 text-white">{validation.statistics.count}</span>
          </div>
          <div>
            <span className="text-gray-400">{t('validation.statistics.avgAccuracy')}</span>
            <span className="ml-2 text-white">
              {validation.statistics.averageAccuracy.toFixed(2)}m
            </span>
          </div>
          <div>
            <span className="text-gray-400">{t('validation.statistics.maxError')}</span>
            <span className="ml-2 text-white">
              {validation.statistics.maxError.toFixed(2)}m
            </span>
          </div>
          <div>
            <span className="text-gray-400">{t('validation.statistics.distribution')}</span>
            <span className="ml-2 text-white capitalize">
              {validation.statistics.spatialDistribution}
            </span>
          </div>
        </div>

        {/* Errors */}
        {validation.errors.length > 0 && (
          <div className="mb-3">
            <h4 className="text-red-400 font-medium mb-2">{t('validation.sections.errors')}</h4>
            <ul className="text-sm text-red-300 space-y-1">
              {validation.errors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div className="mb-3">
            <h4 className="text-yellow-400 font-medium mb-2">{t('validation.sections.warnings')}</h4>
            <ul className="text-sm text-yellow-300 space-y-1">
              {validation.warnings.map((warning, i) => (
                <li key={i}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {validation.recommendations.length > 0 && (
          <div>
            <h4 className="text-blue-400 font-medium mb-2">{t('validation.sections.recommendations')}</h4>
            <ul className="text-sm text-blue-300 space-y-1">
              {validation.recommendations.map((rec, i) => (
                <li key={i}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // ========================================================================
  // CONTROL POINTS LIST
  // ========================================================================

  const renderControlPointsList = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-400">
          {t('panelTitle')} ({transformState.controlPoints.length})
        </h3>
        <button
          onClick={() => setShowAddPoint(!showAddPoint)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          {showAddPoint ? t('buttons.cancel') : t('actions.addPoint')}
        </button>
      </div>

      {/* Add Point Form */}
      {showAddPoint && (
        <div className="bg-gray-700 rounded p-4 mb-4">
          <h4 className="font-medium mb-3">{t('addControlPoint')}</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('form.dxfX')}</label>
              <input
                type="number"
                value={newPointData.dxfX}
                onChange={(e) => setNewPointData(prev => ({ ...prev, dxfX: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('form.dxfY')}</label>
              <input
                type="number"
                value={newPointData.dxfY}
                onChange={(e) => setNewPointData(prev => ({ ...prev, dxfY: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('form.geoLng')}</label>
              <input
                type="number"
                value={newPointData.geoLng}
                onChange={(e) => setNewPointData(prev => ({ ...prev, geoLng: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                placeholder="23.7275"
                step="0.000001"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('form.geoLat')}</label>
              <input
                type="number"
                value={newPointData.geoLat}
                onChange={(e) => setNewPointData(prev => ({ ...prev, geoLat: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                placeholder="37.9755"
                step="0.000001"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Accuracy (m):</label>
              <input
                type="number"
                value={newPointData.accuracy}
                onChange={(e) => setNewPointData(prev => ({ ...prev, accuracy: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                placeholder="1.0"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description:</label>
              <input
                type="text"
                value={newPointData.description}
                onChange={(e) => setNewPointData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => setShowAddPoint(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {t('controlPoints.cancel')}
            </button>
            <button
              onClick={handleAddPoint}
              disabled={!newPointData.dxfX || !newPointData.dxfY || !newPointData.geoLng || !newPointData.geoLat}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {t('controlPoints.addPoint')}
            </button>
          </div>
        </div>
      )}

      {/* Points List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {transformState.controlPoints.map((point) => (
          <div
            key={point.id}
            className={`p-3 rounded border transition-colors ${
              transformState.selectedPointId === point.id
                ? 'bg-blue-900 border-blue-600'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-650'
            }`}
            onClick={() => transformActions.selectControlPoint(
              transformState.selectedPointId === point.id ? null : point.id
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-blue-300">{point.id}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  transformActions.removeControlPoint(point.id);
                }}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-gray-300">
              <div>
                <div>DXF: ({point.dxfPoint.x.toFixed(2)}, {point.dxfPoint.y.toFixed(2)})</div>
              </div>
              <div>
                <div>Geo: ({point.geoPoint.lng.toFixed(6)}, {point.geoPoint.lat.toFixed(6)})</div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 text-xs">
              <span className="text-gray-400">±{point.accuracy}m</span>
              {point.description && (
                <span className="text-gray-400 truncate max-w-32">{point.description}</span>
              )}
            </div>
          </div>
        ))}

        {transformState.controlPoints.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📍</div>
            <p>{t('controlPoints.noPointsYet')}</p>
            <p className="text-sm">{t('controlPoints.addMinimumPoints')}</p>
          </div>
        )}
      </div>
    </div>
  );

  // ========================================================================
  // TRANSFORMATION CONTROLS
  // ========================================================================

  const renderTransformationControls = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-4 text-blue-400">
        {t('transformation.controls')}
      </h3>

      {/* Calibration Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">{t('transformation.status')}</span>
          <div className="flex items-center">
            {transformState.isCalibrated ? (
              <>
                <span className="text-green-400 mr-2">{t('transformation.calibrated')}</span>
                <span className="text-sm text-gray-400">
                  ({transformState.method}, ±{transformState.accuracy?.toFixed(3)}m)
                </span>
              </>
            ) : transformState.isCalibrating ? (
              <span className="text-yellow-400">{t('transformation.calibrating')}</span>
            ) : (
              <span className="text-gray-400">{t('transformation.notCalibrated')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleCalibrate}
          disabled={
            transformState.controlPoints.length < 3 ||
            transformState.isCalibrating ||
            transformState.validation?.errors.length !== 0
          }
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
        >
          {transformState.isCalibrating ? t('transformation.calibratingButton') : t('transformation.calibrateTransformation')}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={transformActions.saveControlPoints}
            disabled={transformState.controlPoints.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded text-sm transition-colors"
          >
            {t('controlPoints.savePoints')}
          </button>

          <button
            onClick={transformActions.loadControlPoints}
            className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-sm transition-colors"
          >
            {t('controlPoints.loadPoints')}
          </button>
        </div>

        <button
          onClick={transformActions.clearControlPoints}
          disabled={transformState.controlPoints.length === 0}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded text-sm transition-colors"
        >
          {t('controlPoints.clearAllPoints')}
        </button>
      </div>
    </div>
  );

  // ========================================================================
  // ERROR DISPLAY
  // ========================================================================

  const renderError = () => {
    if (!transformState.error) return null;

    return (
      <div className="bg-red-900 border border-red-600 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-red-300">❌ Error: {transformState.error}</span>
          <button
            onClick={transformActions.clearError}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-400 mb-2">
          {t('panelHeader.title')}
        </h2>
        <p className="text-sm text-gray-400">
          {t('panelHeader.subtitle')}
        </p>
        {transformState.lastOperation && (
          <p className="text-xs text-green-400 mt-2">
            ✓ {transformState.lastOperation}
          </p>
        )}
      </div>

      {/* Error Display */}
      {renderError()}

      {/* Validation Status */}
      {renderValidationStatus()}

      {/* Control Points Management */}
      {renderControlPointsList()}

      {/* Transformation Controls */}
      {renderTransformationControls()}
    </div>
  );
}

export default GeoreferencingPanel;