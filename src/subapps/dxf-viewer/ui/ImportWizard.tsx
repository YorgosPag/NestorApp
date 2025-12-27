'use client';
import React from 'react';
import { useLevels } from '../systems/levels';
import { WizardProgress } from './components/WizardProgress';
import { LevelSelectionStep } from './wizard/LevelSelectionStep';
import { CalibrationStep } from './wizard/CalibrationStep';
import { PreviewStep } from './wizard/PreviewStep';
import { X } from 'lucide-react';
import { useWizardNavigation } from '../hooks/useWizardNavigation';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ImportWizard({ isOpen, onClose, onComplete }: ImportWizardProps) {
  const iconSizes = useIconSizes();
  const { quick, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const { importWizard } = useLevels();
  const navigation = useWizardNavigation({ onComplete, onClose });
  const stepInfo = navigation.getStepInfo();
  
  if (!isOpen) return null;

  const renderStep = () => {
    switch (importWizard.step) {
      case 'level':
        return <LevelSelectionStep />;
      case 'calibration':
        return <CalibrationStep />;
      case 'preview':
        return <PreviewStep />;
      default:
        return (
          <div className="p-6 text-center">
            <h3 className={`text-lg font-semibold ${colors.text.primary} mb-4`}>Σφάλμα</h3>
            <p className={`${colors.text.muted} mb-6`}>Άγνωστο βήμα εισαγωγής</p>
            <button
              onClick={onClose}
              className={`px-4 py-2 ${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.inverted}rounded`}
            >
              Κλείσιμο
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`${colors.bg.secondary} rounded-lg shadow-xl ${quick.muted} w-full max-w-2xl max-h-[90vh] flex flex-col`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-4 ${getDirectionalBorder('muted', 'bottom')}`}>
          <div>
            <h2 className={`text-xl font-semibold ${colors.text.primary}`}>Εισαγωγή DXF</h2>
            <p className={`text-sm ${colors.text.muted}`}>
              Βήμα {stepInfo.number} από {stepInfo.totalSteps}: {stepInfo.title}
              {importWizard.file && ` • ${importWizard.file.name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} rounded`}
          >
            <X className={iconSizes.md} />
          </button>
        </div>

        {/* Progress */}
        <div className={`px-4 py-2 ${colors.bg.hover}`}>
          <WizardProgress currentStep={stepInfo.number} totalSteps={stepInfo.totalSteps} />
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className={`p-4 ${getDirectionalBorder('muted', 'top')} flex justify-between`}>
          <button
            onClick={navigation.handleBack}
            disabled={stepInfo.number === 1}
            className={`px-4 py-2 ${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.inverted}rounded disabled:opacity-50`}
          >
            Πίσω
          </button>
          <button
            onClick={navigation.handleNext}
            disabled={!navigation.canProceed()}
            className={`px-6 py-2 ${colors.bg.info} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.inverted}rounded disabled:opacity-50`}
          >
            {stepInfo.number === stepInfo.totalSteps ? 'Εισαγωγή' : 'Επόμενο'}
          </button>
        </div>

      </div>
    </div>
  );
}
