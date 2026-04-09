/**
 * GeoCanvas — Extracted sub-components (SystemStatusPanel, FoundationView).
 * @see GeoCanvasContent.tsx — main component
 */

'use client';

import React from 'react';
import { Globe, CheckCircle, Construction, RefreshCcw } from 'lucide-react';
import { ComponentErrorBoundary } from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { UserTypeSelector } from '../components/UserTypeSelector';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';

// ============================================================================
// Shared prop types
// ============================================================================

interface PanelColors {
  bg: { success: string; hover: string; info: string; muted: string; primary: string; secondary: string; backgroundSecondary: string; warning: string };
  text: { muted: string };
}

interface PanelBorders {
  quick: { card: string; separatorH: string; separatorV: string };
  getStatusBorder: (status: string) => string;
}

// ============================================================================
// SystemStatusPanel
// ============================================================================

interface SystemStatusPanelProps {
  t: (key: string) => string;
  colors: PanelColors;
  borders: PanelBorders;
  iconSizes: Record<string, string>;
}

export function SystemStatusPanel({ t, colors, borders, iconSizes }: SystemStatusPanelProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4 text-blue-400">
          {t('sidebar.phaseProgress.title')}
        </h3>
        <div className="space-y-3">
          <div className={`p-3 ${colors.bg.success}/20 ${borders.quick.card} ${borders.getStatusBorder('success')}`}>
            <div className="text-sm font-medium text-green-300">{t('sidebar.phaseProgress.phase1Title')}</div>
            <div className="text-xs text-green-400">{t('sidebar.phaseProgress.phase1Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.success}/20 ${borders.quick.card} ${borders.getStatusBorder('success')}`}>
            <div className="text-sm font-medium text-green-300">{t('sidebar.phaseProgress.phase2Title')}</div>
            <div className="text-xs text-green-400">{t('sidebar.phaseProgress.phase2Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.hover} rounded`}>
            <div className="text-sm font-medium text-yellow-400">{t('sidebar.phaseProgress.phase3Title')}</div>
            <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase3Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.hover} rounded`}>
            <div className="text-sm font-medium text-gray-400">{t('sidebar.phaseProgress.phase4Title')}</div>
            <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase4Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.hover} rounded`}>
            <div className="text-sm font-medium text-gray-400">{t('sidebar.phaseProgress.phase5Title')}</div>
            <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase5Description')}</div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-green-400">
          {t('sidebar.availableFeatures.title')}
        </h3>
        <ul className="space-y-2 text-sm list-none">
          {['controlPointManagement', 'affineTransformation', 'accuracyValidation', 'spatialDistributionAnalysis', 'rmsErrorCalculation', 'coordinateTransformation'].map(key => (
            <li key={key} className="flex items-center space-x-2">
              <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true" />
              <span>{t(`sidebar.availableFeatures.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-blue-400">
          {t('sidebar.technicalSpecs.title')}
        </h3>
        <dl className="space-y-2 text-sm text-gray-300">
          {[
            { key: 'transformation', color: 'text-blue-300' },
            { key: 'accuracy', color: 'text-green-300' },
            { key: 'crsSupport', color: 'text-purple-300' },
            { key: 'mathEngine', color: 'text-yellow-300' },
            { key: 'standards', color: 'text-blue-300' },
          ].map(({ key, color }) => (
            <div key={key} className="flex justify-between">
              <dt>{t(`sidebar.technicalSpecs.${key}`)}</dt>
              <dd className={color}>{t(`sidebar.technicalSpecs.${key}Value`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-yellow-400">
          {t('sidebar.comingNext.title')}
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          {['maplibreIntegration', 'interactiveCoordinatePicking', 'realtimeTransformationPreview', 'multipleBasemapLayers', 'visualAccuracyIndicators'].map(key => (
            <div key={key}>{t(`sidebar.comingNext.${key}`)}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// FoundationView
// ============================================================================

interface FoundationViewProps {
  t: (key: string) => string;
  isLoading: boolean;
  colors: PanelColors;
  iconSizes: Record<string, string>;
  userType?: string;
  onUserTypeSelect: (type: 'citizen' | 'professional' | 'technical') => void;
}

export function FoundationView({ t, isLoading, colors, iconSizes, userType, onUserTypeSelect }: FoundationViewProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center max-w-4xl p-4 sm:p-8 w-full">
        <div className="flex justify-center mb-6">
          <Globe className="w-32 h-32 text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-blue-400">{t('title')}</h2>
        <p className="text-xl text-gray-400 mb-8">{t('subtitle')}</p>

        <div className="mb-8">
          <ComponentErrorBoundary componentName="UserTypeSelector">
            <UserTypeSelector currentType={userType} onSelect={onUserTypeSelect} />
          </ComponentErrorBoundary>

          {userType && (
            <div className="mt-4 text-center">
              <button
                onClick={() => window.location.reload()}
                className={`px-4 py-2 ${colors.bg.muted} text-white rounded-md text-sm flex items-center gap-2 ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.FAST_COLORS}`}
              >
                <RefreshCcw className={iconSizes.sm} />
                {t('userActions.changeUserType')}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          <div className={`${colors.bg.primary} p-6 rounded-lg`}>
            <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
              <CheckCircle className={iconSizes.md} />
              {t('sidebar.phaseProgress.phase1Title')}
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>{t('phaseDetails.phase1Features.foundationStructure')}</li>
              <li>{t('phaseDetails.phase1Features.enterpriseTypeSystem')}</li>
              <li>{t('phaseDetails.phase1Features.configurationSetup')}</li>
              <li>{t('phaseDetails.phase1Features.routerIntegrationReady')}</li>
            </ul>
          </div>

          <div className={`${colors.bg.primary} p-6 rounded-lg`}>
            <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
              <CheckCircle className={iconSizes.md} />
              {t('sidebar.phaseProgress.phase2Title')}
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>{t('phaseDetails.phase2Features.dxfTransformationEngine')}</li>
              <li>{t('phaseDetails.phase2Features.coordinateSystemSupport')}</li>
              <li>{t('phaseDetails.phase2Features.georeferencingTools')}</li>
              <li>{t('phaseDetails.phase2Features.controlPointManagement')}</li>
            </ul>
          </div>
        </div>

        <div className={`mt-8 p-6 ${colors.bg.primary} rounded-lg`}>
          <h3 className="text-lg font-semibold mb-4 text-blue-400 flex items-center gap-2">
            <Construction className={iconSizes.md} />
            {t('phaseDetails.architectureOverview.title')}
          </h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>{t('phaseDetails.architectureOverview.centralizedSystem')}</strong></p>
            <p><strong>{t('phaseDetails.architectureOverview.technologyStack')}</strong></p>
            <p><strong>{t('phaseDetails.architectureOverview.dataFlow')}</strong></p>
            <p><strong>{t('phaseDetails.architectureOverview.standards')}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
