'use client';

import React, { useState } from 'react';
import { useGeoTransform } from '../hooks/useGeoTransform';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import type { DxfCoordinate, GeoCoordinate } from '../types';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import { MapPin, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

/**
 * GEOREFERENCING PANEL COMPONENT
 * Enterprise UI για DXF georeferencing workflow
 * Phase 2: Core transformation functionality
 */
export function GeoreferencingPanel() {
  const colors = useSemanticColors();
  const { quick, getStatusBorder } = useBorderTokens();
  const iconSizes = useIconSizes();
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
          <AnimatedSpinner size="medium" className="mx-auto mb-4" />
          <p className={colors.text.muted}>{t('loadingStates.loading')}</p>
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

    // 🏢 ENTERPRISE: Get validation status color using centralized useSemanticColors system
    const getStatusColor = () => {
      if (validation.errors.length > 0) return colors.text.error;     // Enterprise red error color
      if (validation.warnings.length > 0) return colors.text.warning; // Enterprise yellow warning color
      return colors.text.success;                                     // Enterprise green success color
    };

    const getStatusIcon = () => {
      if (validation.errors.length > 0) return <XCircle className={iconSizes.sm} />;
      if (validation.warnings.length > 0) return <AlertTriangle className={iconSizes.sm} />;
      return <CheckCircle className={iconSizes.sm} />;
    };

    return (
      <div className={`${colors.bg.primary} ${quick.card} p-4 mb-4`}>
        <h3 className={`text-lg font-semibold mb-3 ${colors.text.accent}`}>
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
            <span className={colors.text.muted}>{t('validation.statistics.controlPoints')}</span>
            <span className={`ml-2 ${colors.text.foreground}`}>{validation.statistics.count}</span>
          </div>
          <div>
            <span className={colors.text.muted}>{t('validation.statistics.avgAccuracy')}</span>
            <span className={`ml-2 ${colors.text.foreground}`}>
              {validation.statistics.averageAccuracy.toFixed(2)}m
            </span>
          </div>
          <div>
            <span className={colors.text.muted}>{t('validation.statistics.maxError')}</span>
            <span className={`ml-2 ${colors.text.foreground}`}>
              {validation.statistics.maxError.toFixed(2)}m
            </span>
          </div>
          <div>
            <span className={colors.text.muted}>{t('validation.statistics.distribution')}</span>
            <span className={`ml-2 ${colors.text.foreground} capitalize`}>
              {validation.statistics.spatialDistribution}
            </span>
          </div>
        </div>

        {/* Errors */}
        {validation.errors.length > 0 && (
          <div className="mb-3">
            <h4 className={`${colors.text.error} font-medium mb-2`}>{t('validation.sections.errors')}</h4>
            <ul className={`text-sm ${colors.text.error} space-y-1`}>
              {validation.errors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div className="mb-3">
            <h4 className={`${colors.text.warning} font-medium mb-2`}>{t('validation.sections.warnings')}</h4>
            <ul className={`text-sm ${colors.text.warning} space-y-1`}>
              {validation.warnings.map((warning, i) => (
                <li key={i}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {validation.recommendations.length > 0 && (
          <div>
            <h4 className={`${colors.text.accent} font-medium mb-2`}>{t('validation.sections.recommendations')}</h4>
            <ul className={`text-sm ${colors.text.info} space-y-1`}>
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
    <div className={`${colors.bg.secondary} ${quick.card} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${colors.text.accent}`}>
          {t('panelTitle')} ({transformState.controlPoints.length})
        </h3>
        <button
          onClick={() => setShowAddPoint(!showAddPoint)}
          className={`${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white px-3 py-1 ${quick.input} text-sm transition-colors`}
        >
          {showAddPoint ? t('buttons.cancel') : t('actions.addPoint')}
        </button>
      </div>

      {/* Add Point Form */}
      {showAddPoint && (
        <div className={`${colors.bg.secondary} rounded p-4 mb-4`}>
          <h4 className="font-medium mb-3">{t('addControlPoint')}</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm ${colors.text.muted} mb-1`}>{t('form.dxfX')}</label>
              <input
                type="number"
                value={newPointData.dxfX}
                onChange={(e) => setNewPointData(prev => ({ ...prev, dxfX: e.target.value }))}
                className={`w-full ${colors.bg.secondary} ${quick.input} px-2 py-1 text-sm`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={`block text-sm ${colors.text.muted} mb-1`}>{t('form.dxfY')}</label>
              <input
                type="number"
                value={newPointData.dxfY}
                onChange={(e) => setNewPointData(prev => ({ ...prev, dxfY: e.target.value }))}
                className={`w-full ${colors.bg.secondary} ${quick.input} px-2 py-1 text-sm`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={`block text-sm ${colors.text.muted} mb-1`}>{t('form.geoLng')}</label>
              <input
                type="number"
                value={newPointData.geoLng}
                onChange={(e) => setNewPointData(prev => ({ ...prev, geoLng: e.target.value }))}
                className={`w-full ${colors.bg.secondary} ${quick.input} px-2 py-1 text-sm`}
                placeholder={GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE.toString()}
                step="0.000001"
              />
            </div>
            <div>
              <label className={`block text-sm ${colors.text.muted} mb-1`}>{t('form.geoLat')}</label>
              <input
                type="number"
                value={newPointData.geoLat}
                onChange={(e) => setNewPointData(prev => ({ ...prev, geoLat: e.target.value }))}
                className={`w-full ${colors.bg.secondary} ${quick.input} px-2 py-1 text-sm`}
                placeholder={GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE.toString()}
                step="0.000001"
              />
            </div>
            <div>
              <label className={`block text-sm ${colors.text.muted} mb-1`}>Accuracy (m):</label>
              <input
                type="number"
                value={newPointData.accuracy}
                onChange={(e) => setNewPointData(prev => ({ ...prev, accuracy: e.target.value }))}
                className={`w-full ${colors.bg.secondary} ${quick.input} px-2 py-1 text-sm`}
                placeholder="1.0"
                step="0.1"
              />
            </div>
            <div>
              <label className={`block text-sm ${colors.text.muted} mb-1`}>Description:</label>
              <input
                type="text"
                value={newPointData.description}
                onChange={(e) => setNewPointData(prev => ({ ...prev, description: e.target.value }))}
                className={`w-full ${colors.bg.secondary} ${quick.input} px-2 py-1 text-sm`}
                placeholder={t('hardcodedTexts.placeholders.optionalDescription')}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => setShowAddPoint(false)}
              className={`${colors.bg.hover} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} text-white px-3 py-1 ${quick.input} text-sm transition-colors`}
            >
              {t('controlPoints.cancel')}
            </button>
            <button
              onClick={handleAddPoint}
              disabled={!newPointData.dxfX || !newPointData.dxfY || !newPointData.geoLng || !newPointData.geoLat}
              className={`${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} disabled:${colors.bg.hover} disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm transition-colors`}
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
            className={`p-3 ${quick.button} transition-colors ${
              transformState.selectedPointId === point.id
                ? `${colors.bg.info} ${getStatusBorder('info')}`
                : `${colors.bg.secondary} ${getStatusBorder('default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`}
            onClick={() => transformActions.selectControlPoint(
              transformState.selectedPointId === point.id ? null : point.id
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`font-medium ${colors.text.accent}`}>{point.id}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  transformActions.removeControlPoint(point.id);
                }}
                className={`${colors.text.error} ${HOVER_TEXT_EFFECTS.RED} text-sm`}
              >
                ✕
              </button>
            </div>

            <div className={`grid grid-cols-2 gap-4 text-xs ${colors.text.muted}`}>
              <div>
                <div>DXF: ({point.dxfPoint.x.toFixed(2)}, {point.dxfPoint.y.toFixed(2)})</div>
              </div>
              <div>
                <div>Geo: ({point.geoPoint.lng.toFixed(6)}, {point.geoPoint.lat.toFixed(6)})</div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 text-xs">
              <span className={colors.text.muted}>±{point.accuracy}m</span>
              {point.description && (
                <span className={`${colors.text.muted} truncate max-w-32`}>{point.description}</span>
              )}
            </div>
          </div>
        ))}

        {transformState.controlPoints.length === 0 && (
          <div className={`text-center py-8 ${colors.text.muted}`}>
            <div className="mb-2 flex justify-center">
              <MapPin className="w-16 h-16" />
            </div>
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
    <div className={`${colors.bg.secondary} ${quick.card} p-4 mb-4`}>
      <h3 className={`text-lg font-semibold mb-4 ${colors.text.accent}`}>
        {t('transformation.controls')}
      </h3>

      {/* Calibration Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={colors.text.muted}>{t('transformation.status')}</span>
          <div className="flex items-center">
            {transformState.isCalibrated ? (
              <>
                <span className={`${colors.text.success} mr-2`}>{t('transformation.calibrated')}</span>
                <span className={`text-sm ${colors.text.muted}`}>
                  ({transformState.method}, ±{transformState.accuracy?.toFixed(3)}m)
                </span>
              </>
            ) : transformState.isCalibrating ? (
              <span className={colors.text.warning}>{t('transformation.calibrating')}</span>
            ) : (
              <span className={colors.text.muted}>{t('transformation.notCalibrated')}</span>
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
          className={`w-full ${colors.bg.success} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} disabled:${colors.bg.hover} disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors`}
        >
          {transformState.isCalibrating ? t('transformation.calibratingButton') : t('transformation.calibrateTransformation')}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={transformActions.saveControlPoints}
            disabled={transformState.controlPoints.length === 0}
            className={`${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} disabled:${colors.bg.hover} disabled:cursor-not-allowed text-white py-2 px-4 rounded text-sm transition-colors`}
          >
            {t('controlPoints.savePoints')}
          </button>

          <button
            onClick={transformActions.loadControlPoints}
            className={`${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white py-2 px-4 rounded text-sm transition-colors`}
          >
            {t('controlPoints.loadPoints')}
          </button>
        </div>

        <button
          onClick={transformActions.clearControlPoints}
          disabled={transformState.controlPoints.length === 0}
          className={`w-full ${colors.bg.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} disabled:${colors.bg.hover} disabled:cursor-not-allowed text-white py-2 px-4 rounded text-sm transition-colors`}
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
      <div className={`${colors.bg.error} ${quick.card} ${getStatusBorder('error')} p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <span className={`${colors.text.error} flex items-center gap-2`}>
            <XCircle className={iconSizes.sm} />
            Error: {transformState.error}
          </span>
          <button
            onClick={transformActions.clearError}
            className={`${colors.text.error} ${HOVER_TEXT_EFFECTS.RED}`}
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
      <div className={`${colors.bg.secondary} ${quick.card} p-4`}>
        <h2 className={`text-xl font-bold ${colors.text.accent} mb-2`}>
          {t('panelHeader.title')}
        </h2>
        <p className={`text-sm ${colors.text.muted}`}>
          {t('panelHeader.subtitle')}
        </p>
        {transformState.lastOperation && (
          <p className={`text-xs ${colors.text.success} mt-2`}>
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