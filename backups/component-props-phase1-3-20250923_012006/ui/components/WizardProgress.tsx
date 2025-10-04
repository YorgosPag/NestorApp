'use client';

import React from 'react';

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
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="px-4 py-3 border-b border-gray-700">
      <div className="flex items-center">
        {steps.map((stepNum) => (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  stepNum <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {stepNum}
              </div>
              {stepLabels[stepNum - 1] && (
                <div className="text-xs text-gray-400 mt-1 text-center max-w-16 truncate">
                  {stepLabels[stepNum - 1]}
                </div>
              )}
            </div>
            {stepNum < totalSteps && (
              <div
                className={`flex-1 h-1 mx-3 transition-colors ${
                  stepNum < currentStep ? 'bg-blue-600' : 'bg-gray-600'
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
