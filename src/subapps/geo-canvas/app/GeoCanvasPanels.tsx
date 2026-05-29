/**
 * GeoCanvas — Extracted sub-components (SystemStatusPanel, FoundationView).
 * @see GeoCanvasContent.tsx — main component
 */

'use client';

import React from 'react';
import { Globe, RefreshCcw } from 'lucide-react';
import { ComponentErrorBoundary } from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { UserTypeSelector } from '../components/UserTypeSelector';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import type { UseIconSizesReturn } from '@/hooks/useIconSizes';
import type { UserType } from '@/auth';

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
  iconSizes: UseIconSizesReturn;
}

export function SystemStatusPanel({ t, colors, borders, iconSizes }: SystemStatusPanelProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4 text-primary">
          {t('sidebar.phaseProgress.title')}
        </h3>
        <div className="space-y-3">
          <div className={`p-3 ${colors.bg.success}/20 ${borders.quick.card} ${borders.getStatusBorder('success')}`}>
            <div className="text-sm font-medium text-[hsl(var(--text-success))]">{t('sidebar.phaseProgress.phase1Title')}</div>
            <div className="text-xs text-[hsl(var(--text-success))]">{t('sidebar.phaseProgress.phase1Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.success}/20 ${borders.quick.card} ${borders.getStatusBorder('success')}`}>
            <div className="text-sm font-medium text-[hsl(var(--text-success))]">{t('sidebar.phaseProgress.phase2Title')}</div>
            <div className="text-xs text-[hsl(var(--text-success))]">{t('sidebar.phaseProgress.phase2Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.hover} rounded`}>
            <div className="text-sm font-medium text-[hsl(var(--text-warning))]">{t('sidebar.phaseProgress.phase3Title')}</div>
            <div className="text-xs text-muted-foreground">{t('sidebar.phaseProgress.phase3Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.hover} rounded`}>
            <div className="text-sm font-medium text-muted-foreground">{t('sidebar.phaseProgress.phase4Title')}</div>
            <div className="text-xs text-muted-foreground">{t('sidebar.phaseProgress.phase4Description')}</div>
          </div>
          <div className={`p-3 ${colors.bg.hover} rounded`}>
            <div className="text-sm font-medium text-muted-foreground">{t('sidebar.phaseProgress.phase5Title')}</div>
            <div className="text-xs text-muted-foreground">{t('sidebar.phaseProgress.phase5Description')}</div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-[hsl(var(--text-success))]">
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
        <h3 className="text-lg font-semibold mb-4 text-primary">
          {t('sidebar.technicalSpecs.title')}
        </h3>
        <dl className="space-y-2 text-sm text-muted-foreground">
          {[
            { key: 'transformation', color: 'text-primary' },
            { key: 'accuracy', color: 'text-[hsl(var(--text-success))]' },
            { key: 'crsSupport', color: 'text-primary' },
            { key: 'mathEngine', color: 'text-[hsl(var(--text-warning))]' },
            { key: 'standards', color: 'text-primary' },
          ].map(({ key, color }) => (
            <div key={key} className="flex justify-between">
              <dt>{t(`sidebar.technicalSpecs.${key}`)}</dt>
              <dd className={color}>{t(`sidebar.technicalSpecs.${key}Value`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-[hsl(var(--text-warning))]">
          {t('sidebar.comingNext.title')}
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
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
  iconSizes: UseIconSizesReturn;
  userType?: UserType;
  onUserTypeSelect: (type: 'citizen' | 'professional' | 'technical') => void;
}

export function FoundationView({ t, isLoading, colors, iconSizes, userType, onUserTypeSelect }: FoundationViewProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center max-w-4xl p-4 sm:p-8 w-full">
        <div className="flex justify-center mb-6">
          <Globe className="w-32 h-32 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-primary">{t('title')}</h2>
        <p className="text-xl text-muted-foreground mb-8">{t('subtitle')}</p>

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

      </div>
    </div>
  );
}
