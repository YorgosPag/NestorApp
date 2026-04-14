'use client';

import React, { useState, useCallback } from 'react';
import { Ruler, ExternalLink, Settings, Database, AlertTriangle, X } from 'lucide-react';
import { CraneIcon } from '@/subapps/dxf-viewer/components/icons';
import { useCentralizedPolygonSystem } from '../systems/polygon-system';
import { useRealEstateMatching } from '@/services/real-estate-monitor/useRealEstateMatching';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS, HOVER_SHADOWS } from '@/components/ui/effects';
import type { RealEstatePolygon } from '@geo-alert/core';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../config/color-config';
import type { UniversalPolygon } from '@geo-alert/core/polygon-system/types';
import { TechnicalAlertConfigPanel } from './TechnicalAlertConfigPanel';
import type { AlertConfiguration } from './TechnicalAlertConfigPanel';

// 🏢 ENTERPRISE: Type-safe polygon props
type BasePolygonData = UniversalPolygon;

interface TechnicalDrawingInterfaceProps {
  mapRef: React.RefObject<{ getCenter?: () => { lng: number; lat: number } } | null>;
  onPolygonComplete?: (polygon: BasePolygonData) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
}

/**
 * 🛠️ GEO-ALERT Phase 2.5.3: Enhanced Technical Drawing Interface
 *
 * Interface για τεχνικούς/μηχανικούς με DXF/DWG support,
 * CAD-level precision, advanced georeferencing, και automated alerts.
 */
export function TechnicalDrawingInterface({
  mapRef,
  onPolygonComplete,
  onRealEstateAlertCreated
}: TechnicalDrawingInterfaceProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslationLazy('geo-canvas');
  const [selectedTool, setSelectedTool] = useState<'dxf-viewer' | 'precision' | 'settings' | 'automated-alerts' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Automated Alerts state
  const [showAutomatedAlerts, setShowAutomatedAlerts] = useState(false);
  const [alertConfiguration, setAlertConfiguration] = useState<AlertConfiguration>({
    sensitivity: 'high',
    monitoringInterval: 15,
    alertThreshold: 0.95,
    enabledPlatforms: ['spitogatos', 'xe']
  });

  // Real Estate Monitoring Integration
  const {
    addRealEstatePolygon,
    getStatistics,
    startPeriodicCheck,
    stopPeriodicCheck
  } = useRealEstateMatching();

  const realEstateStats = getStatistics();

  // Centralized polygon system with Technical role
  const {
    polygons,
    stats,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    isDrawing: systemIsDrawing,
  } = useCentralizedPolygonSystem();

  const actualIsDrawing = isDrawing || systemIsDrawing;

  // Automated alert creation
  const handleAutomatedAlertCreation = useCallback((polygon: BasePolygonData) => {
    const priority = alertConfiguration.sensitivity === 'high'
      ? 4
      : alertConfiguration.sensitivity === 'medium'
        ? 3
        : 2;

    const technicalRealEstatePolygon: RealEstatePolygon = {
      ...polygon,
      type: 'real-estate',
      alertSettings: {
        enabled: true,
        priceRange: { min: 50000, max: 2000000 },
        propertyTypes: ['apartment', 'house', 'land', 'commercial', 'industrial'],
        includeExclude: 'include',
        priority
      }
    };

    addRealEstatePolygon(technicalRealEstatePolygon);
    onRealEstateAlertCreated?.(technicalRealEstatePolygon);
    startPeriodicCheck(alertConfiguration.monitoringInterval);
  }, [alertConfiguration, addRealEstatePolygon, onRealEstateAlertCreated, startPeriodicCheck]);

  // Tool selection handler
  const handleToolSelect = useCallback((tool: 'dxf-viewer' | 'precision' | 'settings' | 'automated-alerts') => {
    if (actualIsDrawing) {
      cancelDrawing();
      setIsDrawing(false);
    }

    setSelectedTool(tool);

    switch (tool) {
      case 'dxf-viewer':
        window.open('/dxf/viewer', '_blank');
        break;
      case 'precision':
        startDrawing('simple', {
          fillColor: GEO_COLORS.withOpacity(GEO_COLORS.USER_INTERFACE.TECHNICAL_STROKE, 0.2),
          strokeColor: GEO_COLORS.USER_INTERFACE.TECHNICAL_STROKE,
          strokeWidth: 1
        });
        setIsDrawing(true);
        break;
      case 'settings':
        break;
      case 'automated-alerts':
        setShowAutomatedAlerts(true);
        break;
    }
  }, [actualIsDrawing, startDrawing, cancelDrawing]);

  const handleComplete = useCallback(() => {
    const polygon = finishDrawing();
    if (polygon && onPolygonComplete) {
      onPolygonComplete(polygon);
    }
    setIsDrawing(false);
    setSelectedTool(null);
  }, [finishDrawing, onPolygonComplete]);

  const handleCancel = useCallback(() => {
    cancelDrawing();
    setIsDrawing(false);
    setSelectedTool(null);
  }, [cancelDrawing]);

  return (
    <div className={`${colors.bg.primary} ${quick.card} shadow-lg p-4`}>
      {/* Header */}
      <header className="mb-4">
        <h3 className={`text-lg font-semibold ${colors.text.foreground}`}>
          {t('drawingInterfaces.technical.title')}
        </h3>
        <p className={`text-sm ${colors.text.muted}`}>
          {t('drawingInterfaces.technical.subtitle')}
        </p>
      </header>

      {/* Tool Buttons */}
      <nav className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <button
          onClick={() => handleToolSelect('dxf-viewer')}
          disabled={actualIsDrawing}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'dxf-viewer'
              ? `${getStatusBorder('info')} ${colors.bg.info}`
              : `border-border ${colors.bg.primary} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.MEDIUM}`}
          `}
        >
          <ExternalLink className={`${iconSizes.xl} mb-2 ${colors.text.purple}`} />
          <span className="text-sm font-medium">{t('hardcodedTexts.ui.dxfViewer')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('hardcodedTexts.ui.fullCad')}</span>
        </button>

        <button
          onClick={() => handleToolSelect('precision')}
          disabled={actualIsDrawing && selectedTool !== 'precision'}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'precision'
              ? `${getStatusBorder('info')} ${colors.bg.info}`
              : `border-border ${colors.bg.primary} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }
            ${actualIsDrawing && selectedTool !== 'precision' ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.MEDIUM}`}
          `}
        >
          <Ruler className={`${iconSizes.xl} mb-2 ${colors.text.info}`} />
          <span className="text-sm font-medium">{t('drawingInterfaces.technical.tools.precision')}</span>
          <span className={`text-xs ${colors.text.muted}`}>mm-level</span>
        </button>

        <button
          onClick={() => handleToolSelect('settings')}
          disabled={actualIsDrawing}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'settings'
              ? `${getStatusBorder('info')} ${colors.bg.info}`
              : `border-border ${colors.bg.primary} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.MEDIUM}`}
          `}
        >
          <Settings className={`${iconSizes.xl} mb-2 ${colors.text.muted}`} />
          <span className="text-sm font-medium">{t('drawingInterfaces.technical.tools.settings')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.technical.tools.settingsAdvanced')}</span>
        </button>

        <button
          onClick={() => handleToolSelect('automated-alerts')}
          disabled={actualIsDrawing}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'automated-alerts'
              ? `${getStatusBorder('error')} ${colors.bg.error}`
              : `border-border ${colors.bg.primary} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.MEDIUM}`}
          `}
        >
          <AlertTriangle className={`${iconSizes.xl} mb-2 ${colors.text.error}`} />
          <span className="text-sm font-medium">{t('hardcodedTexts.ui.alerts')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.technical.tools.alertsAuto')}</span>
        </button>
      </nav>

      {/* Action Buttons για Precision Mode */}
      {actualIsDrawing && selectedTool === 'precision' && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleComplete}
            className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.accent} text-white py-3 px-4 ${quick.card} transition-colors ${HOVER_BACKGROUND_EFFECTS.PURPLE_BUTTON}`}
          >
            <Ruler className={iconSizes.md} />
            <span className="font-medium">{t('drawingInterfaces.technical.actions.complete')}</span>
          </button>

          <button
            onClick={handleCancel}
            className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.error} text-white py-3 px-4 ${quick.card} transition-colors ${HOVER_BACKGROUND_EFFECTS.RED_DARKER}`}
          >
            <span className="font-medium">{t('drawingInterfaces.technical.actions.cancel')}</span>
          </button>
        </div>
      )}

      {/* Technical Specs Panel */}
      <section className={`mb-4 p-3 ${colors.bg.info} ${quick.card} ${getStatusBorder('muted')}`}>
        <h4 className={`text-sm font-medium ${colors.text.purple} mb-2`}>
          🔬 {t('drawingInterfaces.technical.specifications.title')}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={colors.text.purple}>
            <span className="font-medium">{t('drawingInterfaces.technical.specifications.accuracy')}:</span> ±1mm
          </div>
          <div className={colors.text.purple}>
            <span className="font-medium">{t('drawingInterfaces.technical.specifications.coordinates')}:</span> WGS84
          </div>
          <div className={colors.text.purple}>
            <span className="font-medium">{t('hardcodedTexts.labels.formats')}</span> {t('hardcodedTexts.values.dxfDwg')}
          </div>
          <div className={colors.text.purple}>
            <span className="font-medium">{t('hardcodedTexts.labels.cadTools')}</span> {t('hardcodedTexts.values.full')}
          </div>
        </div>
      </section>

      {/* Instructions */}
      {selectedTool && (
        <div className={`mt-4 p-3 ${colors.bg.info} ${quick.card} ${getStatusBorder('info')}`}>
          <p className={`text-sm ${colors.text.info}`}>
            {selectedTool === 'dxf-viewer' && t('drawingInterfaces.technical.fullDxfViewer')}
            {selectedTool === 'precision' && t('drawingInterfaces.technical.instructions.precision')}
            {selectedTool === 'settings' && t('drawingInterfaces.technical.instructions.settings')}
            {selectedTool === 'automated-alerts' && t('drawingInterfaces.technical.instructions.automatedAlerts')}
          </p>
        </div>
      )}

      {/* DXF Viewer Quick Access */}
      <div className={`mt-4 p-3 ${colors.bg.secondary} rounded-md`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className={`${iconSizes.sm} ${colors.text.muted}`} />
            <span className={`text-sm ${colors.text.secondary}`}>{t('hardcodedTexts.labels.dxfViewerLabel')}</span>
          </div>
          <a
            href="/dxf/viewer"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs ${colors.text.info} flex items-center gap-1 ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
          >
            {t('drawingInterfaces.technical.openViewer')} <ExternalLink className={iconSizes.xs} />
          </a>
        </div>
        <p className={`text-xs ${colors.text.muted} mt-1 flex items-center gap-1`}>
          <CraneIcon className={iconSizes.xs} />
          {t('drawingInterfaces.technical.cadEnvironment')}
        </p>
      </div>

      {/* Statistics */}
      {(stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
        <div className={`mt-4 p-3 ${colors.bg.secondary} rounded-md space-y-1`}>
          {stats.totalPolygons > 0 && (
            <p className={`text-xs ${colors.text.muted}`}>
              <span className="font-medium">{t('drawingInterfaces.technical.stats.technicalDrawings')}:</span> {stats.totalPolygons}
            </p>
          )}
          {realEstateStats.totalAlerts > 0 && (
            <div className={`text-xs ${colors.text.error}`}>
              <p>
                <span className="font-medium">{t('hardcodedTexts.labels.automatedAlerts')}</span> {realEstateStats.totalAlerts}
              </p>
              {realEstateStats.totalMatches > 0 && (
                <p>
                  <span className="font-medium">{t('hardcodedTexts.labels.technicalMatches')}</span> {realEstateStats.totalMatches}
                </p>
              )}
              {realEstateStats.averageConfidence && (
                <p>
                  <span className="font-medium">{t('hardcodedTexts.labels.precisionLabel')}</span> {Math.round(realEstateStats.averageConfidence * 100)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Automated Alerts Config Panel (extracted) */}
      {showAutomatedAlerts && (
        <TechnicalAlertConfigPanel
          alertConfiguration={alertConfiguration}
          onConfigurationChange={setAlertConfiguration}
          onClose={() => {
            setShowAutomatedAlerts(false);
            setSelectedTool(null);
          }}
          polygons={polygons}
          onAutomateAll={() => {
            polygons.forEach((polygon) => handleAutomatedAlertCreation(polygon));
          }}
          onStartMonitoring={() => startPeriodicCheck(alertConfiguration.monitoringInterval)}
          onStopMonitoring={() => stopPeriodicCheck()}
        />
      )}
    </div>
  );
}
