'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  stepNum <= currentStep
                    ? `${colors.bg.info} ${colors.text.inverted}`
                    : `${colors.bg.muted} ${colors.text.muted}`
                }`}
              >
                {stepNum}
              </div>
              {stepLabels[stepNum - 1] && (
                <div className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS} text-center max-w-16 truncate`}>
                  {stepLabels[stepNum - 1]}
                </div>
              )}
            </div>
            {stepNum < totalSteps && (
              <div
                className={`flex-1 ${PANEL_LAYOUT.HEIGHT.XS} ${PANEL_LAYOUT.MARGIN.X_MD} transition-colors ${
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

export function getDefaultStepLabels(): string[] {
  return ['Επίπεδο', 'Βαθμονόμηση', 'Εισαγωγή'];
}
