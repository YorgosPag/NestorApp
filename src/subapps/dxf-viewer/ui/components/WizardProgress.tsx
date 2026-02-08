// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export function WizardProgress({
  currentStep,
  totalSteps,
  stepLabels = []
}: WizardProgressProps) {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className={`${PANEL_LAYOUT.BUTTON.PADDING} ${getDirectionalBorder('default', 'bottom')}`}>
      <div className="flex items-center">
        {steps.map((stepNum) => (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center">
              <div
                className={`${PANEL_LAYOUT.WIDTH.SM} ${PANEL_LAYOUT.HEIGHT.XL} ${PANEL_LAYOUT.ROUNDED.FULL} flex items-center justify-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  stepNum <= currentStep
                    ? `${colors.bg.info} ${colors.text.inverted}`
                    : `${colors.bg.muted} ${colors.text.muted}`
                }`}
              >
                {stepNum}
              </div>
              {stepLabels[stepNum - 1] && (
                <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS} text-center ${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>
                  {stepLabels[stepNum - 1]}
                </div>
              )}
            </div>
            {stepNum < totalSteps && (
              <div
                className={`flex-1 ${PANEL_LAYOUT.HEIGHT.XS} ${PANEL_LAYOUT.MARGIN.X_MD} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  stepNum < currentStep ? `${colors.bg.info}` : `${colors.bg.muted}`
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// 🏢 ENTERPRISE: Hook for i18n-aware step labels
export function useDefaultStepLabels(): string[] {
  const { t } = useTranslation('dxf-viewer');
  return [
    t('wizardProgress.stepLabels.level'),
    t('wizardProgress.stepLabels.calibration'),
    t('wizardProgress.stepLabels.import')
  ];
}

// 🏢 ENTERPRISE: Legacy function for backward compatibility (accepts t function)
export function getDefaultStepLabels(t: (key: string) => string): string[] {
  return [
    t('wizardProgress.stepLabels.level'),
    t('wizardProgress.stepLabels.calibration'),
    t('wizardProgress.stepLabels.import')
  ];
}

