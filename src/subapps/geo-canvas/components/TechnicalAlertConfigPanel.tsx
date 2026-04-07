'use client';

import React from 'react';
import { AlertTriangle, X, Zap, Monitor, Settings, Building, Sparkles } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { UniversalPolygon } from '@geo-alert/core/polygon-system/types';

// ============================================================================
// Types
// ============================================================================

export interface AlertConfiguration {
  sensitivity: 'low' | 'medium' | 'high';
  monitoringInterval: number;
  alertThreshold: number;
  enabledPlatforms: string[];
}

interface TechnicalAlertConfigPanelProps {
  alertConfiguration: AlertConfiguration;
  onConfigurationChange: (config: AlertConfiguration) => void;
  onClose: () => void;
  polygons: UniversalPolygon[];
  onAutomateAll: () => void;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TechnicalAlertConfigPanel({
  alertConfiguration,
  onConfigurationChange,
  onClose,
  polygons,
  onAutomateAll,
  onStartMonitoring,
  onStopMonitoring,
}: TechnicalAlertConfigPanelProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslationLazy('geo-canvas');

  return (
    <section className={`mt-4 ${colors.bg.primary} ${quick.card} shadow-lg ${getStatusBorder('error')} p-4`}>
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className={`${iconSizes.md} text-red-600`} />
          {t('drawingInterfaces.technical.automatedAlerts.title')}
        </h3>
        <button
          onClick={onClose}
          className={`text-gray-500 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
        >
          <X className={iconSizes.md} />
        </button>
      </header>

      {/* Alert Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Sensitivity Settings */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">{t('hardcodedTexts.labels.technicalSensitivity')}</legend>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('drawingInterfaces.technical.automatedAlerts.detectionSensitivity')}
            </label>
            <Select
              value={alertConfiguration.sensitivity}
              onValueChange={(val) => onConfigurationChange({
                ...alertConfiguration,
                sensitivity: val as 'low' | 'medium' | 'high'
              })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">{t('drawingInterfaces.technical.automatedAlerts.sensitivity.high')}</SelectItem>
                <SelectItem value="medium">{t('drawingInterfaces.technical.automatedAlerts.sensitivity.medium')}</SelectItem>
                <SelectItem value="low">{t('drawingInterfaces.technical.automatedAlerts.sensitivity.low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('drawingInterfaces.technical.automatedAlerts.monitoringInterval')}
            </label>
            <Select
              value={String(alertConfiguration.monitoringInterval)}
              onValueChange={(val) => onConfigurationChange({
                ...alertConfiguration,
                monitoringInterval: Number(val)
              })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">{t('drawingInterfaces.technical.automatedAlerts.intervals.realtime')}</SelectItem>
                <SelectItem value="15">{t('drawingInterfaces.technical.automatedAlerts.intervals.frequent')}</SelectItem>
                <SelectItem value="30">{t('drawingInterfaces.technical.automatedAlerts.intervals.standard')}</SelectItem>
                <SelectItem value="60">{t('drawingInterfaces.technical.automatedAlerts.intervals.hourly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        {/* Platform Settings */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">{t('hardcodedTexts.labels.monitoringPlatforms')}</legend>

          <div className="space-y-2">
            {[
              { id: 'spitogatos', name: t('hardcodedTexts.values.spitogatosGr'), icon: NAVIGATION_ENTITIES.property.icon },
              { id: 'xe', name: t('hardcodedTexts.values.xeGr'), icon: Building },
              { id: 'future-platform', name: t('drawingInterfaces.technical.automatedAlerts.morePlatforms'), icon: Sparkles, disabled: true }
            ].map((platform) => (
              <label key={platform.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={alertConfiguration.enabledPlatforms.includes(platform.id)}
                  disabled={platform.disabled}
                  onChange={(e) => {
                    if (platform.disabled) return;
                    onConfigurationChange({
                      ...alertConfiguration,
                      enabledPlatforms: e.target.checked
                        ? [...alertConfiguration.enabledPlatforms, platform.id]
                        : alertConfiguration.enabledPlatforms.filter(p => p !== platform.id)
                    });
                  }}
                  className="rounded border-border text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  <platform.icon className={iconSizes.sm} />
                  {platform.name}
                  {platform.disabled && <span className="text-xs text-gray-400">{t('hardcodedTexts.values.comingSoon')}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Technical Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <button
          onClick={onAutomateAll}
          disabled={polygons.length === 0}
          className={`flex items-center justify-center gap-2 ${colors.bg.error} text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 ${HOVER_BACKGROUND_EFFECTS.RED_DARKER}`}
        >
          <Zap className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('hardcodedTexts.actions.automateAll')} ({polygons.length})</span>
        </button>

        <button
          onClick={onStartMonitoring}
          className={`flex items-center justify-center gap-2 ${colors.bg.success} text-white py-2 px-4 rounded-lg transition-colors ${HOVER_BACKGROUND_EFFECTS.GREEN_BUTTON}`}
        >
          <Monitor className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('hardcodedTexts.actions.startMonitoring')}</span>
        </button>

        <button
          onClick={onStopMonitoring}
          className={`flex items-center justify-center gap-2 ${colors.bg.muted} text-white py-2 px-4 rounded-lg transition-colors ${HOVER_BACKGROUND_EFFECTS.GRAY_DARKER}`}
        >
          <Settings className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('hardcodedTexts.actions.stopAll')}</span>
        </button>
      </div>

      {/* Technical Specifications */}
      <footer className={`${colors.bg.error} ${quick.error} p-3`}>
        <h4 className="text-sm font-semibold text-red-900 mb-2">{t('drawingInterfaces.technical.automatedAlerts.technicalSpecifications')}</h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-red-700">
          <div>
            <span className="font-medium">{t('hardcodedTexts.ui.precision')}:</span> {t('hardcodedTexts.values.millimeterLevel')}
          </div>
          <div>
            <span className="font-medium">{t('hardcodedTexts.labels.georeferencing')}</span> {t('hardcodedTexts.values.wgs84LocalGrid')}
          </div>
          <div>
            <span className="font-medium">{t('hardcodedTexts.labels.confidenceThreshold')}</span> {Math.round(alertConfiguration.alertThreshold * 100)}%
          </div>
          <div>
            <span className="font-medium">{t('hardcodedTexts.labels.processingLabel')}</span> {t('hardcodedTexts.values.realtimeAutomated')}
          </div>
        </div>
      </footer>
    </section>
  );
}
